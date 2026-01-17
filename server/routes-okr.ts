import { Router, Request, Response, NextFunction } from "express";
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
async function calculateObjectiveRollupProgress(objectiveId: string): Promise<number> {
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
    res.status(500).json({ error: error.message });
  }
});

// Objectives
okrRouter.get("/objectives", async (req, res) => {
  try {
    const { tenantId, quarter, year, level, teamId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const objectives = await storage.getObjectivesByTenantId(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined,
      level as string | undefined,
      teamId as string | undefined
    );
    
    res.json(objectives);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/objectives/:id", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    res.json(objective);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/objectives/:id/children", async (req, res) => {
  try {
    const children = await storage.getChildObjectives(req.params.id);
    res.json(children);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.post("/objectives", async (req, res) => {
  try {
    const validatedData = insertObjectiveSchema.parse(req.body);
    
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
    
    const objectiveData = {
      ...validatedData,
      createdBy: validatedData.createdBy || userId || null,
      ownerEmail: validatedData.ownerEmail || userEmail || null,
    };
    
    const objective = await storage.createObjective(objectiveData);
    res.json(objective);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

okrRouter.patch("/objectives/:id", async (req, res) => {
  try {
    // Convert empty strings to null for foreign key fields
    const updateData = { ...req.body };
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
    
    const objective = await storage.updateObjective(req.params.id, updateData);
    
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
    res.status(500).json({ error: error.message });
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
    
    await storage.deleteObjective(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Key Results
okrRouter.get("/objectives/:objectiveId/key-results", async (req, res) => {
  try {
    const keyResults = await storage.getKeyResultsByObjectiveId(req.params.objectiveId);
    res.json(keyResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    res.json(keyResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/key-results/:id", async (req, res) => {
  try {
    const keyResult = await storage.getKeyResultById(req.params.id);
    if (!keyResult) {
      return res.status(404).json({ error: "Key Result not found" });
    }
    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.post("/key-results", async (req, res) => {
  try {
    const validatedData = insertKeyResultSchema.parse(req.body);
    const keyResult = await storage.createKeyResult(validatedData);
    res.json(keyResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

okrRouter.patch("/key-results/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };
    
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
    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    await storage.deleteKeyResult(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

okrRouter.post("/key-results/:id/unpromote-from-kpi", async (req, res) => {
  try {
    const keyResult = await storage.unpromoteKeyResultFromKpi(req.params.id);
    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/big-rocks/:id", async (req, res) => {
  try {
    const bigRock = await storage.getBigRockById(req.params.id);
    if (!bigRock) {
      return res.status(404).json({ error: "Big Rock not found" });
    }
    res.json(bigRock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/objectives/:objectiveId/big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksByObjectiveId(req.params.objectiveId);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/key-results/:keyResultId/big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksByKeyResultId(req.params.keyResultId);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.post("/big-rocks", async (req, res) => {
  try {
    const validatedData = insertBigRockSchema.parse(req.body);
    const bigRock = await storage.createBigRock(validatedData);
    res.json(bigRock);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

okrRouter.patch("/big-rocks/:id", async (req, res) => {
  try {
    // Convert empty strings to null for foreign key fields
    const updateData = { ...req.body };
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
    res.json(bigRock);
  } catch (error) {
    console.error('[Big Rock Update] Error:', error);
    res.status(500).json({ error: error.message });
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
    
    await storage.deleteBigRock(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      progress: 0,
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
    res.status(500).json({ error: error.message });
  }
});

okrRouter.delete("/objectives/:id/link-big-rock/:bigRockId", async (req, res) => {
  try {
    await storage.unlinkObjectiveToBigRock(req.params.id, req.params.bigRockId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/objectives/:id/linked-big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksLinkedToObjective(req.params.id);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

okrRouter.delete("/key-results/:id/link-big-rock/:bigRockId", async (req, res) => {
  try {
    await storage.unlinkKeyResultToBigRock(req.params.id, req.params.bigRockId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.get("/key-results/:id/linked-big-rocks", async (req, res) => {
  try {
    const bigRocks = await storage.getBigRocksLinkedToKeyResult(req.params.id);
    res.json(bigRocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Check-Ins
okrRouter.get("/check-ins", async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) {
      return res.status(400).json({ error: "entityType and entityId are required" });
    }
    
    const checkIns = await storage.getCheckInsByEntityId(
      entityType as string,
      entityId as string
    );
    
    res.json(checkIns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.post("/check-ins", async (req, res) => {
  try {
    const validatedData = insertCheckInSchema.parse(req.body);
    
    // Ensure previousProgress has a default value if not provided
    if (validatedData.previousProgress === undefined || validatedData.previousProgress === null) {
      validatedData.previousProgress = 0;
    }
    
    // Check if entity is closed - block check-ins on closed OKRs
    const { entityType, entityId } = validatedData;
    if (entityType === "objective") {
      const objective = await storage.getObjectiveById(entityId);
      if (objective?.status === 'closed') {
        return res.status(403).json({ 
          error: "Cannot check in on a closed objective. Reopen it first." 
        });
      }
    } else if (entityType === "key_result") {
      const keyResult = await storage.getKeyResultById(entityId);
      if (keyResult?.status === 'closed') {
        return res.status(403).json({ 
          error: "Cannot check in on a closed key result. Reopen it first." 
        });
      }
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
    }
    
    // Convert asOfDate from ISO string to Date object for Drizzle
    if (validatedData.asOfDate && typeof validatedData.asOfDate === 'string') {
      validatedData.asOfDate = new Date(validatedData.asOfDate) as any;
    }
    
    const checkIn = await storage.createCheckIn(validatedData);
    
    // Update the entity with the latest check-in information
    // entityType and entityId already declared above
    
    if (entityType === "objective") {
      const updateData: any = {
        progress: checkIn.newProgress,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      };
      
      if (checkIn.newStatus) {
        updateData.status = checkIn.newStatus;
        updateData.statusOverride = 'true';
      }
      
      await storage.updateObjective(entityId, updateData);
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
            currentValue: checkIn.previousValue ?? keyResult.initialValue ?? keyResult.startValue ?? 0,
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate progress from values based on metricType
function calculateKeyResultProgress(
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
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OKR INTELLIGENCE: Pace & Velocity Metrics
// ============================================

import { calculatePaceMetrics, formatPaceDescription, type PaceMetrics } from './okr-intelligence';

// Get pace metrics for a specific objective
okrRouter.get("/objectives/:id/pace", async (req, res) => {
  try {
    const objective = await storage.getObjectiveById(req.params.id);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }
    
    // Get check-ins for this objective
    const checkIns = await storage.getCheckInsByEntityId('objective', req.params.id);
    
    const metrics = calculatePaceMetrics({
      progress: objective.progress || 0,
      startDate: objective.startDate,
      endDate: objective.endDate,
      quarter: objective.quarter,
      year: objective.year,
      checkIns: checkIns.map(c => ({
        asOfDate: c.asOfDate || c.createdAt!,
        newProgress: c.newProgress || 0,
        previousProgress: c.previousProgress || 0,
      })),
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
    
    // Get check-ins for this key result
    const checkIns = await storage.getCheckInsByEntityId('key_result', req.params.id);
    
    const metrics = calculatePaceMetrics({
      progress: keyResult.progress || 0,
      startDate: objective?.startDate,
      endDate: objective?.endDate,
      quarter: objective?.quarter,
      year: objective?.year,
      checkIns: checkIns.map(c => ({
        asOfDate: c.asOfDate || c.createdAt!,
        newProgress: c.newProgress || 0,
        previousProgress: c.previousProgress || 0,
      })),
      targetValue: keyResult.targetValue || 100,
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
    let objectives = await storage.getObjectivesByTenantId(tenantId);
    
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
    
    for (const objective of objectives) {
      const checkIns = await storage.getCheckInsByEntityId('objective', objective.id);
      
      const metrics = calculatePaceMetrics({
        progress: objective.progress || 0,
        startDate: objective.startDate,
        endDate: objective.endDate,
        quarter: objective.quarter,
        year: objective.year,
        checkIns: checkIns.map(c => ({
          asOfDate: c.asOfDate || c.createdAt!,
          newProgress: c.newProgress || 0,
          previousProgress: c.previousProgress || 0,
        })),
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