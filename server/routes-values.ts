import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage";

const addValueSchema = z.object({
  valueTitle: z.string().min(1),
});

const removeValueSchema = z.object({
  valueTitle: z.string().min(1),
});

// Roles that can access resources across tenants
const CROSS_TENANT_ROLES = ['admin', 'global_admin', 'vega_consultant', 'vega_admin'];

function hasCrossTenantAccess(role: string | undefined): boolean {
  return role ? CROSS_TENANT_ROLES.includes(role) : false;
}

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

      // Verify objective exists and user has access
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the objective's tenant
      if (objective.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.addValueToObjective(objectiveId, valueTitle, objective.tenantId);
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

      // Verify objective exists and user has access
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the objective's tenant
      if (objective.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await storage.removeValueFromObjective(objectiveId, valueTitle, objective.tenantId);
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

      // Verify objective exists and user has access
      const objective = await storage.getObjectiveById(objectiveId);
      if (!objective) {
        return res.status(404).json({ error: "Objective not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the objective's tenant
      if (objective.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const values = await storage.getValuesByObjectiveId(objectiveId, objective.tenantId);
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

      // Verify strategy exists and user has access
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the strategy's tenant
      if (strategy.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Use the strategy's tenant ID for the value
      await storage.addValueToStrategy(strategyId, valueTitle, strategy.tenantId);
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

      // Verify strategy exists and user has access
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the strategy's tenant
      if (strategy.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Use the strategy's tenant ID for the value
      await storage.removeValueFromStrategy(strategyId, valueTitle, strategy.tenantId);
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

      // Verify strategy exists and user has access
      const strategy = await storage.getStrategyById(strategyId);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      // Allow access if user has cross-tenant role or belongs to the strategy's tenant
      if (strategy.tenantId !== user.tenantId && !hasCrossTenantAccess(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Use the strategy's tenant ID for fetching values
      const values = await storage.getValuesByStrategyId(strategyId, strategy.tenantId);
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
  // Supports optional query params: quarter, year for time period filtering
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
      const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;

      // Get foundation to know all defined values
      const foundation = await storage.getFoundationByTenantId(tenantId);
      const companyValues = foundation?.values || [];

      // Calculate distribution for each value with level breakdown
      type LevelBreakdown = {
        organization: number;
        team: number;
        division: number;
        individual: number;
      };

      type ValueDistribution = {
        valueTitle: string;
        valueDescription: string;
        objectiveCount: number;
        strategyCount: number;
        totalCount: number;
        levelBreakdown: LevelBreakdown;
        objectiveIds: string[];
      };

      const distribution: ValueDistribution[] = await Promise.all(
        companyValues.map(async (value: { title: string; description: string }) => {
          const items = await storage.getItemsTaggedWithValue(tenantId, value.title);
          
          // Filter objectives by quarter/year if specified
          let filteredObjectives = items.objectives;
          if (quarter !== undefined && year !== undefined) {
            filteredObjectives = items.objectives.filter(
              (obj: any) => obj.quarter === quarter && obj.year === year
            );
          } else if (year !== undefined) {
            filteredObjectives = items.objectives.filter(
              (obj: any) => obj.year === year
            );
          }

          // Calculate level breakdown
          const levelBreakdown: LevelBreakdown = {
            organization: 0,
            team: 0,
            division: 0,
            individual: 0,
          };

          filteredObjectives.forEach((obj: any) => {
            const level = obj.level?.toLowerCase() || 'organization';
            if (level in levelBreakdown) {
              levelBreakdown[level as keyof LevelBreakdown]++;
            }
          });

          return {
            valueTitle: value.title,
            valueDescription: value.description,
            objectiveCount: filteredObjectives.length,
            strategyCount: items.strategies.length,
            totalCount: filteredObjectives.length + items.strategies.length,
            levelBreakdown,
            objectiveIds: filteredObjectives.map((obj: any) => obj.id),
          };
        })
      );

      // Sort by total count descending
      distribution.sort((a: ValueDistribution, b: ValueDistribution) => b.totalCount - a.totalCount);

      // Calculate total objectives across all levels
      const totalObjectivesWithValues = distribution.reduce((sum, d) => sum + d.objectiveCount, 0);
      const totalStrategiesWithValues = distribution.reduce((sum, d) => sum + d.strategyCount, 0);

      // Aggregate level breakdown across all values
      const aggregateLevelBreakdown: LevelBreakdown = {
        organization: distribution.reduce((sum, d) => sum + d.levelBreakdown.organization, 0),
        team: distribution.reduce((sum, d) => sum + d.levelBreakdown.team, 0),
        division: distribution.reduce((sum, d) => sum + d.levelBreakdown.division, 0),
        individual: distribution.reduce((sum, d) => sum + d.levelBreakdown.individual, 0),
      };

      res.json({
        distribution,
        totalValues: companyValues.length,
        totalObjectivesWithValues,
        totalStrategiesWithValues,
        aggregateLevelBreakdown,
        filters: {
          quarter: quarter || null,
          year: year || null,
        },
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
