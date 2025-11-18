import { Router } from "express";
import { storage } from "./storage";
import { 
  insertObjectiveSchema, 
  insertKeyResultSchema, 
  insertBigRockSchema,
  insertCheckInSchema 
} from "@shared/schema";
import { z } from "zod";

export const okrRouter = Router();

// Objectives
okrRouter.get("/objectives", async (req, res) => {
  try {
    const { tenantId, quarter, year } = req.query;
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }
    
    const objectives = await storage.getObjectivesByTenantId(
      tenantId as string,
      quarter ? Number(quarter) : undefined,
      year ? Number(year) : undefined
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
    const objective = await storage.createObjective(validatedData);
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
    const objective = await storage.updateObjective(req.params.id, req.body);
    res.json(objective);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.delete("/objectives/:id", async (req, res) => {
  try {
    await storage.deleteObjective(req.params.id);
    res.json({ success: true });
  } catch (error) {
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
    const keyResult = await storage.updateKeyResult(req.params.id, req.body);
    res.json(keyResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.delete("/key-results/:id", async (req, res) => {
  try {
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
    const bigRock = await storage.updateBigRock(req.params.id, req.body);
    res.json(bigRock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

okrRouter.delete("/big-rocks/:id", async (req, res) => {
  try {
    await storage.deleteBigRock(req.params.id);
    res.json({ success: true });
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
    const checkIn = await storage.createCheckIn(validatedData);
    
    // Update the entity with the latest check-in information
    const { entityType, entityId } = validatedData;
    
    if (entityType === "objective") {
      await storage.updateObjective(entityId, {
        progress: checkIn.newProgress,
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      });
    } else if (entityType === "key_result") {
      await storage.updateKeyResult(entityId, {
        currentValue: checkIn.newValue,
        progress: checkIn.newProgress,
        status: checkIn.newStatus || undefined,
        lastCheckInAt: checkIn.createdAt,
        lastCheckInNote: checkIn.note || undefined,
      });
    } else if (entityType === "big_rock") {
      await storage.updateBigRock(entityId, {
        completionPercentage: checkIn.newProgress,
        status: checkIn.newStatus || undefined,
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
    
    // Calculate from key results
    const keyResults = await storage.getKeyResultsByObjectiveId(req.params.id);
    
    if (keyResults.length === 0) {
      return res.json({ progress: 0 });
    }
    
    // Calculate weighted average
    let totalWeight = 0;
    let weightedProgress = 0;
    
    for (const kr of keyResults) {
      const weight = kr.weight || 25; // Default 25% if no weight specified
      totalWeight += weight;
      weightedProgress += (kr.progress || 0) * weight;
    }
    
    const calculatedProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
    
    // Update the objective with calculated progress
    await storage.updateObjective(req.params.id, { progress: calculatedProgress });
    
    res.json({ progress: calculatedProgress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});