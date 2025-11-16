import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyPassword } from "./auth";
import { z } from "zod";
import { 
  insertTenantSchema,
  insertFoundationSchema,
  insertStrategySchema,
  insertOkrSchema,
  insertKpiSchema,
  insertRockSchema,
  insertMeetingSchema,
  insertUserSchema
} from "@shared/schema";

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, isDemo } = req.body;

      // Demo login handling
      if (isDemo) {
        const demoPassword = process.env.VITE_DEMO_PASSWORD;
        if (password === demoPassword) {
          // Get Acme tenant and demo user
          const acmeTenant = (await storage.getAllTenants()).find(t => t.name === "Acme Corporation");
          if (!acmeTenant) {
            return res.status(500).json({ error: "Acme tenant not found" });
          }

          const demoUser = await storage.getUserByEmail("demo@acme.com");
          if (!demoUser) {
            return res.status(500).json({ error: "Demo user not found" });
          }

          req.session.userId = demoUser.id;
          return res.json({ user: demoUser });
        } else {
          return res.status(401).json({ error: "Invalid demo password" });
        }
      }

      // Regular email/password login
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      res.json({ user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Extract domain from email
      const domain = email.split('@')[1];
      if (!domain) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find tenant by domain
      const tenant = await storage.getTenantByDomain(domain);
      if (!tenant) {
        return res.status(403).json({ 
          error: `No organization found for domain ${domain}. Contact your administrator.` 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Create user with "tenant_user" role by default
      const user = await storage.createUser({
        email,
        password,
        name: name || email.split('@')[0],
        role: "tenant_user",
        tenantId: tenant.id,
      });

      req.session.userId = user.id;
      res.json({ user });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.userId = undefined;
        return res.status(401).json({ error: "User not found" });
      }

      res.json({ user });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Failed to get current user" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Tenant CRUD endpoints
  app.get("/api/tenants", async (req, res) => {
    try {
      const allTenants = await storage.getAllTenants();
      res.json(allTenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/tenants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tenant = await storage.getTenantById(id);
      
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.post("/api/tenants", async (req, res) => {
    try {
      const validatedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validatedData);
      res.json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  app.patch("/api/tenants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const partialSchema = insertTenantSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const tenant = await storage.updateTenant(id, validatedData);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.delete("/api/tenants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTenant(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ error: "Failed to delete tenant" });
    }
  });

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
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: "Failed to save foundation",
        message: error instanceof Error ? error.message : String(error)
      });
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
      const validatedData = insertStrategySchema.partial().parse(req.body);
      const strategy = await storage.updateStrategy(id, validatedData);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
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
      const validatedData = insertOkrSchema.partial().parse(req.body);
      const okr = await storage.updateOkr(id, validatedData);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }
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
      const validatedData = insertKpiSchema.partial().parse(req.body);
      const kpi = await storage.updateKpi(id, validatedData);
      if (!kpi) {
        return res.status(404).json({ error: "KPI not found" });
      }
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
      const validatedData = insertRockSchema.partial().parse(req.body);
      const rock = await storage.updateRock(id, validatedData);
      if (!rock) {
        return res.status(404).json({ error: "Rock not found" });
      }
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
      const dataToInsert = {
        ...validatedData,
        date: validatedData.date ? new Date(validatedData.date) : null,
        nextMeetingDate: validatedData.nextMeetingDate ? new Date(validatedData.nextMeetingDate) : null,
      };
      const meeting = await storage.createMeeting(dataToInsert);
      res.json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(400).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      const dataToUpdate = {
        ...validatedData,
        date: validatedData.date ? new Date(validatedData.date) : undefined,
        nextMeetingDate: validatedData.nextMeetingDate ? new Date(validatedData.nextMeetingDate) : undefined,
      };
      const meeting = await storage.updateMeeting(id, dataToUpdate);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
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
