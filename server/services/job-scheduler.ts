import { storage } from "../storage";
import { JOB_STATUS, JOB_RUN_STATUS, type InsertScheduledJob, type ScheduledJob, type JobRun } from "@shared/schema";
import { sendJobFailureNotificationEmail } from "../email";

type JobFunction = () => Promise<{ summary: string; details?: any }>;

interface RegisteredJob {
  job: ScheduledJob;
  fn: JobFunction;
  intervalId?: NodeJS.Timeout;
  selfScheduled?: boolean;
}

class JobScheduler {
  private jobs: Map<string, RegisteredJob> = new Map();
  private initialized = false;
  // Track last failure-notification timestamp per job to rate-limit emails.
  // In development we skip emails entirely; in production we suppress duplicates
  // within a 4-hour window so a recurring job failure doesn't flood inboxes.
  private lastFailureNotifiedAt: Map<string, number> = new Map();
  private static FAILURE_NOTIFY_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

  async initialize() {
    if (this.initialized) return;
    
    console.log('[JobScheduler] Initializing...');
    
    const existingJobs = await storage.getScheduledJobs();
    for (const job of existingJobs) {
      if (this.jobs.has(job.name)) {
        const registeredJob = this.jobs.get(job.name)!;
        registeredJob.job = job;
        if (job.status === JOB_STATUS.ACTIVE && job.intervalMs && !registeredJob.selfScheduled) {
          this.startJobInterval(job.name);
        }
      }
    }
    
    this.initialized = true;
    console.log(`[JobScheduler] Initialized with ${this.jobs.size} jobs`);
  }

  async registerJob(
    name: string,
    displayName: string,
    description: string,
    category: string,
    scheduleExpression: string,
    intervalMs: number,
    fn: JobFunction,
    config?: any
  ): Promise<ScheduledJob> {
    let job = await storage.getScheduledJobByName(name);
    
    if (!job) {
      job = await storage.createScheduledJob({
        name,
        displayName,
        description,
        category,
        scheduleExpression,
        intervalMs,
        status: JOB_STATUS.ACTIVE,
        config,
        nextRunAt: new Date(Date.now() + intervalMs),
      });
      console.log(`[JobScheduler] Registered new job: ${name}`);
    } else {
      await storage.updateScheduledJob(job.id, {
        displayName,
        description,
        scheduleExpression,
        intervalMs,
      });
      // Reload job from DB to get updated values
      const updatedJob = await storage.getScheduledJobByName(name);
      if (updatedJob) {
        job = updatedJob;
      }
      console.log(`[JobScheduler] Updated existing job: ${name}`);
    }

    // Jobs may opt out of the default fixed-interval timer by passing
    // `config.selfScheduled = true`. Such jobs are still registered and run
    // through the scheduler (so job_runs are tracked and manual triggers work),
    // but the caller is responsible for arranging the actual schedule (e.g.
    // anchored to a specific time of day in a particular timezone).
    const selfScheduled = !!(config && config.selfScheduled);

    this.jobs.set(name, { job, fn, selfScheduled });

    if (job.status === JOB_STATUS.ACTIVE && !selfScheduled) {
      this.startJobInterval(name);
    } else if (selfScheduled) {
      console.log(`[JobScheduler] ${name} is self-scheduled; default interval timer disabled`);
    }

    return job;
  }

  private startJobInterval(name: string) {
    const registeredJob = this.jobs.get(name);
    if (!registeredJob) return;

    if (registeredJob.intervalId) {
      clearInterval(registeredJob.intervalId);
    }

    const intervalMs = registeredJob.job.intervalMs || 3600000;
    
    registeredJob.intervalId = setInterval(async () => {
      await this.runJob(name, 'schedule');
    }, intervalMs);

    console.log(`[JobScheduler] Started interval for ${name}: every ${intervalMs}ms`);
  }

  private stopJobInterval(name: string) {
    const registeredJob = this.jobs.get(name);
    if (registeredJob?.intervalId) {
      clearInterval(registeredJob.intervalId);
      registeredJob.intervalId = undefined;
      console.log(`[JobScheduler] Stopped interval for ${name}`);
    }
  }

  async runJob(name: string, triggeredBy: 'schedule' | 'manual' | 'startup', triggeredByUserId?: string): Promise<JobRun | null> {
    const registeredJob = this.jobs.get(name);
    if (!registeredJob) {
      console.error(`[JobScheduler] Job not found: ${name}`);
      return null;
    }

    const { job, fn } = registeredJob;

    if (job.status === JOB_STATUS.PAUSED && triggeredBy === 'schedule') {
      console.log(`[JobScheduler] Skipping paused job: ${name}`);
      return null;
    }

    console.log(`[JobScheduler] Running job: ${name} (triggered by: ${triggeredBy})`);

    const run = await storage.createJobRun({
      jobId: job.id,
      jobName: job.name,
      status: JOB_RUN_STATUS.RUNNING,
      triggeredBy,
      triggeredByUserId,
      startedAt: new Date(),
    });

    try {
      const result = await fn();
      
      // Self-scheduled jobs manage their own nextRunAt (e.g. anchored to a
      // specific time of day in a particular timezone). Don't overwrite it
      // here with the misleading "now + intervalMs" value the dashboard would
      // otherwise display.
      const nextRunAt = registeredJob.selfScheduled
        ? undefined
        : (job.intervalMs ? new Date(Date.now() + job.intervalMs) : undefined);
      await storage.updateScheduledJobLastRun(job.id, new Date(), nextRunAt);
      
      const completedRun = await storage.completeJobRun(
        run.id,
        JOB_RUN_STATUS.SUCCESS,
        result.summary,
        result.details
      );

      console.log(`[JobScheduler] Job ${name} completed: ${result.summary}`);
      return completedRun;
    } catch (error: any) {
      console.error(`[JobScheduler] Job ${name} failed:`, error);
      
      const completedRun = await storage.completeJobRun(
        run.id,
        JOB_RUN_STATUS.FAILED,
        `Job failed: ${error.message}`,
        undefined,
        error.message,
        error.stack
      );

      // Send failure notification emails to all vega admins
      await this.sendFailureNotifications(job, error.message, error.stack);

      return completedRun;
    }
  }

  async pauseJob(name: string): Promise<void> {
    const registeredJob = this.jobs.get(name);
    if (!registeredJob) return;

    await storage.updateScheduledJobStatus(registeredJob.job.id, JOB_STATUS.PAUSED);
    registeredJob.job.status = JOB_STATUS.PAUSED;
    this.stopJobInterval(name);
    console.log(`[JobScheduler] Paused job: ${name}`);
  }

  async resumeJob(name: string): Promise<void> {
    const registeredJob = this.jobs.get(name);
    if (!registeredJob) return;

    await storage.updateScheduledJobStatus(registeredJob.job.id, JOB_STATUS.ACTIVE);
    registeredJob.job.status = JOB_STATUS.ACTIVE;
    if (!registeredJob.selfScheduled) {
      this.startJobInterval(name);
    }
    console.log(`[JobScheduler] Resumed job: ${name}`);
  }

  async updateSchedule(name: string, scheduleExpression: string, intervalMs: number): Promise<ScheduledJob | null> {
    const registeredJob = this.jobs.get(name);
    if (!registeredJob) return null;

    // Update in database
    const updatedJob = await storage.updateScheduledJob(registeredJob.job.id, {
      scheduleExpression: scheduleExpression,
      intervalMs: intervalMs,
    });

    if (!updatedJob) return null;

    // Update in memory
    registeredJob.job = updatedJob;

    // Restart interval with new timing if job is active
    if (registeredJob.job.status === JOB_STATUS.ACTIVE) {
      this.stopJobInterval(name);
      this.startJobInterval(name);
    }

    console.log(`[JobScheduler] Updated schedule for ${name}: ${scheduleExpression} (${intervalMs}ms)`);
    return updatedJob;
  }

  async getJobs(): Promise<ScheduledJob[]> {
    return await storage.getScheduledJobs();
  }

  async getJobRuns(jobId?: string, limit?: number): Promise<JobRun[]> {
    return await storage.getJobRuns(jobId, limit);
  }

  async getRecentRuns(limit?: number): Promise<JobRun[]> {
    return await storage.getRecentJobRuns(limit);
  }

  isJobRegistered(name: string): boolean {
    return this.jobs.has(name);
  }

  async runStartupJobs(): Promise<void> {
    console.log('[JobScheduler] Running startup jobs...');
    const entries = Array.from(this.jobs.entries());
    for (const [name, registeredJob] of entries) {
      if (registeredJob.job.status === JOB_STATUS.ACTIVE) {
        setTimeout(async () => {
          await this.runJob(name, 'startup');
        }, 5000);
      }
    }
  }

  async killStuckRun(runId: string, killedByUserId: string): Promise<JobRun | null> {
    const run = await storage.getJobRunById(runId);
    if (!run) {
      console.error(`[JobScheduler] Run not found: ${runId}`);
      return null;
    }

    if (run.status !== JOB_RUN_STATUS.RUNNING) {
      console.log(`[JobScheduler] Run ${runId} is not in running state, cannot kill`);
      return null;
    }

    console.log(`[JobScheduler] Killing stuck run: ${runId} (job: ${run.jobName})`);
    
    const killedRun = await storage.killJobRun(runId, killedByUserId);
    
    console.log(`[JobScheduler] Successfully killed run: ${runId}`);
    return killedRun;
  }

  async getStuckRuns(thresholdMinutes: number = 30): Promise<JobRun[]> {
    return await storage.getStuckJobRuns(thresholdMinutes);
  }

  private async sendFailureNotifications(job: ScheduledJob, errorMessage: string, errorStack: string | null): Promise<void> {
    // Never send failure emails in development — dev environments run all the
    // same scheduled jobs but usually lack real data, causing spurious alerts.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[JobScheduler] Skipping failure email in non-production env for job: ${job.name}`);
      return;
    }

    // Rate-limit: don't re-send the same job's failure notification within the
    // cooldown window. This prevents inbox floods when a recurring job keeps
    // failing on each scheduled tick.
    const lastNotified = this.lastFailureNotifiedAt.get(job.name) ?? 0;
    const cooldown = JobScheduler.FAILURE_NOTIFY_COOLDOWN_MS;
    if (Date.now() - lastNotified < cooldown) {
      const nextAllowedAt = new Date(lastNotified + cooldown).toISOString();
      console.warn(`[JobScheduler] Suppressing duplicate failure email for ${job.name} (next allowed: ${nextAllowedAt})`);
      return;
    }

    try {
      const adminUsers = await storage.getVegaAdminUsers();
      
      if (adminUsers.length === 0) {
        console.log('[JobScheduler] No admin users found to notify about job failure');
        return;
      }

      console.log(`[JobScheduler] Sending failure notifications to ${adminUsers.length} admin(s)`);
      
      for (const admin of adminUsers) {
        try {
          await sendJobFailureNotificationEmail(
            admin.email,
            job.name,
            job.displayName,
            errorMessage,
            errorStack,
            new Date()
          );
        } catch (emailError) {
          console.error(`[JobScheduler] Failed to send notification to ${admin.email}:`, emailError);
        }
      }

      // Record the time we successfully dispatched this notification batch
      this.lastFailureNotifiedAt.set(job.name, Date.now());
    } catch (error) {
      console.error('[JobScheduler] Failed to send failure notifications:', error);
    }
  }
}

export const jobScheduler = new JobScheduler();
