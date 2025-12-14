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
    
    // Provide user-friendly error messages for common issues
    let userMessage = 'Failed to sync Planner data';
    let statusCode = 500;
    
    if (error.message?.includes('No valid access token') || 
        error.message?.includes('accessToken is null')) {
      userMessage = 'Your Planner connection has expired. Please reconnect by clicking "Connect Microsoft Planner" in Settings.';
      statusCode = 401;
    } else if (error.code === 'InvalidAuthenticationToken' ||
               error.statusCode === 401) {
      userMessage = 'Your Planner authorization has expired. Please reconnect in Settings.';
      statusCode = 401;
    } else if (error.code === 'Authorization_RequestDenied' ||
               error.statusCode === 403) {
      userMessage = 'Access denied. Please ensure you have permission to access Planner in your Microsoft 365 account.';
      statusCode = 403;
    } else if (error.code === 'Request_ResourceNotFound') {
      userMessage = 'No Planner plans found. Make sure you have access to at least one Planner plan in Microsoft 365.';
      statusCode = 404;
    }
    
    res.status(statusCode).json({ 
      error: userMessage,
      message: error.message,
      reconnectRequired: statusCode === 401
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

// ===== Planner Progress Mapping Endpoints =====

// Set or update Planner mapping for a Key Result
router.put('/mapping/keyresult/:keyResultId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { keyResultId } = req.params;
    const { plannerPlanId, plannerBucketId, plannerSyncEnabled } = req.body;
    
    const keyResult = await storage.getKeyResultById(keyResultId);
    if (!keyResult || keyResult.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If enabling sync, validate the plan/bucket belong to this tenant
    if (plannerPlanId) {
      const plan = await storage.getPlannerPlanById(plannerPlanId);
      if (!plan || plan.tenantId !== tenantId) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }
      
      if (plannerBucketId) {
        const bucket = await storage.getPlannerBucketById(plannerBucketId);
        if (!bucket || bucket.planId !== plannerPlanId) {
          return res.status(400).json({ error: 'Invalid bucket ID' });
        }
      }
    }

    const updated = await storage.updateKeyResult(keyResultId, {
      plannerPlanId: plannerPlanId || null,
      plannerBucketId: plannerBucketId || null,
      plannerSyncEnabled: plannerSyncEnabled ?? false,
    });

    res.json({ success: true, keyResult: updated });
  } catch (error: any) {
    console.error('[Planner API] Set KR mapping error:', error);
    res.status(500).json({ error: 'Failed to set Planner mapping', message: error.message });
  }
});

// Set or update Planner mapping for a Big Rock
router.put('/mapping/bigrock/:bigRockId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId } = req.params;
    const { plannerPlanId, plannerBucketId, plannerSyncEnabled } = req.body;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If enabling sync, validate the plan/bucket belong to this tenant
    if (plannerPlanId) {
      const plan = await storage.getPlannerPlanById(plannerPlanId);
      if (!plan || plan.tenantId !== tenantId) {
        return res.status(400).json({ error: 'Invalid plan ID' });
      }
      
      if (plannerBucketId) {
        const bucket = await storage.getPlannerBucketById(plannerBucketId);
        if (!bucket || bucket.planId !== plannerPlanId) {
          return res.status(400).json({ error: 'Invalid bucket ID' });
        }
      }
    }

    const updated = await storage.updateBigRock(bigRockId, {
      plannerPlanId: plannerPlanId || null,
      plannerBucketId: plannerBucketId || null,
      plannerSyncEnabled: plannerSyncEnabled ?? false,
    });

    res.json({ success: true, bigRock: updated });
  } catch (error: any) {
    console.error('[Planner API] Set Big Rock mapping error:', error);
    res.status(500).json({ error: 'Failed to set Planner mapping', message: error.message });
  }
});

// Calculate and sync progress for a Key Result from Planner
router.post('/mapping/keyresult/:keyResultId/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const userId = req.user!.id;
    const { keyResultId } = req.params;
    
    const keyResult = await storage.getKeyResultById(keyResultId);
    if (!keyResult || keyResult.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!keyResult.plannerPlanId) {
      return res.status(400).json({ error: 'No Planner mapping configured' });
    }

    // Calculate progress from tasks in the mapped plan/bucket
    const progress = await calculatePlannerProgress(
      keyResult.plannerPlanId, 
      keyResult.plannerBucketId || null,
      tenantId
    );

    // Update key result with calculated progress
    const updated = await storage.updateKeyResult(keyResultId, {
      progress: progress.percentage,
      plannerLastSyncAt: new Date(),
      plannerSyncError: null,
    });

    res.json({ 
      success: true, 
      progress: progress.percentage,
      totalTasks: progress.totalTasks,
      completedTasks: progress.completedTasks,
      keyResult: updated
    });
  } catch (error: any) {
    console.error('[Planner API] Sync KR progress error:', error);
    // Store the error for display
    await storage.updateKeyResult(req.params.keyResultId, {
      plannerSyncError: error.message,
      plannerLastSyncAt: new Date(),
    }).catch(() => {});
    res.status(500).json({ error: 'Failed to sync progress', message: error.message });
  }
});

// Calculate and sync progress for a Big Rock from Planner
router.post('/mapping/bigrock/:bigRockId/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const userId = req.user!.id;
    const { bigRockId } = req.params;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bigRock.plannerPlanId) {
      return res.status(400).json({ error: 'No Planner mapping configured' });
    }

    // Calculate progress from tasks in the mapped plan/bucket
    const progress = await calculatePlannerProgress(
      bigRock.plannerPlanId, 
      bigRock.plannerBucketId || null,
      tenantId
    );

    // Update big rock with calculated progress
    const updated = await storage.updateBigRock(bigRockId, {
      completionPercentage: Math.round(progress.percentage),
      plannerLastSyncAt: new Date(),
      plannerSyncError: null,
    });

    res.json({ 
      success: true, 
      progress: progress.percentage,
      totalTasks: progress.totalTasks,
      completedTasks: progress.completedTasks,
      bigRock: updated
    });
  } catch (error: any) {
    console.error('[Planner API] Sync Big Rock progress error:', error);
    // Store the error for display
    await storage.updateBigRock(req.params.bigRockId, {
      plannerSyncError: error.message,
      plannerLastSyncAt: new Date(),
    }).catch(() => {});
    res.status(500).json({ error: 'Failed to sync progress', message: error.message });
  }
});

// Helper function to calculate progress from Planner tasks
async function calculatePlannerProgress(
  planId: string, 
  bucketId: string | null,
  tenantId: string
): Promise<{ percentage: number; totalTasks: number; completedTasks: number }> {
  // Get all tasks from the plan or specific bucket
  let tasks;
  if (bucketId) {
    tasks = await storage.getPlannerTasksByBucketId(bucketId);
  } else {
    tasks = await storage.getPlannerTasksByPlanId(planId);
  }

  if (!tasks || tasks.length === 0) {
    return { percentage: 0, totalTasks: 0, completedTasks: 0 };
  }

  // Count completed tasks (percentComplete === 100)
  const completedTasks = tasks.filter(t => t.percentComplete === 100).length;
  const totalTasks = tasks.length;
  const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
    totalTasks,
    completedTasks
  };
}

// Get Planner progress summary for a Key Result
router.get('/mapping/keyresult/:keyResultId/progress', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { keyResultId } = req.params;
    
    const keyResult = await storage.getKeyResultById(keyResultId);
    if (!keyResult || keyResult.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!keyResult.plannerPlanId) {
      return res.json({ mapped: false });
    }

    const plan = await storage.getPlannerPlanById(keyResult.plannerPlanId);
    const bucket = keyResult.plannerBucketId 
      ? await storage.getPlannerBucketById(keyResult.plannerBucketId) 
      : null;

    const progress = await calculatePlannerProgress(
      keyResult.plannerPlanId,
      keyResult.plannerBucketId || null,
      tenantId
    );

    res.json({
      mapped: true,
      planId: keyResult.plannerPlanId,
      planTitle: plan?.title || 'Unknown Plan',
      bucketId: keyResult.plannerBucketId,
      bucketName: bucket?.name || null,
      syncEnabled: keyResult.plannerSyncEnabled,
      lastSyncAt: keyResult.plannerLastSyncAt,
      syncError: keyResult.plannerSyncError,
      ...progress
    });
  } catch (error: any) {
    console.error('[Planner API] Get KR progress error:', error);
    res.status(500).json({ error: 'Failed to get progress', message: error.message });
  }
});

// Get Planner progress summary for a Big Rock
router.get('/mapping/bigrock/:bigRockId/progress', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId } = req.params;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bigRock.plannerPlanId) {
      return res.json({ mapped: false });
    }

    const plan = await storage.getPlannerPlanById(bigRock.plannerPlanId);
    const bucket = bigRock.plannerBucketId 
      ? await storage.getPlannerBucketById(bigRock.plannerBucketId) 
      : null;

    const progress = await calculatePlannerProgress(
      bigRock.plannerPlanId,
      bigRock.plannerBucketId || null,
      tenantId
    );

    res.json({
      mapped: true,
      planId: bigRock.plannerPlanId,
      planTitle: plan?.title || 'Unknown Plan',
      bucketId: bigRock.plannerBucketId,
      bucketName: bucket?.name || null,
      syncEnabled: bigRock.plannerSyncEnabled,
      lastSyncAt: bigRock.plannerLastSyncAt,
      syncError: bigRock.plannerSyncError,
      ...progress
    });
  } catch (error: any) {
    console.error('[Planner API] Get Big Rock progress error:', error);
    res.status(500).json({ error: 'Failed to get progress', message: error.message });
  }
});

export const plannerRouter = router;
