import { Router, Request, Response } from 'express';
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

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const status = await getPlannerIntegrationStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[Planner API] Status error:', error);
    res.status(500).json({ error: 'Failed to get Planner status' });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user?.tenantId) {
      return res.status(400).json({ error: 'User has no tenant' });
    }

    const result = await syncAllPlannerData(userId, user.tenantId);
    
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
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user?.tenantId) {
      return res.status(400).json({ error: 'User has no tenant' });
    }

    const plans = await storage.getPlannerPlansByTenantId(user.tenantId);
    res.json(plans);
  } catch (error) {
    console.error('[Planner API] Get plans error:', error);
    res.status(500).json({ error: 'Failed to get Planner plans' });
  }
});

router.get('/plans/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const plan = await storage.getPlannerPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    console.error('[Planner API] Get plan error:', error);
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

router.get('/plans/:planId/buckets', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const buckets = await storage.getPlannerBucketsByPlanId(planId);
    res.json(buckets);
  } catch (error) {
    console.error('[Planner API] Get buckets error:', error);
    res.status(500).json({ error: 'Failed to get buckets' });
  }
});

router.get('/plans/:planId/tasks', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const tasks = await storage.getPlannerTasksByPlanId(planId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

router.get('/buckets/:bucketId/tasks', async (req: Request, res: Response) => {
  try {
    const { bucketId } = req.params;
    const tasks = await storage.getPlannerTasksByBucketId(bucketId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get bucket tasks error:', error);
    res.status(500).json({ error: 'Failed to get bucket tasks' });
  }
});

router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await storage.getPlannerTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('[Planner API] Get task error:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { planId, bucketId, title, dueDate } = req.body;
    
    if (!planId || !bucketId || !title) {
      return res.status(400).json({ error: 'planId, bucketId, and title are required' });
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

router.patch('/tasks/:taskId/progress', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

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

router.post('/link/objective/:objectiveId/task/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    const { objectiveId, taskId } = req.params;
    
    const objective = await storage.getOkrById(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    const task = await storage.getPlannerTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await storage.linkPlannerTaskToObjective(taskId, objectiveId, objective.tenantId, userId);
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
    const { objectiveId, taskId } = req.params;
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
    const { objectiveId } = req.params;
    const tasks = await storage.getPlannerTasksLinkedToObjective(objectiveId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get objective tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks for objective' });
  }
});

router.post('/link/bigrock/:bigRockId/task/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    const { bigRockId, taskId } = req.params;
    
    const bigRock = await storage.getOkrById(bigRockId);
    if (!bigRock) {
      return res.status(404).json({ error: 'Big Rock not found' });
    }

    const task = await storage.getPlannerTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await storage.linkPlannerTaskToBigRock(taskId, bigRockId, bigRock.tenantId, userId);
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
    const { bigRockId, taskId } = req.params;
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
    const { bigRockId } = req.params;
    const tasks = await storage.getPlannerTasksLinkedToBigRock(bigRockId);
    res.json(tasks);
  } catch (error) {
    console.error('[Planner API] Get big rock tasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks for big rock' });
  }
});

export const plannerRouter = router;
