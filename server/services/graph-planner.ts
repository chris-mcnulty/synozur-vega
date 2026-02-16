import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from '../storage';
import { getPlannerGraphClient, isPlannerConfigured } from './planner-auth';
import type { 
  PlannerPlan, 
  PlannerBucket, 
  PlannerTask,
  BigRockTask,
  InsertPlannerPlan,
  InsertPlannerBucket,
  InsertPlannerTask 
} from '../../shared/schema';

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

async function getClient(azureTenantId: string): Promise<Client> {
  return getPlannerGraphClient(azureTenantId);
}

export async function syncPlannerPlans(tenantId: string, azureTenantId: string): Promise<PlannerPlan[]> {
  const client = await getClient(azureTenantId);
  
  try {
    const groupsResponse = await client.api('/groups')
      .filter("groupTypes/any(c:c eq 'Unified')")
      .select('id,displayName')
      .top(100)
      .get();

    const groups = groupsResponse.value || [];
    const syncedPlans: PlannerPlan[] = [];

    for (const group of groups) {
      try {
        const plansResponse = await client.api(`/groups/${group.id}/planner/plans`).get();
        const graphPlans: GraphPlannerPlan[] = plansResponse.value || [];

        for (const graphPlan of graphPlans) {
          const planData: InsertPlannerPlan = {
            tenantId,
            graphPlanId: graphPlan.id,
            title: graphPlan.title,
            owner: graphPlan.owner,
            graphGroupId: group.id,
            groupDisplayName: group.displayName || null,
          };

          const plan = await storage.upsertPlannerPlan(planData);
          syncedPlans.push(plan);
        }
      } catch (groupError: any) {
        if (groupError.statusCode === 403 || groupError.statusCode === 404) {
          continue;
        }
        console.warn(`[Graph Planner] Failed to list plans for group ${group.displayName}:`, groupError.message);
      }
    }

    return syncedPlans;
  } catch (error) {
    console.error('[Graph Planner] Failed to sync plans:', error);
    throw error;
  }
}

export async function syncPlannerBuckets(
  tenantId: string, 
  planId: string,
  graphPlanId: string,
  azureTenantId: string
): Promise<PlannerBucket[]> {
  const client = await getClient(azureTenantId);

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
  tenantId: string,
  planId: string,
  graphPlanId: string,
  azureTenantId: string
): Promise<PlannerTask[]> {
  const client = await getClient(azureTenantId);

  try {
    try {
      await syncPlannerBuckets(tenantId, planId, graphPlanId, azureTenantId);
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
            Object.entries(graphTask.assignments).map(([uid, data]) => [
              uid,
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

export async function syncAllPlannerData(tenantId: string, azureTenantId: string): Promise<{
  plans: PlannerPlan[];
  buckets: PlannerBucket[];
  tasks: PlannerTask[];
}> {
  const plans = await syncPlannerPlans(tenantId, azureTenantId);
  
  const allBuckets: PlannerBucket[] = [];
  const allTasks: PlannerTask[] = [];

  for (const plan of plans) {
    const buckets = await syncPlannerBuckets(tenantId, plan.id, plan.graphPlanId, azureTenantId);
    allBuckets.push(...buckets);

    const tasks = await syncPlannerTasks(tenantId, plan.id, plan.graphPlanId, azureTenantId);
    allTasks.push(...tasks);
  }

  return { plans, buckets: allBuckets, tasks: allTasks };
}

export async function createPlannerTask(
  planId: string,
  bucketId: string,
  title: string,
  azureTenantId: string,
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

  const client = await getClient(azureTenantId);

  try {
    const taskPayload: any = {
      planId: plan.graphPlanId,
      bucketId: bucket.graphBucketId,
      title,
    };

    if (dueDate) {
      taskPayload.dueDateTime = dueDate.toISOString();
    }

    const response = await client.api('/planner/tasks')
      .header('Prefer', 'ExchangeNotifications.Suppress')
      .post(taskPayload);

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
  taskId: string,
  percentComplete: number,
  azureTenantId: string
): Promise<PlannerTask | null> {
  const task = await storage.getPlannerTaskById(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const client = await getClient(azureTenantId);

  try {
    const taskDetails = await client.api(`/planner/tasks/${task.graphTaskId}`).get();
    const etag = taskDetails['@odata.etag'];

    await client.api(`/planner/tasks/${task.graphTaskId}`)
      .header('If-Match', etag)
      .header('Prefer', 'ExchangeNotifications.Suppress')
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

export async function getPlannerIntegrationStatus(tenantId: string): Promise<{
  connected: boolean;
  configured: boolean;
  planCount: number;
  taskCount: number;
}> {
  const configured = isPlannerConfigured();
  
  if (!configured) {
    return { connected: false, configured: false, planCount: 0, taskCount: 0 };
  }

  const plans = await storage.getPlannerPlansByTenantId(tenantId);
  let taskCount = 0;
  
  for (const plan of plans) {
    const tasks = await storage.getPlannerTasksByPlanId(plan.id);
    taskCount += tasks.length;
  }

  return {
    connected: true,
    configured: true,
    planCount: plans.length,
    taskCount,
  };
}

// ============ Email-based People Resolution (App-Only Auth) ============

export async function resolveGraphUserEmail(
  graphUserId: string,
  azureTenantId: string
): Promise<{ email: string; displayName: string } | null> {
  const cached = graphUserCache.get(graphUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return { email: cached.email, displayName: cached.displayName };
  }

  try {
    const client = await getClient(azureTenantId);
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
  email: string,
  azureTenantId: string
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const cached = emailToGraphIdCache.get(normalizedEmail);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.graphUserId;
  }

  try {
    const client = await getClient(azureTenantId);
    const response = await client.api('/users')
      .filter(`mail eq '${normalizedEmail}' or userPrincipalName eq '${normalizedEmail}'`)
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
  assignments: Record<string, any> | null | undefined,
  azureTenantId: string
): Promise<Array<{ graphUserId: string; email: string; displayName: string }>> {
  if (!assignments || Object.keys(assignments).length === 0) return [];

  const results: Array<{ graphUserId: string; email: string; displayName: string }> = [];

  for (const graphUserId of Object.keys(assignments)) {
    const resolved = await resolveGraphUserEmail(graphUserId, azureTenantId);
    if (resolved) {
      results.push({ graphUserId, ...resolved });
    }
  }

  return results;
}

// ============ Bidirectional Big Rock Task <-> Planner Task Sync ============

export async function createPlannerTaskFromBigRockTask(
  bigRockTask: BigRockTask,
  planId: string,
  bucketId: string | null,
  azureTenantId: string
): Promise<PlannerTask | null> {
  const plan = await storage.getPlannerPlanById(planId);
  if (!plan) {
    throw new Error('Mapped Planner plan not found');
  }

  const client = await getClient(azureTenantId);

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

    if (!taskPayload.bucketId) {
      const planBuckets = await storage.getPlannerBucketsByPlanId(planId);
      if (planBuckets.length === 0) {
        try {
          const freshBuckets = await syncPlannerBuckets(plan.tenantId, planId, plan.graphPlanId, azureTenantId);
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
      const graphUserId = await resolveEmailToGraphUserId(bigRockTask.assigneeEmail, azureTenantId);
      if (graphUserId) {
        taskPayload.assignments = {
          [graphUserId]: {
            '@odata.type': '#microsoft.graph.plannerAssignment',
            orderHint: ' !'
          }
        };
      }
    }

    const response = await client.api('/planner/tasks')
      .header('Prefer', 'ExchangeNotifications.Suppress')
      .post(taskPayload);
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
  bigRockTask: BigRockTask,
  azureTenantId: string
): Promise<void> {
  if (!bigRockTask.plannerTaskId) return;

  const plannerTask = await storage.getPlannerTaskById(bigRockTask.plannerTaskId);
  if (!plannerTask) return;

  try {
    const client = await getClient(azureTenantId);

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
      const graphUserId = await resolveEmailToGraphUserId(bigRockTask.assigneeEmail, azureTenantId);
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
      .header('Prefer', 'ExchangeNotifications.Suppress')
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
  plannerTaskId: string,
  azureTenantId: string
): Promise<void> {
  const plannerTask = await storage.getPlannerTaskById(plannerTaskId);
  if (!plannerTask) return;

  try {
    const client = await getClient(azureTenantId);

    const taskDetails = await client.api(`/planner/tasks/${plannerTask.graphTaskId}`).get();
    const etag = taskDetails['@odata.etag'];

    await client.api(`/planner/tasks/${plannerTask.graphTaskId}`)
      .header('If-Match', etag)
      .header('Prefer', 'ExchangeNotifications.Suppress')
      .delete();

    console.log(`[Graph Planner] Deleted Planner task "${plannerTask.title}"`);
  } catch (error) {
    console.error(`[Graph Planner] Failed to delete Planner task:`, error);
  }
}

export async function syncPlannerTasksToBigRockTasks(
  bigRockId: string,
  tenantId: string,
  planId: string,
  bucketId: string | null,
  azureTenantId: string
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
      const resolved = await resolveGraphAssignmentsToEmails(pt.assignments, azureTenantId);
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

// ============ Calculate Planner Progress ============

export async function calculatePlannerProgress(
  planId: string, 
  bucketId: string | null,
  tenantId: string
): Promise<{ percentage: number; totalTasks: number; completedTasks: number }> {
  let tasks;
  if (bucketId) {
    tasks = await storage.getPlannerTasksByBucketId(bucketId);
  } else {
    tasks = await storage.getPlannerTasksByPlanId(planId);
  }

  if (!tasks || tasks.length === 0) {
    return { percentage: 0, totalTasks: 0, completedTasks: 0 };
  }

  const completedTasks = tasks.filter(t => t.percentComplete === 100).length;
  const totalTasks = tasks.length;
  const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    percentage: Math.round(percentage * 10) / 10,
    totalTasks,
    completedTasks
  };
}

// ============ Create Planner Plan in Teams/Channels (App-Only) ============

export async function getTeamsForUser(
  tenantId: string,
  azureTenantId: string
): Promise<Array<{ id: string; displayName: string; description?: string }>> {
  const client = await getClient(azureTenantId);
  
  try {
    const response = await client.api('/groups')
      .filter("groupTypes/any(c:c eq 'Unified')")
      .select('id,displayName,description')
      .top(100)
      .get();
    const groups = response.value || [];
    groups.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
    return groups;
  } catch (error: any) {
    console.error('[Graph Planner] Failed to list groups/teams:', error.message);
    throw error;
  }
}

export async function getChannelsForTeam(
  teamId: string,
  azureTenantId: string
): Promise<Array<{ id: string; displayName: string; membershipType?: string }>> {
  const client = await getClient(azureTenantId);

  try {
    const response = await client.api(`/teams/${teamId}/channels`)
      .select('id,displayName,membershipType')
      .get();
    return response.value || [];
  } catch (error: any) {
    console.error('[Graph Planner] Failed to list channels:', error.message);
    if (error.message?.includes('Insufficient privileges') || error.message?.includes('Authorization_RequestDenied')) {
      console.warn('[Graph Planner] Channel.ReadBasic.All permission not granted, returning General channel fallback');
      return [{ id: 'general', displayName: 'General', membershipType: 'standard' }];
    }
    throw error;
  }
}

export async function createPlanInTeam(
  tenantId: string,
  teamId: string,
  planTitle: string,
  azureTenantId: string,
  teamDisplayName?: string
): Promise<PlannerPlan> {
  const client = await getClient(azureTenantId);

  const response = await client.api('/planner/plans').post({
    owner: teamId,
    title: planTitle,
  });

  console.log(`[Graph Planner] Created plan "${planTitle}" in team ${teamId} -> ${response.id}`);

  let groupName = teamDisplayName || null;
  if (!groupName) {
    try {
      const groupInfo = await client.api(`/groups/${teamId}`).select('displayName').get();
      groupName = groupInfo.displayName || null;
    } catch {
      // ignore
    }
  }

  const planData: InsertPlannerPlan = {
    tenantId,
    graphPlanId: response.id,
    title: response.title,
    owner: response.owner,
    graphGroupId: teamId,
    groupDisplayName: groupName,
  };

  return await storage.upsertPlannerPlan(planData);
}

export async function addPlannerTabToChannel(
  teamId: string,
  channelId: string,
  planId: string,
  planTitle: string,
  azureTenantId: string
): Promise<void> {
  const client = await getClient(azureTenantId);

  try {
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
  } catch (error: any) {
    console.error('[Graph Planner] Failed to add Planner tab:', error.message);
    if (error.message?.includes('Insufficient privileges') || error.message?.includes('Authorization_RequestDenied')) {
      throw new Error('Tab creation requires TeamsTab.Create permission. The plan was created but not pinned to the channel.');
    }
    throw error;
  }
}

export async function createBucketInPlan(
  tenantId: string,
  planId: string,
  bucketName: string,
  azureTenantId: string
): Promise<PlannerBucket> {
  const plan = await storage.getPlannerPlanById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const client = await getClient(azureTenantId);

  const response = await client.api('/planner/buckets')
    .header('Prefer', 'ExchangeNotifications.Suppress')
    .post({
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
}
