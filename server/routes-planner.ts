import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { 
  syncAllPlannerData,
  syncPlannerPlans,
  syncPlannerBuckets,
  syncPlannerTasks,
  createPlannerTask,
  updatePlannerTaskProgress,
  getPlannerIntegrationStatus,
  getTeamsForUser,
  getChannelsForTeam,
  createPlanInTeam,
  addPlannerTabToChannel,
  createBucketInPlan,
  createPlannerTaskFromBigRockTask,
  updatePlannerTaskFromBigRockTask,
  deletePlannerTaskForBigRockTask,
  syncPlannerTasksToBigRockTasks,
  resolveGraphAssignmentsToEmails,
  calculatePlannerProgress,
} from './services/graph-planner';
import { isPlannerConfigured } from './services/planner-auth';
import { hasPermission, PERMISSIONS, Role } from '@shared/rbac';

const router = Router();

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
    const tenantId = req.effectiveTenantId!;
    const status = await getPlannerIntegrationStatus(tenantId);
    res.json(status);
  } catch (error) {
    console.error('[Planner API] Status error:', error);
    res.status(500).json({ error: 'Failed to get Planner status' });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;

    if (!isPlannerConfigured()) {
      return res.status(503).json({ 
        error: 'Microsoft Planner integration is not configured. Please contact your administrator.',
        configured: false
      });
    }

    const result = await syncAllPlannerData(tenantId);
    
    res.json({
      success: true,
      planCount: result.plans.length,
      bucketCount: result.buckets.length,
      taskCount: result.tasks.length,
    });
  } catch (error: any) {
    console.error('[Planner API] Sync error:', error);
    
    let userMessage = 'Failed to sync Planner data';
    let statusCode = 500;
    
    if (error.message?.includes('not configured')) {
      userMessage = 'Planner integration is not configured. Please contact your administrator to set up the Azure AD app registration.';
      statusCode = 503;
    } else if (error.message?.includes('Failed to get access token')) {
      userMessage = 'Could not authenticate with Microsoft Graph. Please verify the Planner credentials are correct.';
      statusCode = 401;
    } else if (error.code === 'Authorization_RequestDenied' ||
               error.statusCode === 403) {
      userMessage = 'Access denied. The Azure AD app may need additional permissions (Group.Read.All, Tasks.ReadWrite.All).';
      statusCode = 403;
    } else if (error.code === 'Request_ResourceNotFound') {
      userMessage = 'No Planner plans found accessible to this integration.';
      statusCode = 404;
    }
    
    res.status(statusCode).json({ 
      error: userMessage,
      message: error.message,
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
    const { taskId } = req.params;
    const { percentComplete } = req.body;
    
    if (typeof percentComplete !== 'number' || percentComplete < 0 || percentComplete > 100) {
      return res.status(400).json({ error: 'percentComplete must be a number between 0 and 100' });
    }

    const task = await updatePlannerTaskProgress(taskId, percentComplete);
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

router.put('/mapping/keyresult/:keyResultId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { keyResultId } = req.params;
    const { plannerPlanId, plannerBucketId, plannerSyncEnabled } = req.body;
    
    const keyResult = await storage.getKeyResultById(keyResultId);
    if (!keyResult || keyResult.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

router.put('/mapping/bigrock/:bigRockId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId } = req.params;
    const { plannerPlanId, plannerBucketId, plannerSyncEnabled } = req.body;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

    if (plannerPlanId && plannerSyncEnabled) {
      try {
        const plan = await storage.getPlannerPlanById(plannerPlanId);
        if (plan) {
          console.log('[Planner API] Running initial sync for newly mapped Big Rock:', bigRockId);
          await syncPlannerBuckets(tenantId, plan.id, plan.graphPlanId);
          await syncPlannerTasks(tenantId, plan.id, plan.graphPlanId);
          console.log('[Planner API] Initial sync complete for Big Rock:', bigRockId);
        }
      } catch (syncErr: any) {
        console.warn('[Planner API] Initial sync after mapping failed (non-blocking):', syncErr?.message);
      }
    }

    res.json({ success: true, bigRock: updated });
  } catch (error: any) {
    console.error('[Planner API] Set Big Rock mapping error:', error);
    res.status(500).json({ error: 'Failed to set Planner mapping', message: error.message });
  }
});

router.post('/mapping/keyresult/:keyResultId/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { keyResultId } = req.params;
    
    const keyResult = await storage.getKeyResultById(keyResultId);
    if (!keyResult || keyResult.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!keyResult.plannerPlanId) {
      return res.status(400).json({ error: 'No Planner mapping configured' });
    }

    const plan = await storage.getPlannerPlanById(keyResult.plannerPlanId);
    if (!plan) {
      return res.status(400).json({ error: 'Mapped plan not found. Please re-configure Planner mapping.' });
    }

    console.log('[Planner API] Refreshing tasks from Microsoft Graph for plan:', plan.title);
    
    try {
      await syncPlannerTasks(tenantId!, plan.id, plan.graphPlanId);
      console.log('[Planner API] Successfully refreshed tasks from Microsoft Graph');
    } catch (syncError: any) {
      console.error('[Planner API] Failed to refresh tasks from Graph:', syncError);
      if (syncError.message?.includes('not configured')) {
        return res.status(503).json({ 
          error: 'Planner integration is not configured. Please contact your administrator.',
        });
      }
      console.warn('[Planner API] Proceeding with potentially stale local data');
    }

    const progress = await calculatePlannerProgress(
      keyResult.plannerPlanId, 
      keyResult.plannerBucketId || null,
      tenantId!
    );

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
    await storage.updateKeyResult(req.params.keyResultId, {
      plannerSyncError: error.message,
      plannerLastSyncAt: new Date(),
    }).catch(() => {});
    res.status(500).json({ error: 'Failed to sync progress', message: error.message });
  }
});

router.post('/mapping/bigrock/:bigRockId/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    const { bigRockId } = req.params;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bigRock.plannerPlanId) {
      return res.status(400).json({ error: 'No Planner mapping configured' });
    }

    const plan = await storage.getPlannerPlanById(bigRock.plannerPlanId);
    if (!plan) {
      return res.status(400).json({ error: 'Mapped plan not found. Please re-configure Planner mapping.' });
    }

    console.log('[Planner API] Refreshing tasks from Microsoft Graph for plan:', plan.title);
    
    let syncWarning: string | null = null;
    try {
      await syncPlannerBuckets(tenantId!, plan.id, plan.graphPlanId);
      await syncPlannerTasks(tenantId!, plan.id, plan.graphPlanId);
      console.log('[Planner API] Successfully refreshed buckets and tasks from Microsoft Graph');
    } catch (syncError: any) {
      console.error('[Planner API] Failed to refresh from Graph:', syncError);
      if (syncError.message?.includes('not configured')) {
        return res.status(503).json({ 
          error: 'Planner integration is not configured. Please contact your administrator.',
        });
      }
      syncWarning = 'Could not reach Microsoft Graph. Showing locally cached data.';
      console.warn('[Planner API] Proceeding with potentially stale local data');
    }

    const progress = await calculatePlannerProgress(
      bigRock.plannerPlanId, 
      bigRock.plannerBucketId || null,
      tenantId!
    );

    const updated = await storage.updateBigRock(bigRockId, {
      completionPercentage: Math.round(progress.percentage || 0),
      plannerLastSyncAt: new Date(),
      plannerSyncError: syncWarning,
    });

    res.json({ 
      success: true, 
      progress: progress.percentage || 0,
      totalTasks: progress.totalTasks || 0,
      completedTasks: progress.completedTasks || 0,
      syncWarning,
      bigRock: updated
    });
  } catch (error: any) {
    console.error('[Planner API] Sync Big Rock progress error:', error);
    await storage.updateBigRock(req.params.bigRockId, {
      plannerSyncError: error.message,
      plannerLastSyncAt: new Date(),
    }).catch(() => {});
    res.status(500).json({ error: 'Failed to sync progress', message: error.message });
  }
});

router.get('/mapping/keyresult/:keyResultId', async (req: Request, res: Response) => {
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
      tenantId!
    );

    res.json({
      mapped: true,
      planId: keyResult.plannerPlanId,
      planTitle: plan?.title,
      bucketId: keyResult.plannerBucketId,
      bucketName: bucket?.name,
      syncEnabled: keyResult.plannerSyncEnabled,
      lastSyncAt: keyResult.plannerLastSyncAt,
      syncError: keyResult.plannerSyncError,
      progress: progress.percentage,
      totalTasks: progress.totalTasks,
      completedTasks: progress.completedTasks,
    });
  } catch (error: any) {
    console.error('[Planner API] Get KR mapping error:', error);
    res.status(500).json({ error: 'Failed to get Planner mapping', message: error.message });
  }
});

router.get('/mapping/bigrock/:bigRockId', async (req: Request, res: Response) => {
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
      tenantId!
    );

    res.json({
      mapped: true,
      planId: bigRock.plannerPlanId,
      planTitle: plan?.title,
      bucketId: bigRock.plannerBucketId,
      bucketName: bucket?.name,
      syncEnabled: bigRock.plannerSyncEnabled,
      lastSyncAt: bigRock.plannerLastSyncAt,
      syncError: bigRock.plannerSyncError,
      progress: progress.percentage || 0,
      totalTasks: progress.totalTasks || 0,
      completedTasks: progress.completedTasks || 0,
    });
  } catch (error: any) {
    console.error('[Planner API] Get Big Rock mapping error:', error);
    res.status(500).json({ error: 'Failed to get Planner mapping', message: error.message });
  }
});

// ===== Teams / Channels / Plan Creation =====

router.get('/teams', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const teams = await getTeamsForUser(tenantId);
    res.json(teams);
  } catch (error: any) {
    console.error('[Planner API] Get teams error:', error);
    res.status(500).json({ error: 'Failed to get teams', message: error.message });
  }
});

router.get('/teams/:teamId/channels', async (req: Request, res: Response) => {
  try {
    const channels = await getChannelsForTeam(req.params.teamId);
    res.json(channels);
  } catch (error: any) {
    console.error('[Planner API] Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels', message: error.message });
  }
});

router.post('/teams/:teamId/plans', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const { teamId } = req.params;
    const { title, channelId, bucketName } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Plan title is required' });
    }

    const plan = await createPlanInTeam(tenantId, teamId, title);

    let syncedBuckets;
    try {
      syncedBuckets = await syncPlannerBuckets(tenantId, plan.id, plan.graphPlanId);
    } catch (bucketSyncErr) {
      console.warn('[Planner API] Failed to sync buckets after plan creation:', bucketSyncErr);
      try {
        syncedBuckets = await syncPlannerBuckets(tenantId, plan.id, plan.graphPlanId);
      } catch (retryErr) {
        console.warn('[Planner API] Retry also failed:', retryErr);
      }
    }

    let tabCreated = false;
    if (channelId) {
      try {
        await addPlannerTabToChannel(teamId, channelId, plan.graphPlanId, title);
        tabCreated = true;
      } catch (tabErr: any) {
        console.warn('[Planner API] Tab creation failed (non-blocking):', tabErr.message);
      }
    }

    let bucket = null;
    if (bucketName) {
      try {
        bucket = await createBucketInPlan(tenantId, plan.id, bucketName);
      } catch (bucketErr: any) {
        console.warn('[Planner API] Custom bucket creation failed:', bucketErr.message);
      }
    }

    res.json({ 
      success: true, 
      plan,
      buckets: syncedBuckets || [],
      customBucket: bucket,
      tabCreated,
    });
  } catch (error: any) {
    console.error('[Planner API] Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});

// ===== Big Rock Task Bidirectional Sync =====

router.post('/bigrock-tasks/:bigRockId/sync', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const { bigRockId } = req.params;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bigRock.plannerPlanId) {
      return res.status(400).json({ error: 'Big Rock has no Planner mapping' });
    }

    const plan = await storage.getPlannerPlanById(bigRock.plannerPlanId);
    if (!plan) {
      return res.status(400).json({ error: 'Mapped Planner plan not found' });
    }

    await syncPlannerTasks(tenantId, plan.id, plan.graphPlanId);

    const existingBRTasks = await storage.getBigRockTasksByBigRockId(bigRockId);
    for (const brt of existingBRTasks) {
      if (brt.plannerTaskId) {
        try {
          await updatePlannerTaskFromBigRockTask(brt);
        } catch (err: any) {
          console.warn(`[Planner API] Failed to push task "${brt.title}" to Planner:`, err.message);
        }
      } else if (bigRock.plannerSyncEnabled) {
        try {
          await createPlannerTaskFromBigRockTask(brt, bigRock.plannerPlanId, bigRock.plannerBucketId || null);
        } catch (err: any) {
          console.warn(`[Planner API] Failed to create Planner task for "${brt.title}":`, err.message);
        }
      }
    }

    const syncResult = await syncPlannerTasksToBigRockTasks(
      bigRockId, tenantId, bigRock.plannerPlanId, bigRock.plannerBucketId || null
    );

    res.json({
      success: true,
      ...syncResult,
    });
  } catch (error: any) {
    console.error('[Planner API] Big Rock task sync error:', error);
    res.status(500).json({ error: 'Failed to sync tasks', message: error.message });
  }
});

router.post('/bigrock-tasks/:bigRockId/push', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const { bigRockId } = req.params;
    const { taskId } = req.body;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bigRock.plannerPlanId) {
      return res.status(400).json({ error: 'Big Rock has no Planner mapping' });
    }

    const task = await storage.getBigRockTaskById(taskId);
    if (!task || task.bigRockId !== bigRockId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.plannerTaskId) {
      await updatePlannerTaskFromBigRockTask(task);
      res.json({ success: true, action: 'updated' });
    } else {
      const plannerTask = await createPlannerTaskFromBigRockTask(
        task, bigRock.plannerPlanId, bigRock.plannerBucketId || null
      );
      res.json({ success: true, action: 'created', plannerTask });
    }
  } catch (error: any) {
    console.error('[Planner API] Push task error:', error);
    res.status(500).json({ error: 'Failed to push task to Planner', message: error.message });
  }
});

router.delete('/bigrock-tasks/:bigRockId/planner/:taskId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const { bigRockId, taskId } = req.params;
    
    const bigRock = await storage.getBigRockById(bigRockId);
    if (!bigRock || bigRock.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const task = await storage.getBigRockTaskById(taskId);
    if (!task || task.bigRockId !== bigRockId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.plannerTaskId) {
      await deletePlannerTaskForBigRockTask(task.plannerTaskId);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Planner API] Delete Planner task error:', error);
    res.status(500).json({ error: 'Failed to delete Planner task', message: error.message });
  }
});

export { router as plannerRouter };
export default router;
