import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";

const addValueSchema = z.object({
  valueTitle: z.string().min(1),
});

const removeValueSchema = z.object({
  valueTitle: z.string().min(1),
});

export function registerValueRoutes(app: Express) {
  // Objective value tagging
  app.post("/api/objectives/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const objectiveId = req.params.id;
      const result = addValueSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const { valueTitle } = result.data;
      const tenantId = user.tenantId;

      // Verify objective belongs to tenant
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective || objective.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.addValueToObjective(objectiveId, valueTitle, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("POST /api/objectives/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/objectives/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const objectiveId = req.params.id;
      const result = removeValueSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const { valueTitle } = result.data;
      const tenantId = user.tenantId;

      // Verify objective belongs to tenant
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective || objective.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeValueFromObjective(objectiveId, valueTitle, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("DELETE /api/objectives/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/objectives/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const objectiveId = req.params.id;
      const tenantId = user.tenantId;

      // Verify objective belongs to tenant
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective || objective.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const values = await storage.getValuesByObjectiveId(objectiveId, tenantId);
      res.json(values);
    } catch (error: any) {
      console.error("GET /api/objectives/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Strategy value tagging
  app.post("/api/strategies/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const strategyId = req.params.id;
      const result = addValueSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const { valueTitle } = result.data;
      const tenantId = user.tenantId;

      // Verify strategy belongs to tenant
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy || strategy.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.addValueToStrategy(strategyId, valueTitle, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("POST /api/strategies/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/strategies/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const strategyId = req.params.id;
      const result = removeValueSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const { valueTitle } = result.data;
      const tenantId = user.tenantId;

      // Verify strategy belongs to tenant
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy || strategy.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeValueFromStrategy(strategyId, valueTitle, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("DELETE /api/strategies/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/strategies/:id/values", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const strategyId = req.params.id;
      const tenantId = user.tenantId;

      // Verify strategy belongs to tenant
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy || strategy.tenantId !== tenantId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const values = await storage.getValuesByStrategyId(strategyId, tenantId);
      res.json(values);
    } catch (error: any) {
      console.error("GET /api/strategies/:id/values failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all items tagged with a specific value
  app.get("/api/values/:valueTitle/tagged-items", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const valueTitle = decodeURIComponent(req.params.valueTitle);
      const tenantId = user.tenantId;

      const items = await storage.getItemsTaggedWithValue(tenantId, valueTitle);
      res.json(items);
    } catch (error: any) {
      console.error("GET /api/values/:valueTitle/tagged-items failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get values analytics - distribution across objectives and strategies
  app.get("/api/values/analytics/distribution", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const tenantId = user.tenantId;

      // Get foundation to know all defined values
      const foundation = await storage.getFoundationByTenantId(tenantId);
      const companyValues = foundation?.values || [];

      // Calculate distribution for each value
      type ValueDistribution = {
        valueTitle: string;
        valueDescription: string;
        objectiveCount: number;
        strategyCount: number;
        totalCount: number;
      };

      const distribution: ValueDistribution[] = await Promise.all(
        companyValues.map(async (value: { title: string; description: string }) => {
          const items = await storage.getItemsTaggedWithValue(tenantId, value.title);
          return {
            valueTitle: value.title,
            valueDescription: value.description,
            objectiveCount: items.objectives.length,
            strategyCount: items.strategies.length,
            totalCount: items.objectives.length + items.strategies.length,
          };
        })
      );

      // Sort by total count descending
      distribution.sort((a: ValueDistribution, b: ValueDistribution) => b.totalCount - a.totalCount);

      res.json({
        distribution,
        totalValues: companyValues.length,
        summary: {
          mostUsedValue: distribution[0]?.valueTitle || null,
          leastUsedValue: distribution[distribution.length - 1]?.valueTitle || null,
          averageUsage: distribution.length > 0 
            ? Math.round(distribution.reduce((sum: number, d: ValueDistribution) => sum + d.totalCount, 0) / distribution.length)
            : 0,
        },
      });
    } catch (error: any) {
      console.error("GET /api/values/analytics/distribution failed", error);
      res.status(500).json({ error: error.message });
    }
  });
}
