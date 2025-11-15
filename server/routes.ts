import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertFoundationSchema,
  insertStrategySchema,
  insertOkrSchema,
  insertKpiSchema,
  insertRockSchema,
  insertMeetingSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Get foundation for a tenant
  app.get("/api/foundations/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const foundation = await storage.getFoundationByTenantId(tenantId);
      
      if (!foundation) {
        return res.status(404).json({ error: "Foundation not found" });
      }
      
      res.json(foundation);
    } catch (error) {
      console.error("Error fetching foundation:", error);
      res.status(500).json({ error: "Failed to fetch foundation" });
    }
  });

  // Upsert foundation (create or update)
  app.post("/api/foundations", async (req, res) => {
    try {
      const validatedData = insertFoundationSchema.parse(req.body);
      const foundation = await storage.upsertFoundation(validatedData);
      res.json(foundation);
    } catch (error) {
      console.error("Error upserting foundation:", error);
      res.status(400).json({ error: "Failed to save foundation" });
    }
  });

  // Strategies routes
  app.get("/api/strategies/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const strategies = await storage.getStrategiesByTenantId(tenantId);
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ error: "Failed to fetch strategies" });
    }
  });

  app.post("/api/strategies", async (req, res) => {
    try {
      const validatedData = insertStrategySchema.parse(req.body);
      const strategy = await storage.createStrategy(validatedData);
      res.json(strategy);
    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(400).json({ error: "Failed to create strategy" });
    }
  });

  app.patch("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const strategy = await storage.updateStrategy(id, req.body);
      res.json(strategy);
    } catch (error) {
      console.error("Error updating strategy:", error);
      res.status(400).json({ error: "Failed to update strategy" });
    }
  });

  app.delete("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStrategy(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ error: "Failed to delete strategy" });
    }
  });

  // OKRs routes
  app.get("/api/okrs/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { quarter, year } = req.query;
      const okrs = await storage.getOkrsByTenantId(
        tenantId, 
        quarter ? parseInt(quarter as string) : undefined,
        year ? parseInt(year as string) : undefined
      );
      res.json(okrs);
    } catch (error) {
      console.error("Error fetching OKRs:", error);
      res.status(500).json({ error: "Failed to fetch OKRs" });
    }
  });

  app.post("/api/okrs", async (req, res) => {
    try {
      const validatedData = insertOkrSchema.parse(req.body);
      const okr = await storage.createOkr(validatedData);
      res.json(okr);
    } catch (error) {
      console.error("Error creating OKR:", error);
      res.status(400).json({ error: "Failed to create OKR" });
    }
  });

  app.patch("/api/okrs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const okr = await storage.updateOkr(id, req.body);
      res.json(okr);
    } catch (error) {
      console.error("Error updating OKR:", error);
      res.status(400).json({ error: "Failed to update OKR" });
    }
  });

  app.delete("/api/okrs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOkr(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting OKR:", error);
      res.status(500).json({ error: "Failed to delete OKR" });
    }
  });

  // KPIs routes
  app.get("/api/kpis/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { quarter, year } = req.query;
      const kpis = await storage.getKpisByTenantId(
        tenantId,
        quarter ? parseInt(quarter as string) : undefined,
        year ? parseInt(year as string) : undefined
      );
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  app.post("/api/kpis", async (req, res) => {
    try {
      const validatedData = insertKpiSchema.parse(req.body);
      const kpi = await storage.createKpi(validatedData);
      res.json(kpi);
    } catch (error) {
      console.error("Error creating KPI:", error);
      res.status(400).json({ error: "Failed to create KPI" });
    }
  });

  app.patch("/api/kpis/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const kpi = await storage.updateKpi(id, req.body);
      res.json(kpi);
    } catch (error) {
      console.error("Error updating KPI:", error);
      res.status(400).json({ error: "Failed to update KPI" });
    }
  });

  app.delete("/api/kpis/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteKpi(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KPI:", error);
      res.status(500).json({ error: "Failed to delete KPI" });
    }
  });

  // Rocks routes
  app.get("/api/rocks/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { quarter, year } = req.query;
      const rocks = await storage.getRocksByTenantId(
        tenantId,
        quarter ? parseInt(quarter as string) : undefined,
        year ? parseInt(year as string) : undefined
      );
      res.json(rocks);
    } catch (error) {
      console.error("Error fetching rocks:", error);
      res.status(500).json({ error: "Failed to fetch rocks" });
    }
  });

  app.post("/api/rocks", async (req, res) => {
    try {
      const validatedData = insertRockSchema.parse(req.body);
      const rock = await storage.createRock(validatedData);
      res.json(rock);
    } catch (error) {
      console.error("Error creating rock:", error);
      res.status(400).json({ error: "Failed to create rock" });
    }
  });

  app.patch("/api/rocks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rock = await storage.updateRock(id, req.body);
      res.json(rock);
    } catch (error) {
      console.error("Error updating rock:", error);
      res.status(400).json({ error: "Failed to update rock" });
    }
  });

  app.delete("/api/rocks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRock(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rock:", error);
      res.status(500).json({ error: "Failed to delete rock" });
    }
  });

  // Meetings routes
  app.get("/api/meetings/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const meetings = await storage.getMeetingsByTenantId(tenantId);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(validatedData);
      res.json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(400).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await storage.updateMeeting(id, req.body);
      res.json(meeting);
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(400).json({ error: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMeeting(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
