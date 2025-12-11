import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { 
  syncAllPlannerData,
  syncPlannerPlans,
  syncPlannerBuckets,
  syncPlannerTasks,
  createPlannerTask,
  updatePlannerTaskProgress,
  getPlannerIntegrationStatus
} from './services/graph-planner';
import { hasPermission, PERMISSIONS, Role } from '@shared/rbac';

const router = Router();

// Note: All routes are protected by authWithTenant middleware at the router level
// These ownership validators ensure tenant-scoped data access

async function validatePlanOwnership(req: Request, res: Response, next: NextFunction) {
  const { planId } = req.params;
  if (!planId) return next();

  const tenantId = req.effectiveTenantId;
  const plan = await storage.getPlannerPlanById(planId);
  
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  if (plan.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied to this plan' });
  }

  (req as any).plan = plan;
  next();
}

async function validateBucketOwnership(req: Request, res: Response, next: NextFunction) {
  const { bucketId } = req.params;
  if (!bucketId) return next();

  const tenantId = req.effectiveTenantId;
  const bucket = await storage.getPlannerBucketById(bucketId);
  
  if (!bucket) {
    return res.status(404).json({ error: 'Bucket not found' });
  }

  const plan = await storage.getPlannerPlanById(bucket.planId);
  if (!plan || plan.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied to this bucket' });
  }

  (req as any).bucket = bucket;
  next();
}

async function validateTaskOwnership(req: Request, res: Response, next: NextFunction) {
  const { taskId } = req.params;
  if (!taskId) return next();

  const tenantId = req.effectiveTenantId;
  const task = await storage.getPlannerTaskById(taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied to this task' });
  }

  (req as any).task = task;
  next();
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await getPlannerIntegrationStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[Planner API] Status error:', error);
    res.status(500).json({ error: 'Failed to get Planner status' });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.effectiveTenantId!;

    const result = await syncAllPlannerData(userId, tenantId);
    
    res.json({
      success: true,
      planCount: result.plans.length,
      bucketCount: result.buckets.length,
      taskCount: result.tasks.length,
    });
  } catch (error: any) {
    console.error('[Planner API] Sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync Planner data',
      message: error.message 
    });
  }
});

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const plans = await storage.getPlannerPlansByTenantId(tenantId);
    res.json(plans);
  } catch (error) {
    console.error('[Planner API] Get plans error:', error);
    res.status(500).json({ error: 'Failed to get Planner plans' });
  }
});

router.get('/plans/:planId', validatePlanOwnership, async (req: Request, res: Response) => {
  try {
    res.json((req as any).plan);
  } catch (error) {
    console.error('[Planner API] Get plan error:', error);
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

router.get('/plans/:planId/buckets', validatePlanOwnership, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const buckets = await storage.getPlannerBucketsByPlanId(planId);
    res.json(buckets);
  } catch (error) {
    console.error('[Planner API] Get buckets error:', error);
    res.status(500).json({ error: 'Failed to get buckets' });
  }
});

router.get('/plans/:planId/tasks', validatePlanOwnership, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const tasks = await storage.getPlannerTasksByPlanId(planId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

router.get('/buckets/:bucketId/tasks', validateBucketOwnership, async (req: Request, res: Response) => {
  try {
    const { bucketId } = req.params;
    const tasks = await storage.getPlannerTasksByBucketId(bucketId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get bucket tasks error:', error);
    res.status(500).json({ error: 'Failed to get bucket tasks' });
  }
});

router.get('/tasks/:taskId', validateTaskOwnership, async (req: Request, res: Response) => {
  try {
    res.json((req as any).task);
  } catch (error) {
    console.error('[Planner API] Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.effectiveTenantId;
    const { planId, bucketId, title, dueDate } = req.body;
    
    if (!planId || !bucketId || !title) {
      return res.status(400).json({ error: 'planId, bucketId, and title are required' });
    }

    const plan = await storage.getPlannerPlanById(planId);
    if (!plan || plan.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this plan' });
    }

    const task = await createPlannerTask(
      userId, 
      planId, 
      bucketId, 
      title, 
      dueDate ? new Date(dueDate) : undefined
    );
    
    res.json(task);
  } catch (error: any) {
    console.error('[Planner API] Create task error:', error);
    res.status(500).json({ 
      error: 'Failed to create task',
      message: error.message 
    });
  }
});

router.patch('/tasks/:taskId/progress', validateTaskOwnership, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const { percentComplete } = req.body;
    
    if (typeof percentComplete !== 'number' || percentComplete < 0 || percentComplete > 100) {
      return res.status(400).json({ error: 'percentComplete must be a number between 0 and 100' });
    }

    const task = await updatePlannerTaskProgress(userId, taskId, percentComplete);
    res.json(task);
  } catch (error: any) {
    console.error('[Planner API] Update task progress error:', error);
    res.status(500).json({ 
      error: 'Failed to update task progress',
      message: error.message 
    });
  }
});

router.post('/link/objective/:objectiveId/task/:taskId', validateTaskOwnership, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.effectiveTenantId;
    const { objectiveId, taskId } = req.params;
    
    const objective = await storage.getOkrById(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    if (objective.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this objective' });
    }

    await storage.linkPlannerTaskToObjective(taskId, objectiveId, tenantId, userId);
    res.json({ success: true, objectiveId, taskId });
  } catch (error: any) {
    console.error('[Planner API] Link objective error:', error);
    res.status(500).json({ 
      error: 'Failed to link objective to task',
      message: error.message 
    });
  }
});

router.delete('/link/objective/:objectiveId/task/:taskId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { objectiveId, taskId } = req.params;

    const objective = await storage.getOkrById(objectiveId);
    if (!objective || objective.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await storage.unlinkPlannerTaskFromObjective(taskId, objectiveId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Planner API] Unlink objective error:', error);
    res.status(500).json({ 
      error: 'Failed to unlink objective from task',
      message: error.message 
    });
  }
});

router.get('/objectives/:objectiveId/tasks', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { objectiveId } = req.params;
    
    const objective = await storage.getOkrById(objectiveId);
    if (!objective || objective.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await storage.getPlannerTasksLinkedToObjective(objectiveId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get objective tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks for objective' });
  }
});

router.post('/link/bigrock/:bigRockId/task/:taskId', validateTaskOwnership, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.effectiveTenantId;
    const { bigRockId, taskId } = req.params;
    
    const bigRock = await storage.getOkrById(bigRockId);
    if (!bigRock) {
      return res.status(404).json({ error: 'Big Rock not found' });
    }

    if (bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this big rock' });
    }

    await storage.linkPlannerTaskToBigRock(taskId, bigRockId, tenantId, userId);
    res.json({ success: true, bigRockId, taskId });
  } catch (error: any) {
    console.error('[Planner API] Link big rock error:', error);
    res.status(500).json({ 
      error: 'Failed to link big rock to task',
      message: error.message 
    });
  }
});

router.delete('/link/bigrock/:bigRockId/task/:taskId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId, taskId } = req.params;
    
    const bigRock = await storage.getOkrById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await storage.unlinkPlannerTaskFromBigRock(taskId, bigRockId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Planner API] Unlink big rock error:', error);
    res.status(500).json({ 
      error: 'Failed to unlink big rock from task',
      message: error.message 
    });
  }
});

router.get('/bigrocks/:bigRockId/tasks', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId } = req.params;
    
    const bigRock = await storage.getOkrById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tasks = await storage.getPlannerTasksLinkedToBigRock(bigRockId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get big rock tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks for big rock' });
  }
});

export const plannerRouter = router;
