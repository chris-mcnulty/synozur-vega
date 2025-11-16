import { type Express } from "express";
import { db } from "./db";
import { users, tenants } from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

export function registerSetupRoutes(app: Express) {
  // One-time production setup endpoint
  // IMPORTANT: Remove this endpoint after initial setup!
  app.post("/api/setup/initialize", async (req, res) => {
    try {
      // Check if setup token matches (for security)
      const setupToken = req.body.setupToken;
      
      // You should set this in your production environment variables
      if (setupToken !== process.env.SETUP_TOKEN) {
        return res.status(403).json({ message: "Invalid setup token" });
      }

      // Check if any admin already exists
      const existingAdmins = await db
        .select()
        .from(users)
        .where(sql`${users.role} IN ('global_admin', 'vega_admin')`)
        .limit(1);

      if (existingAdmins.length > 0) {
        return res.status(400).json({ 
          message: "System already initialized. Admins exist." 
        });
      }

      // Create first tenant - The Synozur Alliance LLC
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: "The Synozur Alliance LLC",
          brandColor: "hsl(270, 100%, 50%)",
        })
        .returning();

      console.log("✅ Created tenant:", tenant.name);

      // Hash passwords
      const chrisPasswordHash = await hashPassword("East2west!");
      const adminPasswordHash = await hashPassword("admin123");

      // Create Chris McNulty admin
      await db.insert(users).values({
        email: "chris.mcnulty@synozur.com",
        username: "chris.mcnulty",
        password: chrisPasswordHash,
        role: "global_admin",
        tenantId: null, // Global admins don't belong to specific tenant
      });

      // Create generic admin account
      await db.insert(users).values({
        email: "admin@synozur.com", 
        username: "admin",
        password: adminPasswordHash,
        role: "global_admin",
        tenantId: null,
      });

      res.json({
        success: true,
        message: "Production setup complete!",
        admins: [
          "chris.mcnulty@synozur.com / East2west!",
          "admin@synozur.com / admin123"
        ],
        tenant: tenant.name,
        warning: "CHANGE THESE PASSWORDS IMMEDIATELY!"
      });

    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ 
        message: "Setup failed", 
        error: error.message 
      });
    }
  });

  // Endpoint to check if system is initialized
  app.get("/api/setup/status", async (req, res) => {
    try {
      const adminCount = await db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(sql`${users.role} IN ('global_admin', 'vega_admin')`);

      const tenantCount = await db
        .select({ count: sql`count(*)` })
        .from(tenants);

      res.json({
        initialized: adminCount[0].count > 0,
        admins: adminCount[0].count,
        tenants: tenantCount[0].count
      });
    } catch (error) {
      res.status(500).json({ message: "Status check failed" });
    }
  });
}