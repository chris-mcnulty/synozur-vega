import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { jobScheduler } from "./services/job-scheduler";
import { backfillSnapshotsFromCheckIns, runDailySnapshotJob } from "./services/progress-snapshots";
import { isPlatformAdminRole, isTenantAdminRole, type Role } from "@shared/rbac";

const router = Router();

// "Admin or above" — tenant admins (tenant_admin, admin) and platform admins
// (vega_admin, global_admin). Used to gate read/list and tenant-scoped manual
// actions (capture-snapshot, backfill-snapshots).
function isAdminOrAbove(role?: string): boolean {
  if (!role) return false;
  return isPlatformAdminRole(role as Role) || isTenantAdminRole(role as Role);
}

// Platform admin — used for cross-tenant queries and global-scope mutations
// (e.g. listing all jobs, manually triggering arbitrary scheduler jobs that
// may have side effects across tenants).
function isPlatformAdmin(role?: string): boolean {
  if (!role) return false;
  return isPlatformAdminRole(role as Role);
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const tenantId = isPlatformAdmin(user.role) ? undefined : user.tenantId;
    const jobs = await storage.getScheduledJobs(tenantId);
    
    res.json(jobs);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

// IMPORTANT: This route must be defined BEFORE /:jobId to prevent Express matching "runs" as a jobId
router.get("/runs/recent", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const runs = await jobScheduler.getRecentRuns(limit);
    
    if (!isPlatformAdmin(user.role)) {
      const filteredRuns = [];
      for (const run of runs) {
        const job = await storage.getScheduledJobById(run.jobId);
        if (job && (!job.tenantId || job.tenantId === user.tenantId)) {
          filteredRuns.push(run);
        }
      }
      return res.json(filteredRuns);
    }
    
    res.json(runs);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching recent runs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:jobId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (!isPlatformAdmin(user.role) && job.tenantId && job.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(job);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching job:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:jobId/runs", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (!isPlatformAdmin(user.role) && job.tenantId && job.tenantId !== user.tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const runs = await storage.getJobRuns(req.params.jobId, limit);
    
    res.json(runs);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching job runs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update job schedule (platform admins only — schedules are global)
router.patch("/:jobId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can update job schedules" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const { schedule, intervalMs } = req.body;
    
    if (!schedule || !intervalMs || typeof intervalMs !== 'number' || intervalMs < 60000) {
      return res.status(400).json({ error: "Invalid schedule. Provide schedule (string) and intervalMs (number >= 60000)" });
    }
    
    const updatedJob = await jobScheduler.updateSchedule(job.name, schedule, intervalMs);
    
    if (!updatedJob) {
      return res.status(400).json({ error: "Failed to update schedule - job may not be registered" });
    }
    
    res.json(updatedJob);
  } catch (error: any) {
    console.error("[Jobs API] Error updating job schedule:", error);
    res.status(500).json({ error: error.message });
  }
});

// Run an arbitrary scheduled job by id. Restricted to platform admins because
// some jobs (e.g. daily-progress-snapshots) iterate over all tenants and have
// cross-tenant side effects. Tenant admins should use the dedicated
// tenant-scoped endpoints below.
router.post("/:jobId/run", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can manually trigger jobs" });
    }

    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const run = await jobScheduler.runJob(job.name, 'manual', user.id);
    
    if (!run) {
      return res.status(400).json({ error: "Failed to run job - job may not be registered" });
    }
    
    res.json(run);
  } catch (error: any) {
    console.error("[Jobs API] Error running job:", error);
    res.status(500).json({ error: error.message });
  }
});

// Tenant-scoped manual snapshot capture: runs the daily snapshot logic for
// the caller's tenant only. Tenant admins (and platform admins) can trigger
// this when the scheduled run failed or the tenant is newly onboarded.
router.post("/capture-snapshot", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const tenantId = (req as any).effectiveTenantId || user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "No tenant context for current request" });
    }

    const result = await runDailySnapshotJob({ tenantId });
    res.json(result);
  } catch (error: any) {
    console.error("[Jobs API] Error running manual snapshot capture:", error);
    res.status(500).json({ error: error.message });
  }
});

// Tenant-scoped backfill: re-run snapshot backfill from check-ins for the
// caller's tenant. Tenant admins (and platform admins) can trigger this when
// onboarding a tenant mid-cycle or recovering from a failed snapshot run.
// Defaults to force=true so the action genuinely re-runs the backfill
// (recomputing existing snapshots), matching the task semantics of
// `onlyIfEmpty: false`. Pass { force: false } to only fill missing days.
router.post("/backfill-snapshots", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Use the request's effective tenant (set from x-tenant-id header by
    // requireTenantAccess) so platform admins operating in a tenant context
    // backfill the selected tenant rather than their home tenant.
    const tenantId = (req as any).effectiveTenantId || user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "No tenant context for current request" });
    }

    const force = req.body?.force === undefined ? true : !!req.body.force;
    const result = await backfillSnapshotsFromCheckIns({ tenantId, force });
    res.json(result);
  } catch (error: any) {
    console.error("[Jobs API] Error running snapshot backfill:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:jobId/pause", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can pause jobs" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await jobScheduler.pauseJob(job.name);
    const updatedJob = await storage.getScheduledJobById(job.id);
    
    res.json(updatedJob);
  } catch (error: any) {
    console.error("[Jobs API] Error pausing job:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:jobId/resume", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can resume jobs" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    await jobScheduler.resumeJob(job.name);
    const updatedJob = await storage.getScheduledJobById(job.id);
    
    res.json(updatedJob);
  } catch (error: any) {
    console.error("[Jobs API] Error resuming job:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/runs/:runId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isAdminOrAbove(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const run = await storage.getJobRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    if (!isPlatformAdmin(user.role)) {
      const job = await storage.getScheduledJobById(run.jobId);
      if (job && job.tenantId && job.tenantId !== user.tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    
    res.json(run);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching run:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/runs/:runId/kill", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can kill job runs" });
    }
    
    const run = await storage.getJobRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    if (run.status !== 'running') {
      return res.status(400).json({ error: "Can only kill runs that are currently running" });
    }
    
    const killedRun = await jobScheduler.killStuckRun(req.params.runId, user.id);
    
    if (!killedRun) {
      return res.status(400).json({ error: "Failed to kill run" });
    }
    
    res.json(killedRun);
  } catch (error: any) {
    console.error("[Jobs API] Error killing run:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/runs/stuck", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isPlatformAdmin(user.role)) {
      return res.status(403).json({ error: "Only platform admins can view stuck runs" });
    }
    
    const thresholdMinutes = req.query.threshold ? parseInt(req.query.threshold as string) : 30;
    const stuckRuns = await jobScheduler.getStuckRuns(thresholdMinutes);
    
    res.json(stuckRuns);
  } catch (error: any) {
    console.error("[Jobs API] Error fetching stuck runs:", error);
    res.status(500).json({ error: error.message });
  }
});

export const jobsRouter = router;
