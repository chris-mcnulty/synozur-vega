import { storage } from "../storage";
import { JOB_STATUS, JOB_RUN_STATUS, type InsertScheduledJob, type ScheduledJob, type JobRun } from "@shared/schema";

type JobFunction = () => Promise<{ summary: string; details?: any }>;

interface RegisteredJob {
  job: ScheduledJob;
  fn: JobFunction;
  intervalId?: NodeJS.Timeout;
}

class JobScheduler {
  private jobs: Map<string, RegisteredJob> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    console.log('[JobScheduler] Initializing...');
    
    const existingJobs = await storage.getScheduledJobs();
    for (const job of existingJobs) {
      if (this.jobs.has(job.name)) {
        const registeredJob = this.jobs.get(job.name)!;
        registeredJob.job = job;
        if (job.status === JOB_STATUS.ACTIVE && job.intervalMs) {
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

    this.jobs.set(name, { job, fn });

    if (job.status === JOB_STATUS.ACTIVE) {
      this.startJobInterval(name);
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
      
      const nextRunAt = job.intervalMs ? new Date(Date.now() + job.intervalMs) : undefined;
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
    this.startJobInterval(name);
    console.log(`[JobScheduler] Resumed job: ${name}`);
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
    for (const [name, registeredJob] of this.jobs) {
      if (registeredJob.job.status === JOB_STATUS.ACTIVE) {
        setTimeout(async () => {
          await this.runJob(name, 'startup');
        }, 5000);
      }
    }
  }
}

export const jobScheduler = new JobScheduler();
