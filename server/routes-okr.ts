import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { 
  insertObjectiveSchema, 
  insertKeyResultSchema, 
  insertBigRockSchema,
  insertCheckInSchema,
  updateCheckInSchema,
  Objective
} from "@shared/schema";
import { z } from "zod";
import { hasPermission, PERMISSIONS, Role } from "@shared/rbac";
import { requireValidatedTenant } from "./middleware/validateTenant";
import { requireReadWriteLicense } from "./middleware/rbac";
import { applyCustomFields, hydrateEntitiesWithCustomFields } from "./routes-custom-fields";
import { createNotification, notifyMany } from "./services/notification-service";
import { encryptToken } from "./utils/encryption";

// Fields whose mutation on an `active` objective requires re-approval when
// approvals are enabled (Task #59).
const SUBSTANTIVE_FIELDS = new Set([
  'title', 'description', 'ownerId', 'ownerEmail', 'teamId',
  'quarter', 'year', 'startDate', 'endDate', 'level', 'parentId',
  'alignedToObjectiveIds', 'goalType', 'phasedTargets',
]);

function isSubstantiveChange(updateData: Record<string, any>, existing: any): boolean {
  for (const key of Object.keys(updateData)) {
    if (!SUBSTANTIVE_FIELDS.has(key)) continue;
    const a = updateData[key];
    const b = existing?.[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) return true;
  }
  return false;
}

// Requeue a parent objective for approval after a substantive change to one
// of its key results (add/delete/target change). Idempotent if already pending.
async function maybeRequeueParentForKrChange(
  objectiveId: string | null | undefined,
  actorUserId: string | null,
  actorEmail: string | null,
): Promise<void> {
  if (!objectiveId) return;
  try {
    const parent = await storage.getObjectiveById(objectiveId);
    if (!parent) return;
    const tenant = await storage.getTenantById(parent.tenantId);
    if (!(tenant as any)?.okrApprovalsEnabled) return;
    if (((parent as any).state || 'active') !== 'active') return;
    const updated = await storage.submitObjectiveForApproval(parent.id, actorUserId);
    await notifyApproversOfSubmission(parent.tenantId, updated, actorEmail);
  } catch (err) {
    console.error('[okr-approval] Failed to requeue parent for KR change:', err);
  }
}

async function notifyApproversOfSubmission(tenantId: string, objective: Objective, submitterEmail?: string | null) {
  try {
    const approverIds = await storage.getApproverUserIds(tenantId);
    if (approverIds.length === 0) return;
    await notifyMany(approverIds.map((userId) => ({
      tenantId,
      userId,
      type: 'okr_approval_requested' as const,
      title: 'OKR awaiting your approval',
      body: `"${objective.title}"${submitterEmail ? ` was submitted by ${submitterEmail}` : ''}`,
      entityType: 'objective',
      entityId: objective.id,
      linkUrl: `/review-queue`,
    })));
  } catch (err) {
    console.error('[okr-approval] Failed to notify approvers:', err);
  }
}

/**
 * Check if the current user can modify a specific OKR
 * Returns true if user has UPDATE_ANY_OKR permission, or if they own/created the item
 */
function canUserModifyOKR(req: Request, ownerId?: string | null, createdBy?: string | null, ownerEmail?: string | null): boolean {
  if (!req.user) return false;
  
  // If user has UPDATE_ANY_OKR permission, they can modify any OKR
  if (hasPermission(req.user.role as Role, PERMISSIONS.UPDATE_ANY_OKR)) {
    return true;
  }
  
  // Check if user has UPDATE_OWN_OKR permission first
  if (!hasPermission(req.user.role as Role, PERMISSIONS.UPDATE_OWN_OKR)) {
    return false;
  }
  
  // Check if they own it or created it (by ID)
  const userId = req.user.id;
  if (ownerId && ownerId === userId) return true;
  if (createdBy && createdBy === userId) return true;
  
  // Fall back to check by email for objectives that use ownerEmail
  if (ownerEmail && req.user.email && ownerEmail === req.user.email) return true;
  
  return false;
}

/**
 * Check if the current user can delete a specific OKR
 * Returns true if user has DELETE_OKR permission
 */
function canUserDeleteOKR(req: Request): boolean {
  if (!req.user) return false;
  return hasPermission(req.user.role as Role, PERMISSIONS.DELETE_OKR);
}

export const okrRouter = Router();

// Apply read-write license check for all mutating operations (POST, PATCH, DELETE)
okrRouter.use((req: Request, res: Response, next: NextFunction) => {
  const writeMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (writeMethods.includes(req.method)) {
    return requireReadWriteLicense(req, res, next);
  }
  next();
});

// Helper function to detect circular dependencies in objective alignment
async function detectCircularAlignment(
  objectiveId: string,
  targetAlignmentIds: string[],
  allObjectives: Objective[]
): Promise<{ hasCircle: boolean; chainPath?: string[] }> {
  const objectivesMap = new Map(allObjectives.map(obj => [obj.id, obj]));
  
  // For each target alignment, trace up the chain to see if we reach back to objectiveId
  for (const targetId of targetAlignmentIds) {
    const visited = new Set<string>();
    const path: string[] = [objectiveId, targetId];
    
    // BFS/DFS to trace the alignment chain
    const queue = [targetId];
    visited.add(objectiveId); // Mark the source as visited
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      if (currentId === objectiveId) {
        // Found a cycle back to the original objective
        return { hasCircle: true, chainPath: path };
      }
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const current = objectivesMap.get(currentId);
      if (current) {
        // Check alignedToObjectiveIds (what this objective aligns to)
        const alignedTo = (current as any).alignedToObjectiveIds as string[] | null;
        if (alignedTo && alignedTo.length > 0) {
          for (const nextId of alignedTo) {
            if (!visited.has(nextId)) {
              queue.push(nextId);
              if (nextId === objectiveId) {
                path.push(nextId);
                return { hasCircle: true, chainPath: path };
              }
            }
          }
        }
        
        // Also check parentId for hierarchical relationship
        if (current.parentId && !visited.has(current.parentId)) {
          queue.push(current.parentId);
          if (current.parentId === objectiveId) {
            path.push(current.parentId);
            return { hasCircle: true, chainPath: path };
          }
        }
      }
    }
  }
  
  return { hasCircle: false };
}

/**
 * Normalize progress to a maximum of 100% to avoid inflated averages
 * Any value above 100 is capped at 100
 */
function normalizeProgress(progress: number): number {
  return Math.min(progress, 100);
}

/**
 * Calculate weighted rollup progress for an objective from both KRs and child objectives
 * Returns the new progress value (0-100)
 * Note: Individual progress values are capped at 100% before weighting to avoid inflated averages
 */
export async function calculateObjectiveRollupProgress(objectiveId: string): Promise<number> {
  // Get all Key Results for this objective
  const keyResults = await storage.getKeyResultsByObjectiveId(objectiveId);
  
  // Get all child objectives
  const childObjectives = await storage.getChildObjectives(objectiveId);
  
  // If no children of any kind, return 0
  if (keyResults.length === 0 && childObjectives.length === 0) {
    return 0;
  }
  
  let totalWeight = 0;
  let weightedProgress = 0;
  
  // Add KRs to the calculation (normalize each to max 100%)
  for (const kr of keyResults) {
    const weight = kr.weight || 25;
    totalWeight += weight;
    // Cap individual KR progress at 100% before weighting
    const cappedProgress = normalizeProgress(kr.progress || 0);
    weightedProgress += cappedProgress * weight;
  }
  
  // Add child objectives to the calculation (use their weight if set, otherwise distribute remaining)
  for (const child of childObjectives) {
    // Only include child objectives that have a weight set
    // If no weight is set, they don't participate in rollup (backwards compatible)
    if (child.weight !== null && child.weight !== undefined) {
      totalWeight += child.weight;
      // Cap individual child objective progress at 100% before weighting
      const cappedProgress = normalizeProgress(child.progress || 0);
      weightedProgress += cappedProgress * child.weight;
    }
  }
  
  // Final result is also capped at 100%
  const result = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  return Math.min(result, 100);
}

// Teams
okrRouter.get("/teams", async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const teams = await storage.getTeamsByTenantId(tenantId as string);
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Objectives
okrRouter.get("/objectives", async (req, res) => {
  try {
    const { tenantId, quarter, year, level, teamId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    // Task #59: scope draft / pending_approval visibility. Approvers see all;
    // others see active + their own drafts/pending submissions.
    const sess = req.session as any;
    const viewerUserId = sess?.passport?.user?.id || sess?.userId || (req as any).user?.id || null;
    const viewerEmail = sess?.passport?.user?.email || sess?.userEmail || (req as any).user?.email || null;
    const role = ((req as any).user?.role || '') as Role;
    const isApprover = hasPermission(role, PERMISSIONS.APPROVE_OKR);

    const objectives = await storage.getObjectivesByTenantId(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined,
      level as string | undefined,
      teamId as string | undefined,
      { viewerUserId, viewerEmail, includeAllStates: isApprover }
    );

    const hydrated = await hydrateEntitiesWithCustomFields(tenantId as string, 'objective', objectives);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/objectives/:id", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    const [hydrated] = await hydrateEntitiesWithCustomFields(objective.tenantId, 'objective', [objective]);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/objectives/:id/children", async (req, res) => {
  try {
    const children = await storage.getChildObjectives(req.params.id);
    res.json(children);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/objectives", async (req, res) => {
  try {
    const { customFields, ...rest } = req.body || {};
    const validatedData = insertObjectiveSchema.parse(rest);
    
    // Always use the server-resolved tenant context – ignore any client-supplied tenantId
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    
    // Validate weight bounds if provided (0-100 or null)
    if (validatedData.weight !== undefined && validatedData.weight !== null) {
      const weight = Number(validatedData.weight);
      if (isNaN(weight) || weight < 0 || weight > 100) {
        return res.status(400).json({ 
          error: "Weight must be between 0 and 100" 
        });
      }
      (validatedData as any).weight = weight;
    }
    
    // Auto-set createdBy from session if not provided
    const session = req.session as any;
    const userId = session?.passport?.user?.id || session?.userId;
    const userEmail = session?.passport?.user?.email || session?.userEmail;
    
    // Task #59: When the tenant has OKR approvals enabled, all newly-created
    // objectives go to `pending_approval` regardless of any client-supplied
    // state. Otherwise default to `active` to preserve existing behavior.
    const tenant = await storage.getTenantById(effectiveTenantId);
    const approvalsEnabled = !!(tenant as any)?.okrApprovalsEnabled;

    // Insert as 'draft' first when approvals are enabled so submitObjectiveForApproval
    // can record a proper draft → pending_approval audit row in a single transaction.
    const objectiveData = {
      ...validatedData,
      tenantId: effectiveTenantId,
      createdBy: validatedData.createdBy || userId || null,
      ownerEmail: validatedData.ownerEmail || userEmail || null,
      state: approvalsEnabled ? 'draft' : 'active',
    };

    let objective = await storage.createObjective(objectiveData as any);
    try {
      await applyCustomFields(effectiveTenantId, 'objective', objective.id, customFields);
    } catch (cfError: any) {
      return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
    }

    if (approvalsEnabled) {
      objective = await storage.submitObjectiveForApproval(objective.id, userId || null);
      await notifyApproversOfSubmission(effectiveTenantId, objective, userEmail);
    }

    res.json(objective);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.patch("/objectives/:id", async (req, res) => {
  try {
    // Convert empty strings to null for foreign key fields
    const { customFields, ...body } = req.body || {};
    const updateData = { ...body };
    if (updateData.parentId === "") updateData.parentId = null;
    if (updateData.ownerId === "") updateData.ownerId = null;
    
    // Validate weight bounds if provided (0-100 or null)
    if (updateData.weight !== undefined && updateData.weight !== null) {
      const weight = Number(updateData.weight);
      if (isNaN(weight) || weight < 0 || weight > 100) {
        return res.status(400).json({ 
          error: "Weight must be between 0 and 100" 
        });
      }
      updateData.weight = weight;
    }
    
    // Check if objective is closed - only allow status changes (reopen)
    const existingObjective = await storage.getObjectiveById(req.params.id);
    if (!existingObjective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    
    // RBAC: Check if user can modify this objective
    if (!canUserModifyOKR(req, existingObjective.ownerId, existingObjective.createdBy, existingObjective.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only edit objectives you own or created. Contact an admin for help."
      });
    }
    
    if (existingObjective.status === 'closed') {
      const isStatusChange = updateData.status && updateData.status !== 'closed';
      
      // Only allow reopening (status change from closed to another status)
      if (!isStatusChange) {
        return res.status(403).json({ 
          error: "This objective is closed. Change the status to reopen it before making other edits." 
        });
      }
    }
    
    // Check for circular dependencies when updating alignedToObjectiveIds
    if (updateData.alignedToObjectiveIds && updateData.alignedToObjectiveIds.length > 0) {
      // Prevent self-alignment
      if (updateData.alignedToObjectiveIds.includes(req.params.id)) {
        return res.status(400).json({ 
          error: "An objective cannot be aligned to itself." 
        });
      }
      
      // Get all objectives for the tenant to check for circular dependencies
      const allObjectives = await storage.getObjectivesByTenantId(existingObjective.tenantId);
      
      const circularCheck = await detectCircularAlignment(
        req.params.id,
        updateData.alignedToObjectiveIds,
        allObjectives
      );
      
      if (circularCheck.hasCircle) {
        return res.status(400).json({ 
          error: "Circular dependency detected. This alignment would create a loop in the objective hierarchy.",
          details: "One of the selected objectives already aligns to this objective (directly or through a chain)."
        });
      }
    }
    
    // Task #59: If approvals are enabled and a substantive field changed on
    // an active objective, transition it back to pending_approval and notify
    // approvers. Non-substantive edits (progress, status, check-ins) bypass.
    const tenantForApproval = await storage.getTenantById(existingObjective.tenantId);
    const approvalsEnabled = !!(tenantForApproval as any)?.okrApprovalsEnabled;
    const sessionForApproval = req.session as any;
    const approvalUserId = sessionForApproval?.passport?.user?.id || sessionForApproval?.userId || null;
    const approvalUserEmail = sessionForApproval?.passport?.user?.email || sessionForApproval?.userEmail || null;
    const wasActive = ((existingObjective as any).state || 'active') === 'active';
    const shouldRequeueForApproval = approvalsEnabled && wasActive && isSubstantiveChange(updateData, existingObjective);

    const objective = await storage.updateObjective(req.params.id, updateData);
    if (customFields !== undefined) {
      try {
        await applyCustomFields(objective.tenantId, 'objective', objective.id, customFields);
      } catch (cfError: any) {
        return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
      }
    }

    if (shouldRequeueForApproval) {
      const requeued = await storage.submitObjectiveForApproval(objective.id, approvalUserId);
      await notifyApproversOfSubmission(existingObjective.tenantId, requeued, approvalUserEmail);
      Object.assign(objective, requeued);
    }
    
    // If this objective has a parent and progress changed, propagate to parent
    if (objective.parentId && (updateData.progress !== undefined || updateData.weight !== undefined)) {
      const parentObjective = await storage.getObjectiveById(objective.parentId);
      
      // Only recalculate if parent is using rollup mode
      if (parentObjective && parentObjective.progressMode === 'rollup') {
        const newProgress = await calculateObjectiveRollupProgress(objective.parentId);
        await storage.updateObjective(objective.parentId, { progress: newProgress });
      }
    }
    
    res.json(objective);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.delete("/objectives/:id", async (req, res) => {
  try {
    // RBAC: Check if user has DELETE_OKR permission
    if (!canUserDeleteOKR(req)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You do not have permission to delete objectives."
      });
    }
    
    await storage.deleteObjective(req.params.id, (req as any).user?.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ============================================
// OKR Approval Workflow (Task #59)
// ============================================

okrRouter.get("/review-queue", async (req, res) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const role = ((req as any).user?.role || '') as Role;
    if (!hasPermission(role, PERMISSIONS.APPROVE_OKR)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const items = await storage.getApprovalQueueByTenantId(tenantId);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/objectives/:id/approval-history", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (objective.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const history = await storage.getObjectiveApprovalHistory(req.params.id);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/objectives/:id/submit", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (objective.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!canUserModifyOKR(req, objective.ownerId, objective.createdBy, objective.ownerEmail)) {
      return res.status(403).json({ error: "You can only submit objectives you own or created." });
    }
    const session = req.session as any;
    const userId = session?.passport?.user?.id || session?.userId || null;
    const userEmail = session?.passport?.user?.email || session?.userEmail || null;
    const updated = await storage.submitObjectiveForApproval(req.params.id, userId);
    await notifyApproversOfSubmission(objective.tenantId, updated, userEmail);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/objectives/:id/approve", async (req, res) => {
  try {
    const role = ((req as any).user?.role || '') as Role;
    if (!hasPermission(role, PERMISSIONS.APPROVE_OKR)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (objective.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (((objective as any).state || 'active') !== 'pending_approval') {
      return res.status(400).json({ error: "Objective is not pending approval" });
    }
    const session = req.session as any;
    const actorUserId = session?.passport?.user?.id || session?.userId || null;
    const note = typeof req.body?.note === 'string' ? req.body.note : null;
    const updated = await storage.approveObjective(req.params.id, actorUserId, note);
    // Notify the owner first (with submitter/creator fallbacks). If the owner
    // is identified only by email, look the user up so we can deliver the
    // in-app notification.
    let recipient: string | null = objective.ownerId || (objective as any).submittedForApprovalBy || objective.createdBy || null;
    if (!recipient && (objective as any).ownerEmail) {
      const ownerUser = await storage.getUserByEmail((objective as any).ownerEmail);
      recipient = ownerUser?.id || null;
    }
    if (recipient) {
      await createNotification({
        tenantId: objective.tenantId,
        userId: recipient,
        type: 'okr_approved',
        title: 'Your OKR was approved',
        body: `"${objective.title}" has been approved.`,
        entityType: 'objective',
        entityId: objective.id,
        linkUrl: '/planning',
      });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/objectives/:id/reject", async (req, res) => {
  try {
    const role = ((req as any).user?.role || '') as Role;
    if (!hasPermission(role, PERMISSIONS.APPROVE_OKR)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) {
      return res.status(400).json({ error: "Rejection note is required" });
    }
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) return res.status(404).json({ error: "Objective not found" });
    if (objective.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (((objective as any).state || 'active') !== 'pending_approval') {
      return res.status(400).json({ error: "Objective is not pending approval" });
    }
    const session = req.session as any;
    const actorUserId = session?.passport?.user?.id || session?.userId || null;
    const updated = await storage.rejectObjective(req.params.id, actorUserId, note);
    let recipient: string | null = objective.ownerId || (objective as any).submittedForApprovalBy || objective.createdBy || null;
    if (!recipient && (objective as any).ownerEmail) {
      const ownerUser = await storage.getUserByEmail((objective as any).ownerEmail);
      recipient = ownerUser?.id || null;
    }
    if (recipient) {
      await createNotification({
        tenantId: objective.tenantId,
        userId: recipient,
        type: 'okr_rejected',
        title: 'Your OKR needs changes',
        body: `"${objective.title}" was sent back: ${note}`,
        entityType: 'objective',
        entityId: objective.id,
        linkUrl: '/planning',
      });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Clone objective (with optional hierarchy)
okrRouter.post("/objectives/:id/clone", async (req, res) => {
  try {
    const { id } = req.params;
    const { targetQuarter, targetYear, keepOriginalOwner, newOwnerId, cloneScope } = req.body;
    
    // Validate required fields - targetQuarter can be null for annual objectives
    if (targetYear === undefined) {
      return res.status(400).json({ error: "targetYear is required" });
    }
    
    if (!cloneScope || !['objective_only', 'immediate_children', 'all_children'].includes(cloneScope)) {
      return res.status(400).json({ error: "cloneScope must be one of: objective_only, immediate_children, all_children" });
    }
    
    const clonedObjective = await storage.cloneObjective(id, {
      targetQuarter: targetQuarter === null || targetQuarter === undefined ? null : Number(targetQuarter),
      targetYear: Number(targetYear),
      keepOriginalOwner: keepOriginalOwner !== false,
      newOwnerId: newOwnerId || undefined,
      cloneScope,
    });
    
    res.json(clonedObjective);
  } catch (error) {
    console.error("Error cloning objective:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Key Results
okrRouter.get("/objectives/:objectiveId/key-results", async (req, res) => {
  try {
    const keyResults = await storage.getKeyResultsByObjectiveId(req.params.objectiveId);
    res.json(keyResults);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get all key results for a tenant (optionally filtered by quarter/year/team)
okrRouter.get("/key-results", async (req, res) => {
  try {
    const { tenantId, quarter, year, teamId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const keyResults = await storage.getKeyResultsByTenantId(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined,
      teamId as string | undefined
    );
    
    const hydrated = await hydrateEntitiesWithCustomFields(tenantId as string, 'key_result', keyResults);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/key-results/:id", async (req, res) => {
  try {
    const keyResult = await storage.getKeyResultById(req.params.id);
    if (!keyResult) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    const [hydrated] = await hydrateEntitiesWithCustomFields(keyResult.tenantId, 'key_result', [keyResult]);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/key-results", async (req, res) => {
  try {
    const { customFields, ...rest } = req.body || {};
    const validatedData = insertKeyResultSchema.parse(rest);
    // Always use the server-resolved tenant context – ignore any client-supplied tenantId
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    // Auto-set createdBy from authenticated user so the creator can always edit their own items
    const keyResultData = {
      ...validatedData,
      tenantId: effectiveTenantId,
      createdBy: validatedData.createdBy || req.user?.id || null,
    };
    const keyResult = await storage.createKeyResult(keyResultData);
    try {
      await applyCustomFields(effectiveTenantId, 'key_result', keyResult.id, customFields);
    } catch (cfError: any) {
      return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
    }
    // Task #59: Adding a KR is a substantive change — requeue the parent OKR
    // for approval if approvals are on and it was active.
    const krSession = req.session as any;
    await maybeRequeueParentForKrChange(
      (keyResult as any).objectiveId,
      krSession?.passport?.user?.id || krSession?.userId || null,
      krSession?.passport?.user?.email || krSession?.userEmail || null,
    );
    res.json(keyResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Fields on a key result whose mutation requires re-approval of the parent OKR.
const KR_SUBSTANTIVE_FIELDS = new Set([
  'title', 'targetValue', 'initialValue', 'unit', 'direction',
  'measurementType', 'ownerId', 'ownerEmail',
]);

okrRouter.patch("/key-results/:id", async (req, res) => {
  try {
    const { customFields, ...body } = req.body || {};
    const updateData = { ...body };
    
    // Check if key result is closed - only allow status changes (reopen)
    const existingKeyResult = await storage.getKeyResultById(req.params.id);
    if (!existingKeyResult) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    
    // RBAC: Check if user can modify this key result
    if (!canUserModifyOKR(req, existingKeyResult.ownerId, existingKeyResult.createdBy, (existingKeyResult as any).ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only edit key results you own or created. Contact an admin for help."
      });
    }
    
    if (existingKeyResult?.status === 'closed') {
      const isStatusChange = updateData.status && updateData.status !== 'closed';
      
      // Only allow reopening (status change from closed to another status)
      if (!isStatusChange) {
        return res.status(403).json({ 
          error: "This key result is closed. Change the status to reopen it before making other edits." 
        });
      }
    }
    
    // Also check if the parent objective is closed
    if (existingKeyResult?.objectiveId) {
      const parentObjective = await storage.getObjectiveById(existingKeyResult.objectiveId);
      if (parentObjective?.status === 'closed') {
        const isStatusChange = updateData.status && updateData.status !== 'closed';
        if (!isStatusChange) {
          return res.status(403).json({ 
            error: "The parent objective is closed. Reopen the objective first to edit its key results." 
          });
        }
      }
    }
    
    const keyResult = await storage.updateKeyResult(req.params.id, updateData);
    if (customFields !== undefined) {
      try {
        await applyCustomFields(keyResult.tenantId, 'key_result', keyResult.id, customFields);
      } catch (cfError: any) {
        return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
      }
    }

    // Task #59: requeue parent OKR if a substantive KR field changed.
    const isSubstantive = Object.keys(updateData).some((k) => {
      if (!KR_SUBSTANTIVE_FIELDS.has(k)) return false;
      return JSON.stringify(updateData[k] ?? null) !== JSON.stringify((existingKeyResult as any)[k] ?? null);
    });
    if (isSubstantive) {
      const krSession = req.session as any;
      await maybeRequeueParentForKrChange(
        (existingKeyResult as any).objectiveId,
        krSession?.passport?.user?.id || krSession?.userId || null,
        krSession?.passport?.user?.email || krSession?.userEmail || null,
      );
    }

    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.delete("/key-results/:id", async (req, res) => {
  try {
    // RBAC: Check if user has DELETE_OKR permission
    if (!canUserDeleteOKR(req)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You do not have permission to delete key results."
      });
    }

    // Capture parent objective before delete so we can requeue afterward
    const existing = await storage.getKeyResultById(req.params.id);
    await storage.deleteKeyResult(req.params.id, (req as any).user?.id);

    if (existing) {
      const krSession = req.session as any;
      await maybeRequeueParentForKrChange(
        (existing as any).objectiveId,
        krSession?.passport?.user?.id || krSession?.userId || null,
        krSession?.passport?.user?.email || krSession?.userEmail || null,
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Key Result to KPI Promotion
okrRouter.post("/key-results/:id/promote-to-kpi", async (req, res) => {
  try {
    const userId = req.session?.userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }
    
    const kpi = await storage.promoteKeyResultToKpi(req.params.id, userId);
    res.json(kpi);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/key-results/:id/unpromote-from-kpi", async (req, res) => {
  try {
    const keyResult = await storage.unpromoteKeyResultFromKpi(req.params.id);
    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Big Rocks (Initiatives)
okrRouter.get("/big-rocks", async (req, res) => {
  try {
    const { tenantId, quarter, year } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const bigRocks = await storage.getBigRocksByTenantId(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined
    );
    
    const hydrated = await hydrateEntitiesWithCustomFields(tenantId as string, 'big_rock', bigRocks);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/big-rocks/:id", async (req, res) => {
  try {
    const bigRock = await storage.getBigRockById(req.params.id);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    const [hydrated] = await hydrateEntitiesWithCustomFields(bigRock.tenantId, 'big_rock', [bigRock]);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/objectives/:objectiveId/big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksByObjectiveId(req.params.objectiveId);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/key-results/:keyResultId/big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksByKeyResultId(req.params.keyResultId);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/big-rocks", async (req, res) => {
  try {
    const { customFields, ...rest } = req.body || {};
    const validatedData = insertBigRockSchema.parse(rest);
    // Always use the server-resolved tenant context – ignore any client-supplied tenantId
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    // Auto-set createdBy from authenticated user so the creator can always edit their own items
    const bigRockData = {
      ...validatedData,
      tenantId: effectiveTenantId,
      createdBy: validatedData.createdBy || req.user?.id || null,
    };
    const bigRock = await storage.createBigRock(bigRockData);
    try {
      await applyCustomFields(effectiveTenantId, 'big_rock', bigRock.id, customFields);
    } catch (cfError: any) {
      return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
    }
    res.json(bigRock);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.patch("/big-rocks/:id", async (req, res) => {
  try {
    // Convert empty strings to null for foreign key fields
    const { customFields, ...body } = req.body || {};
    const updateData = { ...body };
    if (updateData.objectiveId === "") updateData.objectiveId = null;
    if (updateData.keyResultId === "") updateData.keyResultId = null;
    
    // Fetch existing big rock to check ownership
    const existingBigRock = await storage.getBigRockById(req.params.id);
    if (!existingBigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Check if user can modify this big rock
    if (!canUserModifyOKR(req, existingBigRock.ownerId, existingBigRock.createdBy, existingBigRock.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only edit big rocks you own or created. Contact an admin for help."
      });
    }
    
    const bigRock = await storage.updateBigRock(req.params.id, updateData);
    if (customFields !== undefined) {
      try {
        await applyCustomFields(bigRock.tenantId, 'big_rock', bigRock.id, customFields);
      } catch (cfError: any) {
        return res.status(400).json({ error: `Custom field error: ${cfError.message}` });
      }
    }
    res.json(bigRock);
  } catch (error) {
    console.error('[Big Rock Update] Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.delete("/big-rocks/:id", async (req, res) => {
  try {
    // RBAC: Check if user has DELETE_OKR permission
    if (!canUserDeleteOKR(req)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You do not have permission to delete big rocks."
      });
    }
    
    await storage.deleteBigRock(req.params.id, (req as any).user?.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ============ Big Rock Tasks ============

// Get all tasks for a big rock
okrRouter.get("/big-rocks/:bigRockId/tasks", async (req, res) => {
  try {
    const tasks = await storage.getBigRockTasksByBigRockId(req.params.bigRockId);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create a task for a big rock
okrRouter.post("/big-rocks/:bigRockId/tasks", requireValidatedTenant, async (req, res) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const user = req.user!;
    
    // Verify big rock exists and belongs to tenant
    const bigRock = await storage.getBigRockByIdForTenant(req.params.bigRockId, tenantId);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Check if user can modify this big rock (they can add tasks)
    if (!canUserModifyOKR(req, bigRock.ownerId, bigRock.createdBy, bigRock.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only add tasks to Big Rocks you own or created."
      });
    }
    
    const task = await storage.createBigRockTask({
      tenantId,
      bigRockId: req.params.bigRockId,
      title: req.body.title,
      description: req.body.description || null,
      status: req.body.status || 'open',
      assigneeId: req.body.assigneeId || null,
      assigneeEmail: req.body.assigneeEmail || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      createdById: user.id,
    });
    
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update a task
okrRouter.patch("/big-rocks/:bigRockId/tasks/:taskId", requireValidatedTenant, async (req, res) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const user = req.user!;
    
    // Verify task exists
    const existingTask = await storage.getBigRockTaskById(req.params.taskId);
    if (!existingTask || existingTask.bigRockId !== req.params.bigRockId) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Verify big rock exists and belongs to tenant
    const bigRock = await storage.getBigRockByIdForTenant(req.params.bigRockId, tenantId);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Allow big rock owner, task assignee, or admins to update
    const isOwner = canUserModifyOKR(req, bigRock.ownerId, bigRock.createdBy, bigRock.ownerEmail);
    const isAssignee = existingTask.assigneeId === user.id || existingTask.assigneeEmail === user.email;
    
    if (!isOwner && !isAssignee) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only update tasks you are assigned to or Big Rocks you own."
      });
    }
    
    const updateData: any = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.assigneeId !== undefined) updateData.assigneeId = req.body.assigneeId;
    if (req.body.assigneeEmail !== undefined) updateData.assigneeEmail = req.body.assigneeEmail;
    if (req.body.dueDate !== undefined) updateData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    
    const task = await storage.updateBigRockTask(req.params.taskId, updateData);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Delete a task
okrRouter.delete("/big-rocks/:bigRockId/tasks/:taskId", requireValidatedTenant, async (req, res) => {
  try {
    const tenantId = req.effectiveTenantId!;
    
    // Verify task exists
    const existingTask = await storage.getBigRockTaskById(req.params.taskId);
    if (!existingTask || existingTask.bigRockId !== req.params.bigRockId) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Verify big rock exists and belongs to tenant
    const bigRock = await storage.getBigRockByIdForTenant(req.params.bigRockId, tenantId);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Only big rock owner/creator or admins can delete tasks
    if (!canUserModifyOKR(req, bigRock.ownerId, bigRock.createdBy, bigRock.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only delete tasks from Big Rocks you own."
      });
    }
    
    await storage.deleteBigRockTask(req.params.taskId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Reorder tasks
okrRouter.post("/big-rocks/:bigRockId/tasks/reorder", requireValidatedTenant, async (req, res) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const { taskIds } = req.body;
    
    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: "taskIds must be an array" });
    }
    
    // Verify big rock exists and belongs to tenant
    const bigRock = await storage.getBigRockByIdForTenant(req.params.bigRockId, tenantId);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Only big rock owner/creator can reorder
    if (!canUserModifyOKR(req, bigRock.ownerId, bigRock.createdBy, bigRock.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only reorder tasks in Big Rocks you own."
      });
    }
    
    await storage.reorderBigRockTasks(req.params.bigRockId, taskIds);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get task counts for multiple big rocks (for badges)
okrRouter.post("/big-rocks/task-counts", async (req, res) => {
  try {
    const { bigRockIds } = req.body;
    
    if (!Array.isArray(bigRockIds)) {
      return res.status(400).json({ error: "bigRockIds must be an array" });
    }
    
    const counts = await storage.getBigRockTaskCountsByBigRockIds(bigRockIds);
    
    // Convert Map to object for JSON serialization
    const result: Record<string, { total: number; completed: number }> = {};
    counts.forEach((value, key) => {
      result[key] = value;
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/big-rocks/linked-objectives", async (req, res) => {
  try {
    const { bigRockIds } = req.body;
    
    if (!Array.isArray(bigRockIds)) {
      return res.status(400).json({ error: "bigRockIds must be an array" });
    }
    
    const linkedMap = await storage.getLinkedObjectiveIdsForBigRocks(bigRockIds);
    
    const result: Record<string, string[]> = {};
    linkedMap.forEach((value, key) => {
      result[key] = value;
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/big-rocks/:id/clone", requireValidatedTenant, async (req, res) => {
  try {
    const { targetQuarter, targetYear, keepOriginalOwner, newOwnerId, keepLinkedOKR } = req.body;
    
    // requireValidatedTenant ensures req.user and req.effectiveTenantId are set
    const tenantId = req.effectiveTenantId!;
    const user = req.user!;
    
    // Use tenant-scoped lookup to prevent cross-tenant enumeration
    const originalBigRock = await storage.getBigRockByIdForTenant(req.params.id, tenantId);
    if (!originalBigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    
    // RBAC: Check if user can modify (and thus clone) this big rock
    if (!canUserModifyOKR(req, originalBigRock.ownerId, originalBigRock.createdBy, originalBigRock.ownerEmail)) {
      return res.status(403).json({ 
        error: "Access denied",
        message: "You can only clone Big Rocks you own or created. Contact an admin for help."
      });
    }
    
    const clonedBigRock = await storage.createBigRock({
      tenantId: tenantId,
      title: originalBigRock.title,
      description: originalBigRock.description,
      quarter: targetQuarter,
      year: targetYear,
      status: "not_started",
      ownerId: keepOriginalOwner ? originalBigRock.ownerId : (newOwnerId || user.id),
      ownerEmail: keepOriginalOwner ? originalBigRock.ownerEmail : null,
      objectiveId: keepLinkedOKR ? originalBigRock.objectiveId : null,
      keyResultId: keepLinkedOKR ? originalBigRock.keyResultId : null,
      linkedStrategies: originalBigRock.linkedStrategies,
      dueDate: null,
      tasks: null,
      blockedBy: null,
      createdBy: user.id,
    });
    
    res.json(clonedBigRock);
  } catch (error) {
    console.error('[Big Rock Clone] Error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Link/Unlink Big Rocks to Objectives
okrRouter.post("/objectives/:id/link-big-rock", async (req, res) => {
  try {
    const { bigRockId, tenantId } = req.body;
    if (!bigRockId || !tenantId) {
      return res.status(400).json({ error: "bigRockId and tenantId are required" });
    }
    
    await storage.linkObjectiveToBigRock(req.params.id, bigRockId, tenantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.delete("/objectives/:id/link-big-rock/:bigRockId", async (req, res) => {
  try {
    await storage.unlinkObjectiveToBigRock(req.params.id, req.params.bigRockId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/objectives/:id/linked-big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksLinkedToObjective(req.params.id);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Link/Unlink Big Rocks to Key Results
okrRouter.post("/key-results/:id/link-big-rock", async (req, res) => {
  try {
    const { bigRockId, tenantId } = req.body;
    if (!bigRockId || !tenantId) {
      return res.status(400).json({ error: "bigRockId and tenantId are required" });
    }
    
    await storage.linkKeyResultToBigRock(req.params.id, bigRockId, tenantId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.delete("/key-results/:id/link-big-rock/:bigRockId", async (req, res) => {
  try {
    await storage.unlinkKeyResultToBigRock(req.params.id, req.params.bigRockId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.get("/key-results/:id/linked-big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksLinkedToKeyResult(req.params.id);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Hierarchical OKR View
okrRouter.get("/hierarchy", async (req, res) => {
  try {
    const { tenantId, quarter, year, level, teamId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const hierarchy = await storage.getObjectiveHierarchy(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined,
      level as string | undefined,
      teamId as string | undefined
    );
    
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Focused sub-tree load for detail pages — only walks the descendants of
// :id rather than the full tenant hierarchy. Uses the recursive CTE under
// the hood so we only fetch the rows we need.
okrRouter.get("/objectives/:id/subtree", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }

    // Tenant scoping: ensure the requested objective belongs to the caller's tenant.
    const effectiveTenantId = req.effectiveTenantId || objective.tenantId;
    if (objective.tenantId !== effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const subtree = await storage.getObjectiveSubtree(req.params.id, objective.tenantId);
    res.json(subtree);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Check-Ins
okrRouter.get("/check-ins", async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({ error: "entityType and entityId are required" });
    }
    
    if (entityType === 'all' && entityId === 'all') {
      // Accept tenantId from query param first (explicit), then fall back to header/session
      const queryTenantId = req.query.tenantId as string | undefined;
      const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
      const tenantId = queryTenantId || headerTenantId || (req.session as any).currentTenantId || (req as any).user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }
      const allCheckIns = await storage.getCheckInsByTenantId(tenantId);
      return res.json(allCheckIns);
    }
    
    const checkIns = await storage.getCheckInsByEntityId(
      entityType as string,
      entityId as string
    );
    
    res.json(checkIns);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.post("/check-ins", async (req, res) => {
  try {
    const validatedData = insertCheckInSchema.parse(req.body);
    
    // Check if entity is closed - block check-ins on closed OKRs
    const { entityType, entityId } = validatedData;
    let entityCurrentProgress: number | null = null;
    if (entityType === "objective") {
      const objective = await storage.getObjectiveById(entityId);
      if (objective?.status === 'closed') {
        return res.status(403).json({ 
          error: "Cannot check in on a closed objective. Reopen it first." 
        });
      }
      entityCurrentProgress = objective?.progress ?? null;
    } else if (entityType === "key_result") {
      const keyResult = await storage.getKeyResultById(entityId);
      if (keyResult?.status === 'closed') {
        return res.status(403).json({ 
          error: "Cannot check in on a closed key result. Reopen it first." 
        });
      }
      entityCurrentProgress = keyResult?.progress ?? null;
      // Also check parent objective
      if (keyResult?.objectiveId) {
        const parentObjective = await storage.getObjectiveById(keyResult.objectiveId);
        if (parentObjective?.status === 'closed') {
          return res.status(403).json({ 
            error: "Cannot check in - the parent objective is closed. Reopen the objective first." 
          });
        }
      }
    } else if (entityType === "big_rock") {
      const bigRock = await storage.getBigRockById(entityId);
      if (bigRock?.status === 'closed') {
        return res.status(403).json({ 
          error: "Cannot check in on a closed Big Rock. Reopen it first." 
        });
      }
      entityCurrentProgress = bigRock?.completionPercentage ?? null;
    }
    
    // Default newProgress to entity's current progress when not provided (status/note-only check-ins)
    if (validatedData.newProgress === undefined || validatedData.newProgress === null) {
      validatedData.newProgress = entityCurrentProgress ?? 0;
    }
    // Safety net: completing an objective or big rock must push progress to 100
    if (
      validatedData.newStatus === 'completed' &&
      (entityType === 'objective' || entityType === 'big_rock') &&
      (validatedData.newProgress as number) < 100
    ) {
      validatedData.newProgress = 100;
    }
    
    // Convert asOfDate from ISO string to Date object for Drizzle
    if (validatedData.asOfDate && typeof validatedData.asOfDate === 'string') {
      validatedData.asOfDate = new Date(validatedData.asOfDate) as any;
    }
    const asOfDate: Date = (validatedData.asOfDate as unknown as Date) || new Date();

    // Determine previousProgress/previousValue from the check-in immediately preceding
    // the selected asOfDate — NOT from the entity's current (possibly later) state.
    // This overrides whatever the client sent so backdated entries reflect true history.
    const priorCheckIn = await storage.getCheckInBefore(entityType, entityId, asOfDate);
    if (priorCheckIn) {
      validatedData.previousProgress = priorCheckIn.newProgress ?? 0;
      validatedData.previousValue = priorCheckIn.newValue ?? undefined;
    } else {
      validatedData.previousProgress = 0;
      if (entityType === "key_result") {
        const keyResultForFallback = await storage.getKeyResultById(entityId);
        validatedData.previousValue = keyResultForFallback?.initialValue ?? 0;
      } else {
        validatedData.previousValue = undefined;
      }
    }
    
    const checkIn = await storage.createCheckIn(validatedData);
    
    // Only the most recent check-in (by asOfDate) for an entity is authoritative for the
    // entity's live state. Backdating a missed check-in must not clobber current values.
    const latestCheckIn = await storage.getLatestCheckIn(entityType, entityId);
    const isLatestCheckIn = latestCheckIn?.id === checkIn.id;
    
    // Update the entity with the latest check-in information
    // entityType and entityId already declared above
    
    if (isLatestCheckIn && entityType === "objective") {
      const updateData: Record<string, unknown> = {
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      };
      // Only overwrite progress when explicitly provided to avoid corrupting existing values
      if (checkIn.newProgress !== undefined && checkIn.newProgress !== null) {
        updateData.progress = checkIn.newProgress;
      }
      if (checkIn.newStatus) {
        updateData.status = checkIn.newStatus;
        updateData.statusOverride = 'true';
      }
      
      await storage.updateObjective(entityId, updateData);
    } else if (isLatestCheckIn && entityType === "key_result") {
      // Get the Key Result to recalculate progress from values
      const keyResult = await storage.getKeyResultById(entityId);

      const hasNewValue = checkIn.newValue !== undefined && checkIn.newValue !== null;
      const hasNewProgress = checkIn.newProgress !== undefined && checkIn.newProgress !== null;

      // Recalculate progress server-side only when new value/progress is explicitly provided
      let calculatedProgress: number | undefined;
      if (keyResult && hasNewValue) {
        const currentValue = checkIn.newValue as number;
        const targetValue = keyResult.targetValue ?? 0;
        const initialValue = keyResult.initialValue ?? 0;
        const metricType = keyResult.metricType || "increase";
        
        calculatedProgress = calculateKeyResultProgress(
          currentValue,
          targetValue,
          initialValue,
          metricType
        );
      } else if (hasNewProgress) {
        calculatedProgress = checkIn.newProgress as number;
      }
      // If neither value nor progress provided, leave progress unchanged
      
      // Update the key result — only include fields that are explicitly provided
      const krUpdate: Record<string, unknown> = {
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      };
      if (hasNewValue) krUpdate.currentValue = checkIn.newValue;
      if (calculatedProgress !== undefined) krUpdate.progress = calculatedProgress;

      await storage.updateKeyResult(entityId, krUpdate);
      
      // Recalculate parent objective's progress (includes both KRs and child objectives)
      if (keyResult && keyResult.objectiveId && (hasNewValue || hasNewProgress)) {
        const objective = await storage.getObjectiveById(keyResult.objectiveId);
        
        // Only recalculate if using rollup mode
        if (objective && objective.progressMode === 'rollup') {
          const newProgress = await calculateObjectiveRollupProgress(keyResult.objectiveId);
          
          // Update parent objective progress
          await storage.updateObjective(keyResult.objectiveId, {
            progress: newProgress,
          });
        }
      }
    } else if (isLatestCheckIn && entityType === "big_rock") {
      const brUpdate: Record<string, unknown> = {
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      };
      // Only overwrite completionPercentage when explicitly provided
      if (checkIn.newProgress !== undefined && checkIn.newProgress !== null) {
        brUpdate.completionPercentage = checkIn.newProgress;
      }
      await storage.updateBigRock(entityId, brUpdate);
    }
    
    res.json(checkIn);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

okrRouter.patch("/check-ins/:id", async (req, res) => {
  try {
    const validatedData = updateCheckInSchema.parse(req.body);
    
    // Get the existing check-in to know which entity it belongs to
    const existingCheckIn = await storage.getCheckInById(req.params.id);
    if (!existingCheckIn) {
      return res.status(404).json({ error: "Check-in not found" });
    }
    
    // Convert asOfDate from ISO string to Date object for Drizzle
    const updateData: any = { ...validatedData };
    if (updateData.asOfDate && typeof updateData.asOfDate === 'string') {
      updateData.asOfDate = new Date(updateData.asOfDate);
    }
    
    const checkIn = await storage.updateCheckIn(req.params.id, updateData);
    
    // Update the entity with the latest check-in information
    const { entityType, entityId } = existingCheckIn;
    
    if (entityType === "objective") {
      const objectiveUpdateData: any = {
        progress: checkIn.newProgress,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      };
      
      if (checkIn.newStatus) {
        objectiveUpdateData.status = checkIn.newStatus;
        objectiveUpdateData.statusOverride = 'true';
      }
      
      await storage.updateObjective(entityId, objectiveUpdateData);
    } else if (entityType === "key_result") {
      // Get the Key Result to recalculate progress from values
      const keyResult = await storage.getKeyResultById(entityId);
      
      // Recalculate progress server-side to ensure accuracy
      let calculatedProgress = checkIn.newProgress || 0;
      if (keyResult && checkIn.newValue !== undefined && checkIn.newValue !== null) {
        const currentValue = checkIn.newValue;
        const targetValue = keyResult.targetValue ?? 0;
        const initialValue = keyResult.initialValue ?? 0;
        const metricType = keyResult.metricType || "increase";
        
        calculatedProgress = calculateKeyResultProgress(
          currentValue,
          targetValue,
          initialValue,
          metricType
        );
      }
      
      // Update the key result with recalculated progress
      await storage.updateKeyResult(entityId, {
        currentValue: checkIn.newValue,
        progress: calculatedProgress,
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      });
      
      // Recalculate parent objective's progress (includes both KRs and child objectives)
      if (keyResult && keyResult.objectiveId) {
        const objective = await storage.getObjectiveById(keyResult.objectiveId);
        
        // Only recalculate if using rollup mode
        if (objective && objective.progressMode === 'rollup') {
          const newProgress = await calculateObjectiveRollupProgress(keyResult.objectiveId);
          
          // Update parent objective progress
          await storage.updateObjective(keyResult.objectiveId, {
            progress: newProgress,
          });
        }
      }
    } else if (entityType === "big_rock") {
      await storage.updateBigRock(entityId, {
        completionPercentage: checkIn.newProgress,
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      });
    }
    
    res.json(checkIn);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Delete a check-in
okrRouter.delete("/check-ins/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    const checkIn = await storage.getCheckInById(req.params.id);
    
    if (!checkIn) {
      return res.status(404).json({ error: "Check-in not found" });
    }
    
    // Check if user has permission to delete (must be creator or have admin role)
    const canDelete = checkIn.userId === user?.id || 
      ['admin', 'vega_consultant', 'vega_admin', 'global_admin'].includes(user?.role);
    
    if (!canDelete) {
      return res.status(403).json({ error: "You don't have permission to delete this check-in" });
    }
    
    await storage.deleteCheckIn(req.params.id);
    
    // After deleting, update the entity to reflect the most recent remaining check-in
    const { entityType, entityId } = checkIn;
    const latestCheckIn = await storage.getLatestCheckIn(entityType, entityId);
    
    if (entityType === "objective") {
      if (latestCheckIn) {
        await storage.updateObjective(entityId, {
          progress: latestCheckIn.newProgress,
          lastCheckInAt: latestCheckIn.createdAt,
          lastCheckInNote: latestCheckIn.note || undefined,
          status: latestCheckIn.newStatus || undefined,
        });
      } else {
        // No remaining check-ins - restore to previous state, defaulting to 0 if unknown
        await storage.updateObjective(entityId, {
          progress: checkIn.previousProgress ?? 0,
          lastCheckInAt: null,
          lastCheckInNote: null,
        });
      }
    } else if (entityType === "key_result") {
      const keyResult = await storage.getKeyResultById(entityId);
      if (keyResult) {
        if (latestCheckIn) {
          await storage.updateKeyResult(entityId, {
            currentValue: latestCheckIn.newValue,
            progress: latestCheckIn.newProgress,
            lastCheckInAt: latestCheckIn.createdAt,
            lastCheckInNote: latestCheckIn.note || undefined,
            status: latestCheckIn.newStatus || undefined,
          });
        } else {
          // No remaining check-ins - restore to previous state, using initialValue as fallback
          await storage.updateKeyResult(entityId, {
            currentValue: checkIn.previousValue ?? keyResult.initialValue ?? 0,
            progress: checkIn.previousProgress ?? 0,
            lastCheckInAt: null,
            lastCheckInNote: null,
          });
        }
        
        // Recalculate parent objective's progress
        if (keyResult.objectiveId) {
          const objective = await storage.getObjectiveById(keyResult.objectiveId);
          if (objective && objective.progressMode === 'rollup') {
            const newProgress = await calculateObjectiveRollupProgress(keyResult.objectiveId);
            await storage.updateObjective(keyResult.objectiveId, { progress: newProgress });
          }
        }
      }
    } else if (entityType === "big_rock") {
      if (latestCheckIn) {
        await storage.updateBigRock(entityId, {
          completionPercentage: latestCheckIn.newProgress,
          status: latestCheckIn.newStatus || undefined,
          lastCheckInAt: latestCheckIn.createdAt,
          lastCheckInNote: latestCheckIn.note || undefined,
        });
      } else {
        // No remaining check-ins - restore to previous state, defaulting to 0 if unknown
        await storage.updateBigRock(entityId, {
          completionPercentage: checkIn.previousProgress ?? 0,
          lastCheckInAt: null,
          lastCheckInNote: null,
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete check-in:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Calculate progress with weighted contributions
okrRouter.get("/objectives/:id/calculate-progress", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    
    // If manual progress mode, return the current progress
    if (objective.progressMode === 'manual') {
      return res.json({ progress: objective.progress });
    }
    
    // Calculate from key results and child objectives
    const calculatedProgress = await calculateObjectiveRollupProgress(req.params.id);
    
    // Update the objective with calculated progress
    await storage.updateObjective(req.params.id, { progress: calculatedProgress });
    
    res.json({ progress: calculatedProgress });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Helper function to calculate progress from values based on metricType
export function calculateKeyResultProgress(
  currentValue: number,
  targetValue: number,
  initialValue: number,
  metricType: string
): number {
  let progress = 0;
  
  if (metricType === "increase") {
    const denominator = targetValue - initialValue;
    if (denominator === 0) {
      progress = currentValue >= targetValue ? 100 : 0;
    } else if (denominator > 0) {
      progress = ((currentValue - initialValue) / denominator) * 100;
    } else {
      progress = 0;
    }
  } else if (metricType === "decrease") {
    const denominator = initialValue - targetValue;
    if (denominator === 0) {
      progress = currentValue <= targetValue ? 100 : 0;
    } else if (denominator > 0) {
      progress = ((initialValue - currentValue) / denominator) * 100;
    } else {
      progress = 0;
    }
  } else if (metricType === "maintain") {
    if (targetValue === 0) {
      progress = Math.abs(currentValue) <= 0.05 ? 100 : 0;
    } else {
      const deviation = Math.abs(currentValue - targetValue) / Math.abs(targetValue);
      progress = deviation <= 0.05 ? 100 : Math.max(0, 100 - (deviation * 100));
    }
  } else if (metricType === "complete") {
    if (targetValue === 0 || targetValue < 0) {
      progress = 0;
    } else {
      progress = currentValue >= targetValue ? 100 : (currentValue / targetValue) * 100;
    }
  } else {
    // Unknown / null metricType — fall back to a simple current/target ratio so
    // KRs that were created without an explicit metric type still record non-zero
    // progress when check-ins are submitted with a value.
    progress = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  }
  
  // Allow >100% for exceeding targets, only clamp negative to 0
  return isNaN(progress) ? 0 : Math.max(0, Math.round(progress));
}

// Backfill endpoint: Recalculate all Key Result progress values from currentValue/targetValue
okrRouter.post("/backfill-progress", async (req, res) => {
  try {
    // Get all key results
    const allKeyResults = await storage.getAllKeyResults();
    let updated = 0;
    let errors = 0;
    const results: any[] = [];
    
    for (const kr of allKeyResults) {
      try {
        const currentValue = kr.currentValue ?? 0;
        const targetValue = kr.targetValue ?? 0;
        const initialValue = kr.initialValue ?? 0;
        const metricType = kr.metricType || "increase";
        
        const newProgress = calculateKeyResultProgress(
          currentValue,
          targetValue,
          initialValue,
          metricType
        );
        
        const oldProgress = kr.progress || 0;
        
        if (newProgress !== oldProgress) {
          await storage.updateKeyResult(kr.id, { progress: newProgress });
          results.push({
            id: kr.id,
            title: kr.title,
            currentValue,
            targetValue,
            initialValue,
            metricType,
            oldProgress,
            newProgress,
          });
          updated++;
        }
      } catch (err) {
        console.error(`[Backfill] Error updating KR ${kr.id}:`, err);
        errors++;
      }
    }
    
    // Now recalculate all objective rollups (includes both KRs and child objectives)
    const allObjectives = await storage.getAllObjectives();
    let objectivesUpdated = 0;
    
    for (const obj of allObjectives) {
      if (obj.progressMode === 'rollup') {
        try {
          const newProgress = await calculateObjectiveRollupProgress(obj.id);
          
          if (newProgress !== obj.progress) {
            await storage.updateObjective(obj.id, { progress: newProgress });
            objectivesUpdated++;
          }
        } catch (err) {
          console.error(`[Backfill] Error updating Objective ${obj.id}:`, err);
        }
      }
    }
    
    res.json({
      success: true,
      keyResultsUpdated: updated,
      objectivesUpdated,
      errors,
      details: results,
    });
  } catch (error) {
    console.error('[Backfill] Failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ============================================
// OKR INTELLIGENCE: Pace & Velocity Metrics
// ============================================

import { calculatePaceMetrics, formatPaceDescription, calculateCompletionForecast, type PaceMetrics, type CompletionForecast, type TrendDirection, type CheckInData } from './okr-intelligence';
import { getTrendSeriesForEntity, getTrendSeriesForEntities, getPacificDateString } from './services/progress-snapshots';

// Build a trend series for the OKR detail chart that includes paceStatus per
// point. Pulls from progress_snapshots (which carry paceStatus captured at
// the time the snapshot was taken) and falls back to raw check-ins (without
// paceStatus) when no snapshots exist for the entity yet.
//
// Always injects a "live today" point from the most recent check-in so the
// chart reflects check-ins submitted since the last midnight snapshot without
// waiting until the next nightly run.
async function getTrendSeriesWithPace(
  entityType: 'objective' | 'key_result',
  entityId: string,
): Promise<Array<{ date: string; progress: number; confidence: number | null; paceStatus: string | null; isLive?: boolean }>> {
  const snapshots = await storage.getProgressSnapshotsByEntity(entityType, entityId);

  if (snapshots.length > 0) {
    const series: Array<{ date: string; progress: number; confidence: number | null; paceStatus: string | null; isLive?: boolean }> = snapshots.map(s => ({
      date: s.snapshotDate,
      progress: s.progress ?? 0,
      confidence: s.confidence ?? null,
      paceStatus: s.paceStatus ?? null,
    }));

    // Inject a live "today" point from the most recent check-in so that a
    // check-in submitted after today's midnight snapshot is visible immediately
    // in the chart rather than waiting until the next nightly run.
    try {
      const checkIns = await storage.getCheckInsByEntityId(entityType, entityId);
      if (checkIns.length > 0) {
        // getCheckInsByEntityId returns descending by date; take the first.
        const latest = checkIns[0];
        const todayStr = getPacificDateString();
        const lastSnapshotDate = series[series.length - 1].date.substring(0, 10);
        const latestCheckInDate = getPacificDateString(
          new Date(latest.asOfDate || latest.createdAt || Date.now()),
        );

        // Inject when the latest check-in is as recent as (or newer than) the
        // last snapshot — this covers: (a) check-in submitted today before the
        // midnight job ran, and (b) check-in submitted after today's snapshot.
        if (latestCheckInDate >= lastSnapshotDate) {
          const livePoint = {
            date: todayStr,
            progress: latest.newProgress ?? series[series.length - 1].progress,
            confidence: latest.confidence ?? null,
            // Carry forward the last known pace status so the dot is still coloured.
            paceStatus: series[series.length - 1].paceStatus,
            // Flag so the chart can render this differently from historical snapshots
            // (no connecting line to the historical series — avoids a jarring spike).
            isLive: true,
          };
          if (series[series.length - 1].date.substring(0, 10) === todayStr) {
            // Replace today's snapshot point with the more up-to-date check-in.
            series[series.length - 1] = livePoint;
          } else {
            series.push(livePoint);
          }
        }
      }
    } catch {
      // Non-fatal — chart degrades gracefully to snapshot-only data.
    }

    return series;
  }

  // Fallback: no snapshots yet — use raw check-ins directly (already current).
  const series = await getTrendSeriesForEntity(entityType, entityId);
  return series.map(p => ({
    date: typeof p.asOfDate === 'string' ? p.asOfDate : new Date(p.asOfDate).toISOString(),
    progress: p.newProgress,
    confidence: p.confidence ?? null,
    paceStatus: null,
  }));
}

// Aggregate weekly key-result progress trend from progress snapshots for the
// Executive Dashboard. Snapshot-backed so historical trend lines stay stable
// even when users edit or delete individual check-ins.
okrRouter.get("/progress-trend", async (req: any, res) => {
  try {
    // Always derive tenant from the authenticated session — never trust a
    // caller-supplied tenantId.
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    const { year } = req.query;
    const trendYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

    // Load all key results for this tenant, then their snapshots for the year.
    const krs = await storage.getKeyResultsByTenantId(effectiveTenantId);
    if (krs.length === 0) {
      return res.json({ tenantId: effectiveTenantId, year: trendYear, weeks: [] });
    }
    const fromDate = `${trendYear}-01-01`;
    const snapshotMap = await storage.getProgressSnapshotsByEntityIds(
      'key_result',
      krs.map(kr => kr.id),
      fromDate,
    );

    // Bucket snapshots into ISO weeks (Sun-anchored to match prior client behavior).
    const weekMap = new Map<string, { totalProgress: number; count: number; timestamp: number }>();
    let snapshotCount = 0;
    for (const snaps of Array.from(snapshotMap.values())) {
      for (const s of snaps) {
        if (!s.snapshotDate.startsWith(`${trendYear}-`)) continue;
        snapshotCount += 1;
        // Anchor at noon Pacific to avoid DST/timezone edge cases
        const d = new Date(`${s.snapshotDate}T12:00:00-08:00`);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        const normalized = Math.min(100, Math.max(0, s.progress ?? 0));
        const existing = weekMap.get(weekKey) || {
          totalProgress: 0,
          count: 0,
          timestamp: weekStart.getTime(),
        };
        existing.totalProgress += normalized;
        existing.count += 1;
        weekMap.set(weekKey, existing);
      }
    }

    // Fallback: when no snapshots exist yet for this tenant/year (e.g. before
    // the first daily run, or after a backfill failure), aggregate live
    // key-result check-ins by week so the dashboard stays populated. Matches
    // the previous client-side behavior. Snapshot path is preferred whenever
    // any snapshot exists since it's stable across check-in edits/deletes.
    let usedFallback = false;
    if (snapshotCount === 0) {
      usedFallback = true;
      const checkInMap = await storage.getCheckInsByEntityIds(
        'key_result',
        krs.map(kr => kr.id),
      );
      for (const checkIns of Array.from(checkInMap.values())) {
        for (const ci of checkIns) {
          const when = ci.asOfDate || ci.createdAt;
          if (!when) continue;
          const d = new Date(when);
          if (d.getFullYear() !== trendYear) continue;
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
          const normalized = Math.min(100, Math.max(0, ci.newProgress ?? 0));
          const existing = weekMap.get(weekKey) || {
            totalProgress: 0,
            count: 0,
            timestamp: weekStart.getTime(),
          };
          existing.totalProgress += normalized;
          existing.count += 1;
          weekMap.set(weekKey, existing);
        }
      }
    }

    const weeks = Array.from(weekMap.entries())
      .map(([key, data]) => ({
        week: key.split('-')[1],
        progress: Math.round(data.totalProgress / Math.max(1, data.count)),
        snapshots: data.count,
        timestamp: data.timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-8);

    res.json({ tenantId: effectiveTenantId, year: trendYear, weeks, source: usedFallback ? 'check_ins' : 'snapshots' });
  } catch (error) {
    console.error('[OKR Trend] Failed to get progress trend:', error);
    res.status(500).json({ error: "Failed to load progress trend" });
  }
});

// Get the daily trend series for an objective (snapshot-backed; falls back to
// raw check-ins if no snapshots have been captured yet for this entity).
// Used by the OKR detail chart so the trend line is stable even when users
// edit or delete individual check-ins.
okrRouter.get("/objectives/:id/trend", async (req: any, res) => {
  try {
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    if (objective.tenantId !== effectiveTenantId) {
      return res.status(404).json({ error: "Objective not found" });
    }
    const series = await getTrendSeriesWithPace('objective', req.params.id);
    res.json({
      entityType: 'objective',
      entityId: req.params.id,
      series,
    });
  } catch (error) {
    console.error('[OKR Trend] Failed to get objective trend:', error);
    res.status(500).json({ error: "Failed to load trend series" });
  }
});

// Get the daily trend series for a key result (snapshot-backed).
okrRouter.get("/key-results/:id/trend", async (req: any, res) => {
  try {
    const effectiveTenantId = req.effectiveTenantId;
    if (!effectiveTenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }
    const keyResult = await storage.getKeyResultById(req.params.id);
    if (!keyResult) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    if (keyResult.tenantId !== effectiveTenantId) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    const series = await getTrendSeriesWithPace('key_result', req.params.id);
    res.json({
      entityType: 'key_result',
      entityId: req.params.id,
      series,
    });
  } catch (error) {
    console.error('[OKR Trend] Failed to get key result trend:', error);
    res.status(500).json({ error: "Failed to load trend series" });
  }
});

// Get pace metrics for a specific objective
okrRouter.get("/objectives/:id/pace", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    
    const trendSeries = await getTrendSeriesForEntity('objective', req.params.id);
    
    const metrics = calculatePaceMetrics({
      progress: objective.progress || 0,
      startDate: objective.startDate,
      endDate: objective.endDate,
      quarter: objective.quarter,
      year: objective.year,
      checkIns: trendSeries,
    });
    
    res.json({
      objectiveId: req.params.id,
      title: objective.title,
      metrics,
      description: formatPaceDescription(metrics),
    });
  } catch (error) {
    console.error('[OKR Pace] Failed to get objective pace:', error);
    res.status(500).json({ error: "Failed to calculate pace metrics" });
  }
});

// Get pace metrics for a specific key result
okrRouter.get("/key-results/:id/pace", async (req, res) => {
  try {
    const keyResult = await storage.getKeyResultById(req.params.id);
    if (!keyResult) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    
    // Get parent objective for date info
    const objective = keyResult.objectiveId 
      ? await storage.getObjectiveById(keyResult.objectiveId)
      : null;
    
    const trendSeries = await getTrendSeriesForEntity('key_result', req.params.id);
    
    const metrics = calculatePaceMetrics({
      progress: keyResult.progress || 0,
      startDate: objective?.startDate,
      endDate: objective?.endDate,
      quarter: objective?.quarter,
      year: objective?.year,
      checkIns: trendSeries,
      // progress is already a 0-100 percentage; targetValue must match that scale
      targetValue: 100,
    });
    
    res.json({
      keyResultId: req.params.id,
      title: keyResult.title,
      metrics,
      description: formatPaceDescription(metrics),
    });
  } catch (error) {
    console.error('[OKR Pace] Failed to get key result pace:', error);
    res.status(500).json({ error: "Failed to calculate pace metrics" });
  }
});

// Bulk endpoint: Get pace metrics for all objectives in current view
okrRouter.get("/pace-metrics", async (req, res) => {
  try {
    const { tenantId, quarter, year } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    // Get objectives filtered by quarter/year if provided
    let objectives = await storage.getObjectivesByTenantId(tenantId as string);
    
    if (quarter && year) {
      objectives = objectives.filter(obj => 
        obj.quarter === parseInt(quarter as string) && 
        obj.year === parseInt(year as string)
      );
    }
    
    const results: Array<{
      objectiveId: string;
      title: string;
      metrics: PaceMetrics;
      description: string;
    }> = [];
    
    const trendMap = await getTrendSeriesForEntities('objective', objectives.map(o => o.id));
    
    for (const objective of objectives) {
      const metrics = calculatePaceMetrics({
        progress: objective.progress || 0,
        startDate: objective.startDate,
        endDate: objective.endDate,
        quarter: objective.quarter,
        year: objective.year,
        checkIns: trendMap.get(objective.id) || [],
      });
      
      results.push({
        objectiveId: objective.id,
        title: objective.title,
        metrics,
        description: formatPaceDescription(metrics),
      });
    }
    
    // Summary stats
    const summary = {
      total: results.length,
      ahead: results.filter(r => r.metrics.status === 'ahead').length,
      onTrack: results.filter(r => r.metrics.status === 'on_track').length,
      behind: results.filter(r => r.metrics.status === 'behind').length,
      atRisk: results.filter(r => r.metrics.status === 'at_risk').length,
      noData: results.filter(r => r.metrics.status === 'no_data').length,
      attentionNeeded: results.filter(r => r.metrics.riskSignal === 'attention_needed').length,
      stalled: results.filter(r => r.metrics.riskSignal === 'stalled').length,
    };
    
    res.json({ objectives: results, summary });
  } catch (error) {
    console.error('[OKR Pace] Failed to get bulk pace metrics:', error);
    res.status(500).json({ error: "Failed to calculate pace metrics" });
  }
});

okrRouter.get("/forecasts", async (req, res) => {
  try {
    const { tenantId, quarter, year } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const quarterNum = quarter ? parseInt(quarter as string) : undefined;
    const yearNum = year ? parseInt(year as string) : undefined;
    const objectives = await storage.getObjectivesByTenantId(
      tenantId as string,
      quarterNum,
      yearNum
    );

    const forecasts: Array<{
      objectiveId: string;
      title: string;
      progress: number;
      ownerEmail: string | null;
      level: string | null;
      status: string | null;
      forecast: CompletionForecast;
    }> = [];

    const forecastTrendMap = await getTrendSeriesForEntities('objective', objectives.map(o => o.id));

    for (const objective of objectives) {
      const forecast = calculateCompletionForecast({
        progress: objective.progress || 0,
        targetValue: 100,
        quarter: objective.quarter,
        year: objective.year,
        startDate: objective.startDate,
        endDate: objective.endDate,
        checkIns: forecastTrendMap.get(objective.id) || [],
      });

      forecasts.push({
        objectiveId: objective.id,
        title: objective.title,
        progress: objective.progress || 0,
        ownerEmail: objective.ownerEmail,
        level: objective.level,
        status: objective.status,
        forecast,
      });
    }

    const atRiskForecasts = forecasts.filter(f => f.forecast.riskFlag);
    const avgProbability = forecasts.length > 0
      ? Math.round(forecasts.reduce((sum, f) => sum + f.forecast.completionProbability, 0) / forecasts.length)
      : 0;
    const avgProjected = forecasts.length > 0
      ? Math.round(forecasts.reduce((sum, f) => sum + Math.min(f.forecast.projectedEndValue, 100), 0) / forecasts.length)
      : 0;

    const trendDistribution = {
      accelerating: forecasts.filter(f => f.forecast.trend === 'accelerating').length,
      steady: forecasts.filter(f => f.forecast.trend === 'steady').length,
      decelerating: forecasts.filter(f => f.forecast.trend === 'decelerating').length,
      insufficientData: forecasts.filter(f => f.forecast.trend === 'insufficient_data').length,
    };

    const probabilityBands = {
      high: forecasts.filter(f => f.forecast.completionProbability >= 75).length,
      medium: forecasts.filter(f => f.forecast.completionProbability >= 50 && f.forecast.completionProbability < 75).length,
      low: forecasts.filter(f => f.forecast.completionProbability < 50).length,
    };

    res.json({
      forecasts,
      summary: {
        total: forecasts.length,
        avgProbability,
        avgProjected,
        atRiskCount: atRiskForecasts.length,
        trendDistribution,
        probabilityBands,
      },
      atRisk: atRiskForecasts
        .sort((a, b) => a.forecast.completionProbability - b.forecast.completionProbability)
        .slice(0, 10),
    });
  } catch (error) {
    console.error('[OKR Forecast] Failed to calculate forecasts:', error);
    res.status(500).json({ error: "Failed to calculate forecasts" });
  }
});

// ============================================
// KR Webhook Tokens — CRUD
// Mounted under okrRouter so it inherits authWithTenant + license checks.
// ============================================

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateRandomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function buildIngestUrl(req: Request, token: string): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
  const base = host ? `${proto}://${host}` : "";
  return `${base}/api/ingest/v1/kr/${token}`;
}

// List tokens for a KR
okrRouter.get("/key-results/:keyResultId/webhook-tokens", async (req: Request, res: Response) => {
  try {
    const { keyResultId } = req.params;
    const kr = await storage.getKeyResultById(keyResultId);
    if (!kr) return res.status(404).json({ error: "Key result not found" });
    if (kr.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const tokens = await storage.getKrWebhookTokensByKeyResultId(keyResultId);
    // never expose hashes
    const safe = tokens.map((t) => ({
      id: t.id,
      label: t.label,
      enabled: t.enabled,
      lastUsedAt: t.lastUsedAt,
      failureCount: t.failureCount,
      successCount: t.successCount,
      createdAt: t.createdAt,
      revokedAt: t.revokedAt,
      createdByUserId: t.createdByUserId,
    }));
    res.json(safe);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Recent ingest activity for a single token (for the panel)
okrRouter.get("/webhook-tokens/:id/logs", async (req: Request, res: Response) => {
  try {
    const token = await storage.getKrWebhookTokenById(req.params.id);
    if (!token) return res.status(404).json({ error: "Token not found" });
    if (token.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const logs = await storage.getWebhookIngestLogsByTokenId(token.id, 25);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create a new token (returns the public token + secret ONCE)
okrRouter.post("/key-results/:keyResultId/webhook-tokens", async (req: Request, res: Response) => {
  try {
    const { keyResultId } = req.params;
    const kr = await storage.getKeyResultById(keyResultId);
    if (!kr) return res.status(404).json({ error: "Key result not found" });
    if (kr.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!canUserModifyOKR(req, kr.ownerId, kr.createdBy, null)) {
      return res.status(403).json({ error: "You can only manage tokens for KRs you own or created." });
    }

    const label = (req.body?.label || "").toString().trim().slice(0, 120) || "Webhook";
    const publicToken = generateRandomHex(32);
    const secret = generateRandomHex(32);

    const session = req.session as any;
    const userId = session?.passport?.user?.id || session?.userId || req.user?.id || null;

    const created = await storage.createKrWebhookToken({
      tenantId: kr.tenantId,
      keyResultId: kr.id,
      label,
      tokenHash: sha256Hex(publicToken),
      // We store the HMAC secret material AES-256-GCM encrypted at rest using
      // the project-wide TOKEN_ENCRYPTION_SECRET. The plaintext secret is shown
      // exactly once at creation/rotation. (Column name is historical.)
      secretHash: encryptToken(secret),
      enabled: true,
      createdByUserId: userId,
    } as any);

    res.json({
      id: created.id,
      label: created.label,
      enabled: created.enabled,
      createdAt: created.createdAt,
      // Shown ONCE — caller must store these
      token: publicToken,
      secret,
      url: buildIngestUrl(req, publicToken),
    });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Rotate: generate a new token+secret pair, revoke the old one.
okrRouter.post("/webhook-tokens/:id/rotate", async (req: Request, res: Response) => {
  try {
    const old = await storage.getKrWebhookTokenById(req.params.id);
    if (!old) return res.status(404).json({ error: "Token not found" });
    if (old.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const kr = await storage.getKeyResultById(old.keyResultId);
    if (!kr || !canUserModifyOKR(req, kr.ownerId, kr.createdBy, null)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const session = req.session as any;
    const userId = session?.passport?.user?.id || session?.userId || req.user?.id || null;

    // Revoke old
    await storage.revokeKrWebhookToken(old.id, userId);

    // Create new with same label
    const publicToken = generateRandomHex(32);
    const secret = generateRandomHex(32);
    const created = await storage.createKrWebhookToken({
      tenantId: old.tenantId,
      keyResultId: old.keyResultId,
      label: old.label,
      tokenHash: sha256Hex(publicToken),
      secretHash: encryptToken(secret),
      enabled: true,
      createdByUserId: userId,
    } as any);

    res.json({
      id: created.id,
      label: created.label,
      enabled: created.enabled,
      createdAt: created.createdAt,
      token: publicToken,
      secret,
      url: buildIngestUrl(req, publicToken),
      previousTokenId: old.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Toggle enabled
okrRouter.patch("/webhook-tokens/:id", async (req: Request, res: Response) => {
  try {
    const tok = await storage.getKrWebhookTokenById(req.params.id);
    if (!tok) return res.status(404).json({ error: "Token not found" });
    if (tok.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const kr = await storage.getKeyResultById(tok.keyResultId);
    if (!kr || !canUserModifyOKR(req, kr.ownerId, kr.createdBy, null)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updates: any = {};
    if (typeof req.body?.enabled === "boolean") updates.enabled = req.body.enabled;
    if (typeof req.body?.label === "string") updates.label = req.body.label.slice(0, 120);
    const updated = await storage.updateKrWebhookToken(tok.id, updates);
    res.json({
      id: updated.id,
      label: updated.label,
      enabled: updated.enabled,
      lastUsedAt: updated.lastUsedAt,
      failureCount: updated.failureCount,
      successCount: updated.successCount,
      createdAt: updated.createdAt,
      revokedAt: updated.revokedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Revoke (soft-delete: disabled + revokedAt)
okrRouter.delete("/webhook-tokens/:id", async (req: Request, res: Response) => {
  try {
    const tok = await storage.getKrWebhookTokenById(req.params.id);
    if (!tok) return res.status(404).json({ error: "Token not found" });
    if (tok.tenantId !== req.effectiveTenantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const kr = await storage.getKeyResultById(tok.keyResultId);
    if (!kr || !canUserModifyOKR(req, kr.ownerId, kr.createdBy, null)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const session = req.session as any;
    const userId = session?.passport?.user?.id || session?.userId || req.user?.id || null;
    await storage.revokeKrWebhookToken(tok.id, userId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Tenant-wide ingest log viewer (admin only)
okrRouter.get("/webhook-ingest-logs", async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(400).json({ error: "Tenant context required" });
    const role = req.user?.role as string;
    const ADMIN_ROLES = ["tenant_admin", "admin", "vega_admin", "global_admin", "vega_consultant"];
    if (!ADMIN_ROLES.includes(role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10) || 100, 500);
    const logs = await storage.getWebhookIngestLogsByTenantId(tenantId, limit);
    // Enrich with token labels and KR titles where possible
    const tokens = await storage.getKrWebhookTokensByTenantId(tenantId);
    const tokenById = new Map(tokens.map((t) => [t.id, t]));
    const enriched = await Promise.all(
      logs.map(async (l) => {
        const tok = l.tokenId ? tokenById.get(l.tokenId) : undefined;
        let krTitle: string | null = null;
        if (l.keyResultId) {
          try {
            const kr = await storage.getKeyResultById(l.keyResultId);
            krTitle = kr?.title ?? null;
          } catch {}
        }
        return {
          ...l,
          tokenLabel: tok?.label ?? null,
          keyResultTitle: krTitle,
        };
      })
    );
    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});