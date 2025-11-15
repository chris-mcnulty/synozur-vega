import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFoundationSchema } from "@shared/schema";

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

  const httpServer = createServer(app);

  return httpServer;
}
