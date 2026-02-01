import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { jobScheduler } from "./services/job-scheduler";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || (user.role !== 'vega_admin' && user.role !== 'tenant_admin')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const tenantId = user.role === 'vega_admin' ? undefined : user.tenantId;
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
    if (!user || (user.role !== 'vega_admin' && user.role !== 'tenant_admin')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const runs = await jobScheduler.getRecentRuns(limit);
    
    if (user.role !== 'vega_admin') {
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
    if (!user || (user.role !== 'vega_admin' && user.role !== 'tenant_admin')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (user.role !== 'vega_admin' && job.tenantId && job.tenantId !== user.tenantId) {
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
    if (!user || (user.role !== 'vega_admin' && user.role !== 'tenant_admin')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const job = await storage.getScheduledJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (user.role !== 'vega_admin' && job.tenantId && job.tenantId !== user.tenantId) {
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

// Update job schedule (vega_admin only)
router.patch("/:jobId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can update job schedules" });
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

router.post("/:jobId/run", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can manually trigger jobs" });
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

router.post("/:jobId/pause", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can pause jobs" });
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
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can resume jobs" });
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
    if (!user || (user.role !== 'vega_admin' && user.role !== 'tenant_admin')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const run = await storage.getJobRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    if (user.role !== 'vega_admin') {
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
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can kill job runs" });
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
    if (!user || user.role !== 'vega_admin') {
      return res.status(403).json({ error: "Only Vega admins can view stuck runs" });
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
