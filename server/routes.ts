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
  insertMeetingSchema,
  insertUserSchema
} from "@shared/schema";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  generateVerificationToken, 
  generateResetToken,
  hashToken 
} from "./email";
import { 
  loadCurrentUser, 
  requireTenantAccess, 
  requireRole, 
  requirePermission,
  rbac,
  canModifyAnyOKR,
  isResourceOwner
} from "./middleware/rbac";
import { ROLES, PERMISSIONS } from "../shared/rbac";

// Authentication middleware (basic - just checks session)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Combined auth middleware: requireAuth + loadCurrentUser + requireTenantAccess
const authWithTenant = [requireAuth, loadCurrentUser, requireTenantAccess];

// Admin-only middleware
const adminOnly = [requireAuth, loadCurrentUser, requireTenantAccess, rbac.tenantAdmin];

// Platform admin only
const platformAdminOnly = [requireAuth, loadCurrentUser, rbac.platformAdmin];

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
      
      // Server-side SSO enforcement: Check if tenant requires SSO
      if (user.tenantId) {
        const tenant = await storage.getTenantById(user.tenantId);
        if (tenant) {
          const ssoEnabled = !!tenant.azureTenantId;
          const enforceSso = tenant.enforceSso ?? false;
          const allowLocalAuth = tenant.allowLocalAuth !== false;
          
          // If SSO is enforced and local auth is not allowed, block password login
          if (ssoEnabled && enforceSso && !allowLocalAuth) {
            return res.status(403).json({ 
              error: `${tenant.name} requires Microsoft SSO login. Please use the "Sign in with Microsoft" button.`,
              ssoRequired: true,
              tenantId: tenant.id
            });
          }
        }
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({ 
          error: "Please verify your email address before logging in. Check your inbox for the verification link.",
          requiresVerification: true 
        });
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

      // Generate verification token (returns plaintext and hash)
      const { plaintext: verificationTokenPlaintext, hash: verificationTokenHash } = generateVerificationToken();

      // Create user with "tenant_user" role by default (unverified)
      // Store ONLY the hash in the database for security
      const user = await storage.createUser({
        email,
        password,
        name: name || email.split('@')[0],
        role: "tenant_user",
        tenantId: tenant.id,
        emailVerified: false,
        verificationToken: verificationTokenHash,
      });

      // Send verification email with plaintext token
      try {
        await sendVerificationEmail(email, verificationTokenPlaintext, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue anyway - user is created, they can request resend
      }

      res.json({ 
        message: "Account created! Please check your email to verify your account.",
        email: user.email 
      });
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

  // Email verification
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Verification token required" });
      }

      // Hash the incoming token to compare with stored hash
      const tokenHash = hashToken(token);
      const user = await storage.getUserByVerificationToken(tokenHash);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }

      // Update user to verified and clear token
      await storage.updateUser(user.id, {
        emailVerified: true,
        verificationToken: null,
      });

      res.json({ message: "Email verified successfully! You can now log in." });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Email verification failed" });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return res.json({ message: "If the email exists, a verification link has been sent." });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: "Email already verified" });
      }

      // Generate new verification token (plaintext and hash)
      const { plaintext: verificationTokenPlaintext, hash: verificationTokenHash } = generateVerificationToken();
      await storage.updateUser(user.id, { verificationToken: verificationTokenHash });

      // Send verification email with plaintext token
      try {
        await sendVerificationEmail(email, verificationTokenPlaintext, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        return res.status(500).json({ error: "Failed to send verification email" });
      }

      res.json({ message: "Verification email sent! Please check your inbox." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  // Request password reset
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If the email exists, a password reset link has been sent." });
      }

      // Generate reset token (plaintext and hash) and set expiry (1 hour from now)
      const { plaintext: resetTokenPlaintext, hash: resetTokenHash } = generateResetToken();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUser(user.id, {
        resetToken: resetTokenHash,
        resetTokenExpiry,
      });

      // Send password reset email with plaintext token
      try {
        await sendPasswordResetEmail(email, resetTokenPlaintext, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        return res.status(500).json({ error: "Failed to send password reset email" });
      }

      res.json({ message: "Password reset link sent! Please check your email." });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ error: "Failed to request password reset" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password required" });
      }

      // Hash the incoming token to compare with stored hash
      const tokenHash = hashToken(token);
      const user = await storage.getUserByResetToken(tokenHash);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Check if token has expired
      if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }

      // Update password and clear reset token
      await storage.updateUserPassword(user.id, newPassword);
      await storage.updateUser(user.id, {
        resetToken: null,
        resetTokenExpiry: null,
      });

      res.json({ message: "Password reset successfully! You can now log in with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Tenant CRUD endpoints (platform admin only for create/delete, tenant admin for read/update own)
  app.get("/api/tenants", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      // Platform admins can see all tenants, others only see their own
      const userRole = req.user?.role;
      if (userRole === ROLES.VEGA_ADMIN || userRole === ROLES.GLOBAL_ADMIN || userRole === ROLES.VEGA_CONSULTANT) {
        const allTenants = await storage.getAllTenants();
        res.json(allTenants);
      } else {
        // Regular users only see their own tenant
        const tenant = req.effectiveTenantId ? await storage.getTenantById(req.effectiveTenantId) : null;
        res.json(tenant ? [tenant] : []);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/tenants/:id", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check access: must be own tenant or have cross-tenant permission
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && id !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  app.post("/api/tenants", ...platformAdminOnly, async (req: Request, res: Response) => {
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

  app.patch("/api/tenants/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Tenant admins can only update their own tenant
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && id !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  app.delete("/api/tenants/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteTenant(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ error: "Failed to delete tenant" });
    }
  });

  // User CRUD endpoints (tenant admin can manage users in their tenant)
  app.get("/api/users", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.query;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      // Enforce tenant isolation - admins can only see their tenant's users unless they have cross-tenant access
      const effectiveTenantId = canAccessAny ? (tenantId as string | undefined) : req.effectiveTenantId;
      
      const users = await storage.getAllUsers(effectiveTenantId);
      // Don't send password hashes to client
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check tenant access
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && user.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Don't send password hash
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Normalize tenantId: convert "NONE" or empty string to null
      if (validatedData.tenantId === "NONE" || validatedData.tenantId === "") {
        validatedData.tenantId = null;
      }
      
      // Tenant admins can only create users in their own tenant
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot create users in other tenants" });
      }
      
      const user = await storage.createUser(validatedData);
      // Don't send password hash
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify target user belongs to same tenant (or caller has cross-tenant access)
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const partialSchema = insertUserSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Normalize tenantId: convert "NONE" or empty string to null
      if (validatedData.tenantId === "NONE" || validatedData.tenantId === "") {
        validatedData.tenantId = null;
      }
      
      // Prevent non-platform admins from moving users to other tenants
      if (!canAccessAny && validatedData.tenantId && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot move users to other tenants" });
      }
      
      const user = await storage.updateUser(id, validatedData);
      // Don't send password hash
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Verify target user belongs to same tenant (or caller has cross-tenant access)
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Prevent self-deletion
      if (id === req.user?.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Get foundation for a tenant (any authenticated user can read their tenant's foundation)
  app.get("/api/foundations/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  // Upsert foundation (create or update) - requires admin permissions
  app.post("/api/foundations", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const validatedData = insertFoundationSchema.parse(req.body);
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  // Strategies routes (any user can read, admin can write)
  app.get("/api/strategies/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const strategies = await storage.getStrategiesByTenantId(tenantId);
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ error: "Failed to fetch strategies" });
    }
  });

  app.post("/api/strategies", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const validatedData = insertStrategySchema.parse(req.body);
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const strategy = await storage.createStrategy(validatedData);
      res.json(strategy);
    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(400).json({ error: "Failed to create strategy" });
    }
  });

  app.patch("/api/strategies/:id", ...adminOnly, async (req: Request, res: Response) => {
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

  app.delete("/api/strategies/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteStrategy(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ error: "Failed to delete strategy" });
    }
  });

  // OKRs routes (any user can read/create, admin can delete)
  app.get("/api/okrs/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  app.post("/api/okrs", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const validatedData = insertOkrSchema.parse(req.body);
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const okr = await storage.createOkr(validatedData);
      res.json(okr);
    } catch (error) {
      console.error("Error creating OKR:", error);
      res.status(400).json({ error: "Failed to create OKR" });
    }
  });

  app.patch("/api/okrs/:id", ...authWithTenant, async (req: Request, res: Response) => {
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

  app.delete("/api/okrs/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteOkr(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting OKR:", error);
      res.status(500).json({ error: "Failed to delete OKR" });
    }
  });

  // KPIs routes (any user can read, admin can write)
  app.get("/api/kpis/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  app.post("/api/kpis", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const validatedData = insertKpiSchema.parse(req.body);
      const kpi = await storage.createKpi(validatedData);
      res.json(kpi);
    } catch (error) {
      console.error("Error creating KPI:", error);
      res.status(400).json({ error: "Failed to create KPI" });
    }
  });

  app.patch("/api/kpis/:id", ...authWithTenant, async (req: Request, res: Response) => {
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

  app.delete("/api/kpis/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteKpi(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting KPI:", error);
      res.status(500).json({ error: "Failed to delete KPI" });
    }
  });

  // Meetings routes (any user can read/create/update, admin can delete)
  app.get("/api/meetings/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const meetings = await storage.getMeetingsByTenantId(tenantId);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meeting/:id", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const meeting = await storage.getMeetingById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.post("/api/meetings", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  app.patch("/api/meetings/:id", ...authWithTenant, async (req: Request, res: Response) => {
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

  app.delete("/api/meetings/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteMeeting(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  
  // Import and use enhanced OKR routes (with auth + tenant isolation)
  const { okrRouter } = await import("./routes-okr");
  app.use("/api/okr", ...authWithTenant, okrRouter);

  // Import and use value tagging routes
  const { registerValueRoutes } = await import("./routes-values");
  registerValueRoutes(app);

  // Import and use import routes (Viva Goals, etc.)
  const { importRouter } = await import("./routes-import");
  app.use("/api/import", importRouter);

  // Import and use AI routes (grounding documents + chat)
  const { aiRouter } = await import("./routes-ai");
  app.use("/api/ai", aiRouter);

  // Import and use Microsoft 365 routes (Outlook calendar sync, email)
  // Apply loadCurrentUser middleware to populate req.user for all M365 routes
  const m365Routes = await import("./routes-m365");
  app.use("/api/m365", requireAuth, loadCurrentUser, m365Routes.default);

  // Import and use Entra SSO routes
  const { entraRouter } = await import("./routes-entra");
  app.use("/auth/entra", entraRouter);

  // Import and use Microsoft Planner routes
  const { plannerRouter } = await import("./routes-planner");
  app.use("/api/planner", plannerRouter);

  const httpServer = createServer(app);

  return httpServer;
}
