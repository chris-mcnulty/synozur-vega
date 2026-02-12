import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication, OnBehalfOfRequest } from '@azure/msal-node';
import { storage } from '../storage';
import { decryptToken, isEncrypted, encryptToken } from '../utils/encryption';
import type { 
  PlannerPlan, 
  PlannerBucket, 
  PlannerTask,
  BigRockTask,
  InsertPlannerPlan,
  InsertPlannerBucket,
  InsertPlannerTask 
} from '../../shared/schema';

const PLANNER_SCOPES = [
  'Tasks.ReadWrite',
  'Group.Read.All',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'TeamsTab.Create',
];

const BIG_ROCK_STATUS_TO_PERCENT: Record<string, number> = {
  open: 0,
  in_progress: 50,
  completed: 100,
};

const PERCENT_TO_BIG_ROCK_STATUS = (pct: number): string => {
  if (pct >= 100) return 'completed';
  if (pct > 0) return 'in_progress';
  return 'open';
};

const graphUserCache = new Map<string, { email: string; displayName: string; expiresAt: number }>();
const emailToGraphIdCache = new Map<string, { graphUserId: string; expiresAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

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

async function refreshTokenForUser(userId: string): Promise<string | null> {
  const graphToken = await storage.getGraphToken(userId, 'planner');
  if (!graphToken?.refreshToken) {
    console.warn(`[Graph Planner] No refresh token available for user ${userId}`);
    return null;
  }

  try {
    const msalClient = getMsalClient();
    if (!msalClient) return null;

    const decryptedRefresh = isEncrypted(graphToken.refreshToken) 
      ? decryptToken(graphToken.refreshToken) 
      : graphToken.refreshToken;

    const response = await msalClient.acquireTokenByRefreshToken({
      refreshToken: decryptedRefresh,
      scopes: PLANNER_SCOPES,
    });

    if (response) {
      const newRefreshToken = (response as any).refreshToken || decryptedRefresh;
      await storage.upsertGraphToken({
        userId,
        tenantId: graphToken.tenantId,
        accessToken: encryptToken(response.accessToken),
        refreshToken: encryptToken(newRefreshToken),
        expiresAt: response.expiresOn ? new Date(response.expiresOn) : null,
        scopes: graphToken.scopes,
        service: 'planner',
      });
      console.log(`[Graph Planner] Token refreshed successfully for user ${userId}`);
      return response.accessToken;
    }
  } catch (error) {
    console.error(`[Graph Planner] Token refresh failed for user ${userId}:`, error);
  }
  return null;
}

async function getAccessToken(userId: string, forceRefresh = false): Promise<string | null> {
  const graphToken = await storage.getGraphToken(userId, 'planner');
  if (!graphToken) {
    console.warn(`[Graph Planner] No token found for user ${userId}`);
    return null;
  }

  if (!graphToken.accessToken) {
    console.warn(`[Graph Planner] Token found but accessToken is null for user ${userId}`);
    return null;
  }

  const accessToken = isEncrypted(graphToken.accessToken) 
    ? decryptToken(graphToken.accessToken) 
    : graphToken.accessToken;

  if (!forceRefresh && graphToken.expiresAt && new Date(graphToken.expiresAt) > new Date()) {
    return accessToken;
  }

  const refreshed = await refreshTokenForUser(userId);
  if (refreshed) return refreshed;

  if (!forceRefresh && graphToken.expiresAt === null) {
    return accessToken;
  }

  return null;
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
    // Always sync buckets first so we have up-to-date bucket mappings
    // This prevents tasks from being silently dropped due to unknown buckets
    try {
      await syncPlannerBuckets(userId, tenantId, planId, graphPlanId);
    } catch (bucketSyncErr) {
      console.warn('[Graph Planner] Failed to pre-sync buckets before task sync:', bucketSyncErr);
    }

    const response = await client.api(`/planner/plans/${graphPlanId}/tasks`).get();
    const graphTasks: GraphPlannerTask[] = response.value || [];

    const syncedTasks: PlannerTask[] = [];
    const bucketMap = new Map<string, string>();
    
    const buckets = await storage.getPlannerBucketsByPlanId(planId);
    buckets.forEach(b => bucketMap.set(b.graphBucketId, b.id));

    for (const graphTask of graphTasks) {
      let bucketId = bucketMap.get(graphTask.bucketId);
      if (!bucketId) {
        console.warn(`[Graph Planner] Task "${graphTask.title}" has unknown bucket ${graphTask.bucketId}, skipping`);
        continue;
      }

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
  const token = await storage.getGraphToken(userId, 'planner');
  
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

// ============ Email-based People Resolution ============

export async function resolveGraphUserEmail(
  userId: string,
  graphUserId: string
): Promise<{ email: string; displayName: string } | null> {
  const cached = graphUserCache.get(graphUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return { email: cached.email, displayName: cached.displayName };
  }

  const accessToken = await getAccessToken(userId);
  if (!accessToken) return null;

  const client = getGraphClient(accessToken);

  try {
    const user = await client.api(`/users/${graphUserId}`)
      .select('mail,userPrincipalName,displayName')
      .get();

    const email = (user.mail || user.userPrincipalName || '').toLowerCase();
    const displayName = user.displayName || '';

    if (email) {
      graphUserCache.set(graphUserId, { email, displayName, expiresAt: Date.now() + CACHE_TTL });
    }

    return email ? { email, displayName } : null;
  } catch (error) {
    console.error(`[Graph Planner] Failed to resolve user ${graphUserId}:`, error);
    return null;
  }
}

export async function resolveEmailToGraphUserId(
  userId: string,
  email: string
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const cached = emailToGraphIdCache.get(normalizedEmail);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.graphUserId;
  }

  const accessToken = await getAccessToken(userId);
  if (!accessToken) return null;

  const client = getGraphClient(accessToken);

  try {
    const response = await client.api('/users')
      .filter(`tolower(mail) eq '${normalizedEmail}' or tolower(userPrincipalName) eq '${normalizedEmail}'`)
      .select('id,mail,userPrincipalName')
      .top(1)
      .get();

    const users = response.value || [];
    if (users.length > 0) {
      const graphId = users[0].id;
      emailToGraphIdCache.set(normalizedEmail, { graphUserId: graphId, expiresAt: Date.now() + CACHE_TTL });
      return graphId;
    }

    return null;
  } catch (error) {
    console.error(`[Graph Planner] Failed to resolve email ${normalizedEmail}:`, error);
    return null;
  }
}

export async function resolveGraphAssignmentsToEmails(
  userId: string,
  assignments: Record<string, any> | null | undefined
): Promise<Array<{ graphUserId: string; email: string; displayName: string }>> {
  if (!assignments || Object.keys(assignments).length === 0) return [];

  const results: Array<{ graphUserId: string; email: string; displayName: string }> = [];

  for (const graphUserId of Object.keys(assignments)) {
    const resolved = await resolveGraphUserEmail(userId, graphUserId);
    if (resolved) {
      results.push({ graphUserId, ...resolved });
    }
  }

  return results;
}

// ============ Bidirectional Big Rock Task ↔ Planner Task Sync ============

export async function createPlannerTaskFromBigRockTask(
  userId: string,
  bigRockTask: BigRockTask,
  planId: string,
  bucketId: string | null
): Promise<PlannerTask | null> {
  const plan = await storage.getPlannerPlanById(planId);
  if (!plan) {
    throw new Error('Mapped Planner plan not found');
  }

  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const client = getGraphClient(accessToken);

  try {
    const taskPayload: any = {
      planId: plan.graphPlanId,
      title: bigRockTask.title,
      percentComplete: BIG_ROCK_STATUS_TO_PERCENT[bigRockTask.status] ?? 0,
    };

    if (bucketId) {
      const bucket = await storage.getPlannerBucketById(bucketId);
      if (bucket) {
        taskPayload.bucketId = bucket.graphBucketId;
      }
    }

    // Planner API requires a bucketId — if none was specified, find the first available bucket
    if (!taskPayload.bucketId) {
      const planBuckets = await storage.getPlannerBucketsByPlanId(planId);
      if (planBuckets.length === 0) {
        // Try syncing buckets from Graph as a last resort
        try {
          const freshBuckets = await syncPlannerBuckets(userId, plan.tenantId, planId, plan.graphPlanId);
          if (freshBuckets.length > 0) {
            taskPayload.bucketId = freshBuckets[0].graphBucketId;
          }
        } catch (e) {
          console.warn('[Graph Planner] Failed to sync buckets for task creation fallback:', e);
        }
      } else {
        taskPayload.bucketId = planBuckets[0].graphBucketId;
      }
    }

    if (!taskPayload.bucketId) {
      console.error('[Graph Planner] Cannot create task without a bucket — no buckets available for plan', planId);
      return null;
    }

    if (bigRockTask.dueDate) {
      taskPayload.dueDateTime = new Date(bigRockTask.dueDate).toISOString();
    }

    if (bigRockTask.assigneeEmail) {
      const graphUserId = await resolveEmailToGraphUserId(userId, bigRockTask.assigneeEmail);
      if (graphUserId) {
        taskPayload.assignments = {
          [graphUserId]: {
            '@odata.type': '#microsoft.graph.plannerAssignment',
            orderHint: ' !'
          }
        };
      }
    }

    const response = await client.api('/planner/tasks').post(taskPayload);
    console.log(`[Graph Planner] Created Planner task "${bigRockTask.title}" -> ${response.id}`);

    const resolvedBucketId = bucketId || null;
    const plannerTaskData: InsertPlannerTask = {
      tenantId: plan.tenantId,
      planId: plan.id,
      bucketId: resolvedBucketId,
      graphTaskId: response.id,
      title: response.title,
      percentComplete: response.percentComplete || 0,
      priority: response.priority || 5,
      startDateTime: response.startDateTime ? new Date(response.startDateTime) : null,
      dueDateTime: response.dueDateTime ? new Date(response.dueDateTime) : null,
      completedDateTime: null,
      assignments: response.assignments || {},
    };

    const plannerTask = await storage.upsertPlannerTask(plannerTaskData);

    await storage.updateBigRockTask(bigRockTask.id, {
      plannerTaskId: plannerTask.id,
    });

    return plannerTask;
  } catch (error) {
    console.error(`[Graph Planner] Failed to create Planner task from Big Rock Task:`, error);
    throw error;
  }
}

export async function updatePlannerTaskFromBigRockTask(
  userId: string,
  bigRockTask: BigRockTask
): Promise<void> {
  if (!bigRockTask.plannerTaskId) return;

  const plannerTask = await storage.getPlannerTaskById(bigRockTask.plannerTaskId);
  if (!plannerTask) return;

  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    console.warn('[Graph Planner] No access token for Planner task update');
    return;
  }

  const client = getGraphClient(accessToken);

  try {
    const taskDetails = await client.api(`/planner/tasks/${plannerTask.graphTaskId}`).get();
    const etag = taskDetails['@odata.etag'];

    const patchPayload: any = {
      title: bigRockTask.title,
      percentComplete: BIG_ROCK_STATUS_TO_PERCENT[bigRockTask.status] ?? 0,
    };

    if (bigRockTask.dueDate) {
      patchPayload.dueDateTime = new Date(bigRockTask.dueDate).toISOString();
    }

    if (bigRockTask.assigneeEmail) {
      const graphUserId = await resolveEmailToGraphUserId(userId, bigRockTask.assigneeEmail);
      if (graphUserId) {
        const existingAssignments = taskDetails.assignments || {};
        if (!existingAssignments[graphUserId]) {
          patchPayload.assignments = {
            ...existingAssignments,
            [graphUserId]: {
              '@odata.type': '#microsoft.graph.plannerAssignment',
              orderHint: ' !'
            }
          };
        }
      }
    }

    await client.api(`/planner/tasks/${plannerTask.graphTaskId}`)
      .header('If-Match', etag)
      .patch(patchPayload);

    await storage.upsertPlannerTask({
      ...plannerTask,
      title: bigRockTask.title,
      percentComplete: patchPayload.percentComplete,
      dueDateTime: bigRockTask.dueDate ? new Date(bigRockTask.dueDate) : plannerTask.dueDateTime,
    });

    console.log(`[Graph Planner] Updated Planner task "${bigRockTask.title}"`);
  } catch (error) {
    console.error(`[Graph Planner] Failed to update Planner task:`, error);
  }
}

export async function deletePlannerTaskForBigRockTask(
  userId: string,
  plannerTaskId: string
): Promise<void> {
  const plannerTask = await storage.getPlannerTaskById(plannerTaskId);
  if (!plannerTask) return;

  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    console.warn('[Graph Planner] No access token for Planner task deletion');
    return;
  }

  const client = getGraphClient(accessToken);

  try {
    const taskDetails = await client.api(`/planner/tasks/${plannerTask.graphTaskId}`).get();
    const etag = taskDetails['@odata.etag'];

    await client.api(`/planner/tasks/${plannerTask.graphTaskId}`)
      .header('If-Match', etag)
      .delete();

    console.log(`[Graph Planner] Deleted Planner task "${plannerTask.title}"`);
  } catch (error) {
    console.error(`[Graph Planner] Failed to delete Planner task:`, error);
  }
}

export async function syncPlannerTasksToBigRockTasks(
  userId: string,
  bigRockId: string,
  tenantId: string,
  planId: string,
  bucketId: string | null
): Promise<{ created: number; updated: number; total: number }> {
  let plannerTasks: PlannerTask[];
  if (bucketId) {
    plannerTasks = await storage.getPlannerTasksByBucketId(bucketId);
  } else {
    plannerTasks = await storage.getPlannerTasksByPlanId(planId);
  }

  const existingTasks = await storage.getBigRockTasksByBigRockId(bigRockId);
  const tasksByPlannerId = new Map<string, BigRockTask>();
  for (const t of existingTasks) {
    if (t.plannerTaskId) {
      tasksByPlannerId.set(t.plannerTaskId, t);
    }
  }

  let created = 0;
  let updated = 0;

  for (const pt of plannerTasks) {
    const existingBRTask = tasksByPlannerId.get(pt.id);
    const newStatus = PERCENT_TO_BIG_ROCK_STATUS(pt.percentComplete ?? 0);

    let assigneeEmail: string | null = null;
    if (pt.assignments && Object.keys(pt.assignments).length > 0) {
      const resolved = await resolveGraphAssignmentsToEmails(userId, pt.assignments);
      if (resolved.length > 0) {
        assigneeEmail = resolved[0].email;
      }
    }

    const assigneeId = assigneeEmail 
      ? (await storage.getUserByEmail(assigneeEmail))?.id || null
      : null;

    if (existingBRTask) {
      await storage.updateBigRockTask(existingBRTask.id, {
        title: pt.title,
        status: newStatus,
        assigneeEmail: assigneeEmail || existingBRTask.assigneeEmail,
        assigneeId: assigneeId || existingBRTask.assigneeId,
        dueDate: pt.dueDateTime || existingBRTask.dueDate,
        completedAt: pt.percentComplete === 100 ? (pt.completedDateTime || new Date()) : null,
      });
      updated++;
    } else {
      await storage.createBigRockTask({
        tenantId,
        bigRockId,
        title: pt.title,
        description: pt.description || null,
        status: newStatus,
        assigneeId: assigneeId,
        assigneeEmail: assigneeEmail,
        dueDate: pt.dueDateTime || null,
        completedAt: pt.percentComplete === 100 ? (pt.completedDateTime || new Date()) : null,
        plannerTaskId: pt.id,
        sortOrder: created,
      });
      created++;
    }
  }

  return { created, updated, total: plannerTasks.length };
}

// ============ Create Planner Plan in Teams/Channels ============

async function fetchTeamsWithClient(
  client: Client
): Promise<Array<{ id: string; displayName: string; description?: string }>> {
  try {
    const response = await client.api('/me/joinedTeams')
      .select('id,displayName,description')
      .get();
    const teams = response.value || [];
    if (teams.length > 0) {
      teams.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
      return teams;
    }
  } catch (error: any) {
    if (error.statusCode === 401) throw error;
    console.warn('[Graph Planner] /me/joinedTeams failed, falling back to groups:', error.message);
  }

  const response = await client.api('/me/memberOf/microsoft.graph.group')
    .filter("groupTypes/any(c:c eq 'Unified')")
    .select('id,displayName,description')
    .top(100)
    .get();
  const groups = response.value || [];
  groups.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
  return groups;
}

export async function getTeamsForUser(
  userId: string
): Promise<Array<{ id: string; displayName: string; description?: string }>> {
  return withTokenRetry(userId, fetchTeamsWithClient);
}

async function withTokenRetry<T>(
  userId: string,
  operation: (client: Client) => Promise<T>
): Promise<T> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect Microsoft Planner.');
  }

  try {
    return await operation(getGraphClient(accessToken));
  } catch (error: any) {
    if (error.statusCode === 401 || error.code === 'InvalidAuthenticationToken') {
      console.log('[Graph Planner] Token expired, attempting refresh and retry...');
      const refreshedToken = await getAccessToken(userId, true);
      if (refreshedToken) {
        return await operation(getGraphClient(refreshedToken));
      }
      throw new Error('Microsoft token expired and could not be refreshed. Please reconnect Microsoft Planner.');
    }
    throw error;
  }
}

export async function getChannelsForTeam(
  userId: string,
  teamId: string
): Promise<Array<{ id: string; displayName: string; membershipType?: string }>> {
  return withTokenRetry(userId, async (client) => {
    const response = await client.api(`/teams/${teamId}/channels`)
      .select('id,displayName,membershipType')
      .get();
    return response.value || [];
  });
}

export async function createPlanInTeam(
  userId: string,
  tenantId: string,
  teamId: string,
  planTitle: string
): Promise<PlannerPlan> {
  return withTokenRetry(userId, async (client) => {
    const response = await client.api('/planner/plans').post({
      owner: teamId,
      title: planTitle,
    });

    console.log(`[Graph Planner] Created plan "${planTitle}" in team ${teamId} -> ${response.id}`);

    const planData: InsertPlannerPlan = {
      tenantId,
      graphPlanId: response.id,
      title: response.title,
      owner: response.owner,
      graphGroupId: teamId,
    };

    return await storage.upsertPlannerPlan(planData);
  });
}

export async function addPlannerTabToChannel(
  userId: string,
  teamId: string,
  channelId: string,
  planId: string,
  planTitle: string
): Promise<void> {
  return withTokenRetry(userId, async (client) => {
    const entityId = `tt.c_${channelId}_p_${planId}_h_${Date.now()}`;
    await client.api(`/teams/${teamId}/channels/${channelId}/tabs`).post({
      displayName: planTitle,
      'teamsApp@odata.bind': "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/com.microsoft.teamspace.tab.planner",
      configuration: {
        entityId,
        contentUrl: `https://tasks.teams.microsoft.com/teamsui/{tid}/Home/PlannerFrame?page=7&auth_pvr=OrgId&auth_upn={userPrincipalName}&groupId=${teamId}&planId=${planId}&channelId=${channelId}&entityId=${entityId}&tid={tid}&userObjectId={userObjectId}&subEntityId={subEntityId}&sessionId={sessionId}&theme={theme}&mkt={locale}&ringId={ringId}&PlannerRouteHint={tid}&tabVersion=20200228.1_s`,
        removeUrl: `https://tasks.teams.microsoft.com/teamsui/{tid}/Home/PlannerFrame?page=13&auth_pvr=OrgId&auth_upn={userPrincipalName}&groupId=${teamId}&planId=${planId}&channelId=${channelId}&entityId=${entityId}&tid={tid}&userObjectId={userObjectId}&subEntityId={subEntityId}&sessionId={sessionId}&theme={theme}&mkt={locale}&ringId={ringId}&PlannerRouteHint={tid}&tabVersion=20200228.1_s`,
        websiteUrl: `https://tasks.office.com/{tid}/Home/PlanViews/${planId}?Type=PlanLink&Channel=TeamsTab`,
      },
    });
    console.log(`[Graph Planner] Added Planner tab "${planTitle}" to channel ${channelId}`);
  });
}

export async function createBucketInPlan(
  userId: string,
  tenantId: string,
  planId: string,
  bucketName: string
): Promise<PlannerBucket> {
  const plan = await storage.getPlannerPlanById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  return withTokenRetry(userId, async (client) => {
    const response = await client.api('/planner/buckets').post({
      planId: plan.graphPlanId,
      name: bucketName,
    });

    const bucketData: InsertPlannerBucket = {
      tenantId,
      planId: plan.id,
      graphBucketId: response.id,
      name: response.name,
      orderHint: response.orderHint || '',
    };

    return await storage.upsertPlannerBucket(bucketData);
  });
}
