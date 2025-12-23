import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { readFile } from "fs/promises";
import { join } from "path";
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
  insertUserSchema,
  insertTeamSchema,
  type VocabularyTerms,
  defaultVocabulary
} from "@shared/schema";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail,
  sendSelfServiceWelcomeEmail,
  sendPlanExpirationReminderEmail,
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
import { ROLES, PERMISSIONS, USER_TYPES, getAvailableRolesForUserType } from "../shared/rbac";
import { isPublicEmailDomain } from "../shared/publicDomains";

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

// Middleware that requires tenant access for regular admins, but allows platform admins without tenant
async function requireTenantAccessOrPlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userRole = req.user.role as string;
  const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
  
  if (isPlatformAdmin) {
    // Platform admins can proceed without tenant context
    // Set effectiveTenantId from header if provided, otherwise leave undefined
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    if (tenantId) {
      const tenant = await storage.getTenantById(tenantId);
      if (tenant) {
        req.effectiveTenantId = tenantId;
      }
      // Don't error if tenant doesn't exist - platform admin might be viewing all
    }
    return next();
  }
  
  // Regular admins need tenant context - use standard middleware
  return requireTenantAccess(req, res, next);
}

// Admin middleware that works for platform admins without tenant context
const adminWithOptionalTenant = [requireAuth, loadCurrentUser, requireTenantAccessOrPlatformAdmin, rbac.tenantAdmin];

export async function registerRoutes(app: Express): Promise<Server> {
  // User Guide route - serve the markdown file
  app.get("/api/user-guide", async (req, res) => {
    try {
      const guidePath = join(process.cwd(), "USER_GUIDE.md");
      const content = await readFile(guidePath, "utf-8");
      res.type("text/markdown").send(content);
    } catch (error) {
      console.error("Error reading user guide:", error);
      res.status(500).json({ error: "Failed to load user guide" });
    }
  });

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
      const { email, password, name, recaptchaToken } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Verify reCAPTCHA if token provided and secret is configured
      const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
      if (recaptchaSecret && recaptchaToken) {
        try {
          const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${recaptchaSecret}&response=${recaptchaToken}`,
          });
          const recaptchaResult = await recaptchaResponse.json() as { success: boolean; score?: number };
          if (!recaptchaResult.success || (recaptchaResult.score && recaptchaResult.score < 0.5)) {
            return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." });
          }
        } catch (recaptchaError) {
          console.error("reCAPTCHA verification error:", recaptchaError);
        }
      }

      // Extract domain from email
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if domain is blocked
      const isBlocked = await storage.isDomainBlocked(domain);
      if (isBlocked) {
        return res.status(403).json({ 
          error: "Signups from this domain are not allowed. Please contact vega@synozur.com for assistance." 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Check if using a public email domain (Gmail, Yahoo, Outlook, etc.)
      const isPublicDomain = isPublicEmailDomain(email);
      
      // Find tenant by domain or create new one with trial plan
      // For public domains, SKIP domain-based tenant lookup to prevent auto-join
      let tenant = isPublicDomain ? null : await storage.getTenantByDomain(domain);
      let isNewTenant = false;
      let servicePlan: any = null;

      // If using a public domain and trying to join an existing invite-only tenant, reject
      if (!tenant && !isPublicDomain) {
        // Check if there's a tenant that has this domain but is invite-only
        const existingTenant = await storage.getTenantByDomain(domain);
        if (existingTenant?.inviteOnly) {
          return res.status(403).json({ 
            error: "This organization requires an invitation to join. Please contact your administrator for an invite." 
          });
        }
      }

      if (!tenant) {
        // Get default service plan (Trial)
        servicePlan = await storage.getDefaultServicePlan();
        if (!servicePlan) {
          servicePlan = await storage.getServicePlanByName('trial');
        }
        
        const now = new Date();
        const expiresAt = servicePlan?.durationDays 
          ? new Date(now.getTime() + servicePlan.durationDays * 24 * 60 * 60 * 1000)
          : null;

        // For public domains: create invite-only tenant without domain claim
        // For business domains: create standard tenant with domain claim
        if (isPublicDomain) {
          // Extract name from email (before @)
          const userName = name || email.split('@')[0];
          tenant = await storage.createTenant({
            name: `${userName}'s Organization`,
            allowedDomains: [], // Don't claim the public domain
            selfServiceSignup: true,
            signupCompletedAt: now,
            servicePlanId: servicePlan?.id,
            planStartedAt: now,
            planExpiresAt: expiresAt,
            planStatus: 'active',
            inviteOnly: true, // New members must be explicitly invited
          });
          console.log(`[Signup] Created invite-only tenant for public domain user ${email}:`, tenant.id);
        } else {
          // Standard business domain signup
          const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
          tenant = await storage.createTenant({
            name: `${companyName} (${domain})`,
            allowedDomains: [domain],
            selfServiceSignup: true,
            signupCompletedAt: now,
            servicePlanId: servicePlan?.id,
            planStartedAt: now,
            planExpiresAt: expiresAt,
            planStatus: 'active',
            inviteOnly: false,
          });
          console.log(`[Signup] Created new tenant for domain ${domain}:`, tenant.id);
        }
        isNewTenant = true;
      }

      // Generate verification token (returns plaintext and hash)
      const { plaintext: verificationTokenPlaintext, hash: verificationTokenHash } = generateVerificationToken();

      // Create user - first user of new tenant is tenant_admin
      const userRole = isNewTenant ? "tenant_admin" : "tenant_user";
      const user = await storage.createUser({
        email,
        password,
        name: name || email.split('@')[0],
        role: userRole,
        tenantId: tenant.id,
        emailVerified: false,
        verificationToken: verificationTokenHash,
        licenseType: 'read_write',
      });

      // Send verification email with plaintext token
      try {
        await sendVerificationEmail(email, verificationTokenPlaintext, user.name || undefined);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }

      // Send welcome email with license info for new tenants
      if (isNewTenant && servicePlan) {
        try {
          await sendSelfServiceWelcomeEmail(email, user.name || '', tenant.name, servicePlan);
        } catch (welcomeError) {
          console.error("Failed to send welcome email:", welcomeError);
        }
      }

      // Push to HubSpot as new deal
      try {
        const { createHubSpotDeal, isHubSpotConnected } = await import('./hubspot');
        if (await isHubSpotConnected()) {
          await createHubSpotDeal({
            tenantName: tenant.name,
            email,
            domain,
            planName: servicePlan?.displayName || 'Trial',
            signupDate: new Date(),
          });
        }
      } catch (hubspotError) {
        console.error("Failed to create HubSpot deal:", hubspotError);
      }

      res.json({ 
        message: "Account created! Please check your email to verify your account.",
        email: user.email,
        isNewOrganization: isNewTenant,
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
      console.log(`[Verify Email] Looking for token hash: ${tokenHash.substring(0, 16)}...`);
      
      const user = await storage.getUserByVerificationToken(tokenHash);
      if (!user) {
        console.log(`[Verify Email] No user found with token hash: ${tokenHash.substring(0, 16)}...`);
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }
      
      console.log(`[Verify Email] Found user: ${user.email}`);

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
  app.get("/api/tenants", ...adminWithOptionalTenant, async (req: Request, res: Response) => {
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

  // Vocabulary endpoints
  // Get effective vocabulary for current tenant (any authenticated user)
  app.get("/api/vocabulary", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const vocabulary = await storage.getEffectiveVocabulary(req.effectiveTenantId || null);
      res.json(vocabulary);
    } catch (error) {
      console.error("Error fetching vocabulary:", error);
      res.status(500).json({ error: "Failed to fetch vocabulary" });
    }
  });

  // Get system vocabulary defaults (platform admin only)
  app.get("/api/vocabulary/system", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const systemVocab = await storage.getSystemVocabulary();
      // Return system vocabulary if it exists, otherwise return built-in defaults
      res.json(systemVocab?.terms || defaultVocabulary);
    } catch (error) {
      console.error("Error fetching system vocabulary:", error);
      res.status(500).json({ error: "Failed to fetch system vocabulary" });
    }
  });

  // Update system vocabulary defaults (platform admin only)
  app.put("/api/vocabulary/system", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const terms = req.body as VocabularyTerms;
      
      // Basic validation - ensure all required terms are present
      const requiredTerms = ['goal', 'strategy', 'objective', 'keyResult', 'bigRock', 'meeting', 'focusRhythm'];
      for (const term of requiredTerms) {
        if (!terms[term as keyof VocabularyTerms] || 
            !terms[term as keyof VocabularyTerms].singular || 
            !terms[term as keyof VocabularyTerms].plural) {
          return res.status(400).json({ 
            error: `Missing or invalid term: ${term}. Each term must have singular and plural values.` 
          });
        }
      }
      
      const updated = await storage.upsertSystemVocabulary(terms, req.user?.id || 'system');
      res.json(updated.terms);
    } catch (error) {
      console.error("Error updating system vocabulary:", error);
      res.status(500).json({ error: "Failed to update system vocabulary" });
    }
  });

  // Get tenant vocabulary overrides (tenant admin)
  app.get("/api/vocabulary/tenant/:tenantId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Check access
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      
      res.json(tenant.vocabularyOverrides || {});
    } catch (error) {
      console.error("Error fetching tenant vocabulary:", error);
      res.status(500).json({ error: "Failed to fetch tenant vocabulary" });
    }
  });

  // Update tenant vocabulary overrides (tenant admin)
  app.put("/api/vocabulary/tenant/:tenantId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Check access
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const vocabularyOverrides = req.body as Partial<VocabularyTerms>;
      
      const tenant = await storage.updateTenant(tenantId, { vocabularyOverrides } as any);
      res.json(tenant.vocabularyOverrides || {});
    } catch (error) {
      console.error("Error updating tenant vocabulary:", error);
      res.status(500).json({ error: "Failed to update tenant vocabulary" });
    }
  });

  // User CRUD endpoints (tenant admin can manage users in their tenant)
  app.get("/api/users", ...adminWithOptionalTenant, async (req: Request, res: Response) => {
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
      const { sendWelcomeEmail: shouldSendWelcome, ...userData } = req.body;
      const validatedData = insertUserSchema.parse(userData);
      
      // Normalize tenantId: convert "NONE" or empty string to null
      if (validatedData.tenantId === "NONE" || validatedData.tenantId === "") {
        validatedData.tenantId = null;
      }
      
      // Validate userType↔role consistency using shared RBAC helper
      const userType = (validatedData as any).userType || USER_TYPES.CLIENT;
      const role = validatedData.role;
      const allowedRoles = getAvailableRolesForUserType(userType);
      
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ 
          error: "Invalid role for user type",
          message: `Users with type '${userType}' can only have roles: ${allowedRoles.join(', ')}`
        });
      }
      
      // Tenant admins can only create users in their own tenant
      const callerRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(callerRole as any);
      
      if (!canAccessAny && validatedData.tenantId && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot create users in other tenants" });
      }
      
      const user = await storage.createUser(validatedData);
      
      // Send welcome email if requested
      if (shouldSendWelcome && user.email) {
        try {
          let tenantName: string | undefined;
          if (user.tenantId) {
            const tenant = await storage.getTenantById(user.tenantId);
            tenantName = tenant?.name;
          }
          await sendWelcomeEmail(user.email, user.name || undefined, tenantName);
          console.log(`[User Creation] Welcome email sent to ${user.email}`);
        } catch (emailError) {
          console.error(`[User Creation] Failed to send welcome email to ${user.email}:`, emailError);
          // Continue - user was created successfully, email failure is non-fatal
        }
      }
      
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
      
      const callerRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(callerRole as any);
      
      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const partialSchema = insertUserSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Normalize tenantId: convert "NONE" or empty string to null
      if (validatedData.tenantId === "NONE" || validatedData.tenantId === "") {
        validatedData.tenantId = null;
      }
      
      // Validate userType↔role consistency using shared RBAC helper (if either field is being updated)
      const newUserType = (validatedData as any).userType ?? (targetUser as any).userType ?? USER_TYPES.CLIENT;
      const newRole = validatedData.role ?? targetUser.role;
      const allowedRoles = getAvailableRolesForUserType(newUserType);
      
      if (!allowedRoles.includes(newRole)) {
        return res.status(400).json({ 
          error: "Invalid role for user type",
          message: `Users with type '${newUserType}' can only have roles: ${allowedRoles.join(', ')}`
        });
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

  // Resend welcome email to a user
  app.post("/api/users/:id/resend-welcome", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      let tenantName: string | undefined;
      if (targetUser.tenantId) {
        const tenant = await storage.getTenantById(targetUser.tenantId);
        tenantName = tenant?.name;
      }
      
      await sendWelcomeEmail(targetUser.email, targetUser.name || undefined, tenantName);
      console.log(`[Resend Welcome] Welcome email sent to ${targetUser.email}`);
      
      res.json({ success: true, message: `Welcome email sent to ${targetUser.email}` });
    } catch (error) {
      console.error("Error resending welcome email:", error);
      res.status(500).json({ error: "Failed to send welcome email" });
    }
  });

  // Manually verify a user's email (admin only)
  app.post("/api/users/:id/manual-verify", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (targetUser.emailVerified) {
        return res.status(400).json({ error: "User is already verified" });
      }
      
      // Update user to set emailVerified to true
      await storage.updateUser(id, { emailVerified: true });
      console.log(`[Manual Verify] User ${targetUser.email} manually verified by ${req.user?.email}`);
      
      res.json({ success: true, message: `User ${targetUser.email} verified successfully` });
    } catch (error) {
      console.error("Error manually verifying user:", error);
      res.status(500).json({ error: "Failed to verify user" });
    }
  });

  // Bulk import users from CSV
  app.post("/api/users/bulk-import", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { users: usersData, sendWelcomeEmails, defaultTenantId } = req.body;
      
      if (!Array.isArray(usersData) || usersData.length === 0) {
        return res.status(400).json({ error: "No users provided" });
      }
      
      if (usersData.length > 100) {
        return res.status(400).json({ error: "Maximum 100 users per import" });
      }
      
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      // Enforce tenant restrictions
      const effectiveTenantId = canAccessAny ? (defaultTenantId || null) : req.effectiveTenantId;
      
      const results: { email: string; success: boolean; error?: string }[] = [];
      const createdUsers: any[] = [];
      
      for (const userData of usersData) {
        try {
          const { email, name, role = "tenant_user", password } = userData;
          
          if (!email || !password) {
            results.push({ email: email || "unknown", success: false, error: "Email and password required" });
            continue;
          }
          
          // Check for existing user
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser) {
            results.push({ email, success: false, error: "User already exists" });
            continue;
          }
          
          // Validate role
          const validRoles = ["tenant_user", "tenant_admin", "admin", "global_admin", "vega_consultant", "vega_admin"];
          const userRoleToUse = validRoles.includes(role) ? role : "tenant_user";
          
          const user = await storage.createUser({
            email,
            password,
            name: name || email.split('@')[0],
            role: userRoleToUse,
            tenantId: effectiveTenantId,
          });
          
          createdUsers.push(user);
          results.push({ email, success: true });
          
        } catch (userError: any) {
          results.push({ 
            email: userData.email || "unknown", 
            success: false, 
            error: userError.message || "Failed to create user" 
          });
        }
      }
      
      // Send welcome emails if requested
      if (sendWelcomeEmails && createdUsers.length > 0) {
        let tenantName: string | undefined;
        if (effectiveTenantId) {
          const tenant = await storage.getTenantById(effectiveTenantId);
          tenantName = tenant?.name;
        }
        
        for (const user of createdUsers) {
          try {
            await sendWelcomeEmail(user.email, user.name || undefined, tenantName);
            console.log(`[Bulk Import] Welcome email sent to ${user.email}`);
          } catch (emailError) {
            console.error(`[Bulk Import] Failed to send welcome email to ${user.email}:`, emailError);
          }
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      res.json({ 
        success: true, 
        message: `Created ${successCount} users${failCount > 0 ? `, ${failCount} failed` : ""}`,
        results,
        created: successCount,
        failed: failCount
      });
    } catch (error) {
      console.error("Error in bulk import:", error);
      res.status(500).json({ error: "Failed to import users" });
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

  // Teams routes (admin only for CUD, any user can read)
  app.get("/api/teams/:tenantId", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const teams = await storage.getTeamsByTenantId(tenantId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/team/:id", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const team = await storage.getTeamById(id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && team.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Check for duplicate team name
      const existing = await storage.getTeamByName(validatedData.tenantId, validatedData.name);
      if (existing) {
        return res.status(400).json({ error: "A team with this name already exists" });
      }
      
      const team = await storage.createTeam({
        ...validatedData,
        createdBy: req.user?.id,
      });
      res.json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ error: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertTeamSchema.partial().parse(req.body);
      
      // Get team to verify tenant access
      const existingTeam = await storage.getTeamById(id);
      if (!existingTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && existingTeam.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Check for duplicate name if name is being updated
      if (validatedData.name && validatedData.name !== existingTeam.name) {
        const existing = await storage.getTeamByName(existingTeam.tenantId, validatedData.name);
        if (existing) {
          return res.status(400).json({ error: "A team with this name already exists" });
        }
      }
      
      const team = await storage.updateTeam(id, {
        ...validatedData,
        updatedBy: req.user?.id,
      });
      res.json(team);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get team to verify tenant access
      const team = await storage.getTeamById(id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && team.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteTeam(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // Team member management
  app.post("/api/teams/:id/members", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      const team = await storage.getTeamById(id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      
      if (!canAccessAny && team.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Add user to memberIds array
      const currentMembers = team.memberIds || [];
      if (!currentMembers.includes(userId)) {
        currentMembers.push(userId);
        const updated = await storage.updateTeam(id, { memberIds: currentMembers });
        res.json(updated);
      } else {
        res.json(team); // Already a member
      }
    } catch (error) {
      console.error("Error adding team member:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  app.delete("/api/teams/:id/members/:userId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id, userId } = req.params;
      
      const team = await storage.getTeamById(id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Enforce tenant isolation
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && team.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Remove user from memberIds array
      const currentMembers = team.memberIds || [];
      const updatedMembers = currentMembers.filter(m => m !== userId);
      const updated = await storage.updateTeam(id, { memberIds: updatedMembers });
      res.json(updated);
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ error: "Failed to remove team member" });
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

  // Consultant Access Grant endpoints
  // Get all consultants with access to a specific tenant
  app.get("/api/consultant-access/tenant/:tenantId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      
      // Check access: must be own tenant or have cross-tenant permission
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const grants = await storage.getConsultantsWithAccessToTenant(tenantId);
      
      // Enrich with user details
      const enrichedGrants = await Promise.all(
        grants.map(async (grant) => {
          const user = await storage.getUser(grant.consultantUserId);
          return {
            ...grant,
            consultantEmail: user?.email,
            consultantName: user?.name,
          };
        })
      );
      
      res.json(enrichedGrants);
    } catch (error) {
      console.error("Error fetching consultant access grants:", error);
      res.status(500).json({ error: "Failed to fetch consultant access" });
    }
  });

  // Get access grants for a specific consultant
  app.get("/api/consultant-access/user/:userId", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const grants = await storage.getConsultantTenantAccess(userId);
      
      // Enrich with tenant details
      const enrichedGrants = await Promise.all(
        grants.map(async (grant) => {
          const tenant = await storage.getTenantById(grant.tenantId);
          return {
            ...grant,
            tenantName: tenant?.name,
          };
        })
      );
      
      res.json(enrichedGrants);
    } catch (error) {
      console.error("Error fetching consultant grants:", error);
      res.status(500).json({ error: "Failed to fetch consultant grants" });
    }
  });

  // Grant consultant access to a tenant
  app.post("/api/consultant-access", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { consultantUserId, tenantId, expiresAt, notes } = req.body;
      
      if (!consultantUserId || !tenantId) {
        return res.status(400).json({ error: "consultantUserId and tenantId are required" });
      }
      
      // Check access: tenant admins can only grant access to their own tenant
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot grant access to other tenants" });
      }
      
      // Verify the target user exists and is a consultant
      const targetUser = await storage.getUser(consultantUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (targetUser.role !== ROLES.VEGA_CONSULTANT) {
        return res.status(400).json({ error: "User is not a consultant" });
      }
      
      const grant = await storage.grantConsultantAccess({
        consultantUserId,
        tenantId,
        grantedBy: req.user!.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes || null,
      });
      
      res.json(grant);
    } catch (error) {
      console.error("Error granting consultant access:", error);
      res.status(500).json({ error: "Failed to grant consultant access" });
    }
  });

  // Revoke consultant access from a tenant
  app.delete("/api/consultant-access/:userId/:tenantId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { userId, tenantId } = req.params;
      
      // Check access: tenant admins can only revoke access to their own tenant
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot revoke access from other tenants" });
      }
      
      // Check if grant exists first
      const hasAccess = await storage.hasConsultantAccess(userId, tenantId);
      if (!hasAccess) {
        return res.status(404).json({ error: "Access grant not found" });
      }
      
      await storage.revokeConsultantAccess(userId, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking consultant access:", error);
      res.status(500).json({ error: "Failed to revoke consultant access" });
    }
  });

  // Get consultants (filtered to just consultant role users)
  app.get("/api/consultants", ...adminWithOptionalTenant, async (req: Request, res: Response) => {
    try {
      // Get all users and filter to just consultants
      const allUsers = await storage.getAllUsers();
      const consultants = allUsers
        .filter(u => u.role === ROLES.VEGA_CONSULTANT)
        .map(({ password, ...user }) => user);
      
      res.json(consultants);
    } catch (error) {
      console.error("Error fetching consultants:", error);
      res.status(500).json({ error: "Failed to fetch consultants" });
    }
  });

  // Import and use enhanced OKR routes (with auth + tenant isolation)
  const { okrRouter } = await import("./routes-okr");
  app.use("/api/okr", ...authWithTenant, okrRouter);

  // Import and use value tagging routes
  const { registerValueRoutes } = await import("./routes-values");
  registerValueRoutes(app);

  // Import and use import routes (Viva Goals, etc.) - requires admin permissions
  const { importRouter } = await import("./routes-import");
  app.use("/api/import", ...adminOnly, importRouter);

  // Import and use AI routes (grounding documents + chat)
  const { aiRouter } = await import("./routes-ai");
  app.use("/api/ai", aiRouter);

  // Import and use Microsoft 365 routes (Outlook calendar sync, email)
  // Apply full auth + tenant isolation middleware for all M365 routes
  const m365Routes = await import("./routes-m365");
  app.use("/api/m365", ...authWithTenant, m365Routes.default);

  // Import and use Entra SSO routes
  const { entraRouter } = await import("./routes-entra");
  app.use("/auth/entra", entraRouter);

  // Import and use Microsoft Planner routes - with auth and tenant access
  const { plannerRouter } = await import("./routes-planner");
  app.use("/api/planner", ...authWithTenant, plannerRouter);

  // Import and use Outlook Calendar routes (per-user OAuth) - with auth and tenant access
  const { outlookRouter } = await import("./routes-outlook");
  app.use("/api/outlook", ...authWithTenant, outlookRouter);

  // Import and use Reporting routes (snapshots, templates, reports)
  const reportingRouter = await import("./routes-reporting");
  app.use("/api/reporting", ...authWithTenant, reportingRouter.default);

  // Import and use Launchpad routes (AI document-to-Company OS generator)
  const launchpadRouter = await import("./routes-launchpad");
  app.use("/api/launchpad", ...authWithTenant, launchpadRouter.default);

  // ============================================
  // PLATFORM ADMIN ROUTES - Service Plans & Blocked Domains
  // ============================================

  // Get all service plans
  app.get("/api/admin/service-plans", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const plans = await storage.getAllServicePlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching service plans:", error);
      res.status(500).json({ error: "Failed to fetch service plans" });
    }
  });

  // Create a new service plan
  app.post("/api/admin/service-plans", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const plan = await storage.createServicePlan(req.body);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating service plan:", error);
      res.status(500).json({ error: "Failed to create service plan" });
    }
  });

  // Update a service plan
  app.patch("/api/admin/service-plans/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plan = await storage.updateServicePlan(id, req.body);
      if (!plan) {
        return res.status(404).json({ error: "Service plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error updating service plan:", error);
      res.status(500).json({ error: "Failed to update service plan" });
    }
  });

  // Get all blocked domains
  app.get("/api/admin/blocked-domains", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const domains = await storage.getAllBlockedDomains();
      res.json(domains);
    } catch (error) {
      console.error("Error fetching blocked domains:", error);
      res.status(500).json({ error: "Failed to fetch blocked domains" });
    }
  });

  // Block a domain
  app.post("/api/admin/blocked-domains", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { domain, reason } = req.body;
      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }
      const blocked = await storage.blockDomain({ domain, reason, blockedBy: req.user!.id });
      res.status(201).json(blocked);
    } catch (error: any) {
      if (error.message?.includes("already blocked")) {
        return res.status(409).json({ error: "Domain is already blocked" });
      }
      console.error("Error blocking domain:", error);
      res.status(500).json({ error: "Failed to block domain" });
    }
  });

  // Unblock a domain
  app.delete("/api/admin/blocked-domains/:domain", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { domain } = req.params;
      await storage.unblockDomain(domain);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unblocking domain:", error);
      res.status(500).json({ error: "Failed to unblock domain" });
    }
  });

  // Update tenant's service plan (platform admin only)
  app.patch("/api/admin/tenants/:id/plan", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { servicePlanId, planExpiresAt, planStartedAt } = req.body;
      
      const tenant = await storage.getTenantById(id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const updatedTenant = await storage.updateTenant(id, {
        servicePlanId,
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : undefined,
        planStartedAt: planStartedAt ? new Date(planStartedAt) : new Date(),
      });
      
      res.json(updatedTenant);
    } catch (error) {
      console.error("Error updating tenant plan:", error);
      res.status(500).json({ error: "Failed to update tenant plan" });
    }
  });

  // Get all tenants with their plan info (platform admin only)
  app.get("/api/admin/tenants", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const tenants = await storage.getAllTenants();
      const plans = await storage.getAllServicePlans();
      
      // Enrich tenants with plan details
      const enrichedTenants = tenants.map(tenant => {
        const plan = plans.find(p => p.id === tenant.servicePlanId);
        return {
          ...tenant,
          servicePlan: plan || null,
        };
      });
      
      res.json(enrichedTenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
