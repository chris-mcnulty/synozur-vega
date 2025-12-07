import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication, OnBehalfOfRequest } from '@azure/msal-node';
import { storage } from '../storage';
import type { 
  PlannerPlan, 
  PlannerBucket, 
  PlannerTask,
  InsertPlannerPlan,
  InsertPlannerBucket,
  InsertPlannerTask 
} from '../../shared/schema';

const PLANNER_SCOPES = [
  'Tasks.ReadWrite',
  'Group.Read.All',
];

interface GraphPlannerPlan {
  id: string;
  title: string;
  createdDateTime: string;
  owner: string;
  container?: {
    containerId: string;
    type: string;
    url: string;
  };
}

interface GraphPlannerBucket {
  id: string;
  name: string;
  orderHint: string;
  planId: string;
}

interface GraphPlannerTask {
  id: string;
  planId: string;
  bucketId: string;
  title: string;
  percentComplete: number;
  priority: number;
  startDateTime?: string;
  dueDateTime?: string;
  completedDateTime?: string;
  createdDateTime: string;
  orderHint: string;
  assignments?: Record<string, { assignedBy: { user: { id: string } } }>;
}

function getMsalClient(): ConfidentialClientApplication | null {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return null;
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
  });
}

async function getAccessToken(userId: string): Promise<string | null> {
  const graphToken = await storage.getGraphToken(userId);
  if (!graphToken) {
    console.warn(`[Graph Planner] No token found for user ${userId}`);
    return null;
  }

  if (graphToken.expiresAt && new Date(graphToken.expiresAt) > new Date()) {
    return graphToken.accessToken;
  }

  if (graphToken.refreshToken) {
    try {
      const msalClient = getMsalClient();
      if (!msalClient) {
        return null;
      }

      const refreshRequest = {
        refreshToken: graphToken.refreshToken,
        scopes: PLANNER_SCOPES,
      };

      const response = await msalClient.acquireTokenByRefreshToken(refreshRequest);
      if (response) {
        await storage.upsertGraphToken({
          userId,
          tenantId: graphToken.tenantId,
          accessToken: response.accessToken,
          refreshToken: (response as any).refreshToken || graphToken.refreshToken,
          expiresAt: response.expiresOn ? new Date(response.expiresOn) : null,
          scopes: graphToken.scopes,
        });
        return response.accessToken;
      }
    } catch (error) {
      console.error(`[Graph Planner] Token refresh failed for user ${userId}:`, error);
    }
  }

  return graphToken.accessToken;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function syncPlannerPlans(userId: string, tenantId: string): Promise<PlannerPlan[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);
  
  try {
    const response = await client.api('/me/planner/plans').get();
    const graphPlans: GraphPlannerPlan[] = response.value || [];

    const syncedPlans: PlannerPlan[] = [];

    for (const graphPlan of graphPlans) {
      const planData: InsertPlannerPlan = {
        tenantId,
        graphPlanId: graphPlan.id,
        title: graphPlan.title,
        owner: graphPlan.owner,
        graphGroupId: graphPlan.container?.containerId || null,
      };

      const plan = await storage.upsertPlannerPlan(planData);
      syncedPlans.push(plan);
    }

    return syncedPlans;
  } catch (error) {
    console.error('[Graph Planner] Failed to sync plans:', error);
    throw error;
  }
}

export async function syncPlannerBuckets(
  userId: string, 
  tenantId: string, 
  planId: string,
  graphPlanId: string
): Promise<PlannerBucket[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);

  try {
    const response = await client.api(`/planner/plans/${graphPlanId}/buckets`).get();
    const graphBuckets: GraphPlannerBucket[] = response.value || [];

    const syncedBuckets: PlannerBucket[] = [];

    for (const graphBucket of graphBuckets) {
      const bucketData: InsertPlannerBucket = {
        tenantId,
        planId,
        graphBucketId: graphBucket.id,
        name: graphBucket.name,
        orderHint: graphBucket.orderHint,
      };

      const bucket = await storage.upsertPlannerBucket(bucketData);
      syncedBuckets.push(bucket);
    }

    return syncedBuckets;
  } catch (error) {
    console.error('[Graph Planner] Failed to sync buckets:', error);
    throw error;
  }
}

export async function syncPlannerTasks(
  userId: string,
  tenantId: string,
  planId: string,
  graphPlanId: string
): Promise<PlannerTask[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);

  try {
    const response = await client.api(`/planner/plans/${graphPlanId}/tasks`).get();
    const graphTasks: GraphPlannerTask[] = response.value || [];

    const syncedTasks: PlannerTask[] = [];
    const bucketMap = new Map<string, string>();
    
    const buckets = await storage.getPlannerBucketsByPlanId(planId);
    buckets.forEach(b => bucketMap.set(b.graphBucketId, b.id));

    for (const graphTask of graphTasks) {
      const bucketId = bucketMap.get(graphTask.bucketId);
      if (!bucketId) continue;

      const assignments = graphTask.assignments 
        ? Object.fromEntries(
            Object.entries(graphTask.assignments).map(([userId, data]) => [
              userId,
              { assignedBy: data.assignedBy?.user?.id || '', assignedDateTime: new Date().toISOString() }
            ])
          )
        : {};

      const taskData: InsertPlannerTask = {
        tenantId,
        planId,
        bucketId,
        graphTaskId: graphTask.id,
        title: graphTask.title,
        percentComplete: graphTask.percentComplete,
        priority: graphTask.priority,
        startDateTime: graphTask.startDateTime ? new Date(graphTask.startDateTime) : null,
        dueDateTime: graphTask.dueDateTime ? new Date(graphTask.dueDateTime) : null,
        completedDateTime: graphTask.completedDateTime ? new Date(graphTask.completedDateTime) : null,
        assignments,
      };

      const task = await storage.upsertPlannerTask(taskData);
      syncedTasks.push(task);
    }

    return syncedTasks;
  } catch (error) {
    console.error('[Graph Planner] Failed to sync tasks:', error);
    throw error;
  }
}

export async function syncAllPlannerData(userId: string, tenantId: string): Promise<{
  plans: PlannerPlan[];
  buckets: PlannerBucket[];
  tasks: PlannerTask[];
}> {
  const plans = await syncPlannerPlans(userId, tenantId);
  
  const allBuckets: PlannerBucket[] = [];
  const allTasks: PlannerTask[] = [];

  for (const plan of plans) {
    const buckets = await syncPlannerBuckets(userId, tenantId, plan.id, plan.graphPlanId);
    allBuckets.push(...buckets);

    const tasks = await syncPlannerTasks(userId, tenantId, plan.id, plan.graphPlanId);
    allTasks.push(...tasks);
  }

  return { plans, buckets: allBuckets, tasks: allTasks };
}

export async function createPlannerTask(
  userId: string,
  planId: string,
  bucketId: string,
  title: string,
  dueDate?: Date
): Promise<PlannerTask | null> {
  const plan = await storage.getPlannerPlanById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const bucket = await storage.getPlannerBucketById(bucketId);
  if (!bucket) {
    throw new Error('Bucket not found');
  }

  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);

  try {
    const taskPayload: any = {
      planId: plan.graphPlanId,
      bucketId: bucket.graphBucketId,
      title,
    };

    if (dueDate) {
      taskPayload.dueDateTime = dueDate.toISOString();
    }

    const response = await client.api('/planner/tasks').post(taskPayload);

    const taskData: InsertPlannerTask = {
      tenantId: plan.tenantId,
      planId: plan.id,
      bucketId: bucket.id,
      graphTaskId: response.id,
      title: response.title,
      percentComplete: response.percentComplete || 0,
      priority: response.priority || 5,
      startDateTime: response.startDateTime ? new Date(response.startDateTime) : null,
      dueDateTime: response.dueDateTime ? new Date(response.dueDateTime) : null,
      completedDateTime: null,
      assignments: {},
    };

    return await storage.upsertPlannerTask(taskData);
  } catch (error) {
    console.error('[Graph Planner] Failed to create task:', error);
    throw error;
  }
}

export async function updatePlannerTaskProgress(
  userId: string,
  taskId: string,
  percentComplete: number
): Promise<PlannerTask | null> {
  const task = await storage.getPlannerTaskById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);

  try {
    const taskDetails = await client.api(`/planner/tasks/${task.graphTaskId}`).get();
    const etag = taskDetails['@odata.etag'];

    await client.api(`/planner/tasks/${task.graphTaskId}`)
      .header('If-Match', etag)
      .patch({ percentComplete });

    const updatedTask = await storage.getPlannerTaskById(taskId);
    if (!updatedTask) return null;
    
    return await storage.upsertPlannerTask({
      ...updatedTask,
      percentComplete,
      completedDateTime: percentComplete === 100 ? new Date() : null,
    });
  } catch (error) {
    console.error('[Graph Planner] Failed to update task progress:', error);
    throw error;
  }
}

export async function getPlannerIntegrationStatus(userId: string): Promise<{
  connected: boolean;
  planCount: number;
  taskCount: number;
  lastSyncAt: Date | null;
}> {
  const token = await storage.getGraphToken(userId);
  
  if (!token) {
    return { connected: false, planCount: 0, taskCount: 0, lastSyncAt: null };
  }

  const user = await storage.getUser(userId);
  if (!user?.tenantId) {
    return { connected: false, planCount: 0, taskCount: 0, lastSyncAt: null };
  }

  const plans = await storage.getPlannerPlansByTenantId(user.tenantId);
  let taskCount = 0;
  
  for (const plan of plans) {
    const tasks = await storage.getPlannerTasksByPlanId(plan.id);
    taskCount += tasks.length;
  }

  return {
    connected: true,
    planCount: plans.length,
    taskCount,
    lastSyncAt: token.lastUsedAt,
  };
}
