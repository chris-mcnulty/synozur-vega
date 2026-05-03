import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { readFile } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { storage } from "./storage";
import { verifyPassword } from "./auth";
import { z } from "zod";
import { 
  insertTenantSchema,
  createTenantSchema,
  insertFoundationSchema,
  insertStrategySchema,
  insertOkrSchema,
  insertKpiSchema,
  insertMeetingSchema,
  insertUserSchema,
  insertTeamSchema,
  type VocabularyTerms,
  defaultVocabulary,
  type Objective,
  type KeyResult,
  type BigRock,
  type Strategy,
  type Ambition
} from "@shared/schema";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail,
  sendSelfServiceWelcomeEmail,
  sendPlanExpirationReminderEmail,
  sendReassignmentEmail,
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
  isResourceOwner,
  requireReadWriteLicense
} from "./middleware/rbac";
import { ROLES, PERMISSIONS, USER_TYPES, getAvailableRolesForUserType, hasPermission, Role } from "../shared/rbac";
import { isPublicEmailDomain } from "../shared/publicDomains";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { mcpRouter, createApiKeyForUser } from "./mcp";
import { oauthRouter, generateOAuthClientCredentials } from "./mcp/oauth";
import { portalRouter } from "./routes-portal";
import { assertSafeJwksUri } from "./portal/jwks-url-validator";
import { MCP_SCOPES } from "@shared/schema";

// Helper function for MCP scope descriptions
function getScropeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'read:okrs': 'Read objectives and key results',
    'write:okrs': 'Create and update objectives and key results',
    'read:big_rocks': 'Read big rocks (major initiatives)',
    'write:big_rocks': 'Create and update big rocks',
    'read:strategies': 'Read strategies',
    'read:foundations': 'Read mission, vision, values, and annual goals',
    'read:teams': 'Read teams',
    'read:meetings': 'Read Focus Rhythm meetings',
  };
  return descriptions[scope] || scope;
}

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

// Capture server startup time (equals deployment time in production)
const SERVER_START_TIME = new Date().toISOString();

export async function registerRoutes(app: Express): Promise<Server> {
  // Build info endpoint for version display
  app.get("/api/build-info", (req, res) => {
    res.json({
      buildTime: SERVER_START_TIME,
      environment: process.env.NODE_ENV || 'development'
    });
  });

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

  // Changelog route - serve the markdown file (like user guide)
  app.get("/api/changelog", async (req, res) => {
    try {
      const changelogPath = join(process.cwd(), "CHANGELOG.md");
      const content = await readFile(changelogPath, "utf-8");
      res.type("text/markdown").send(content);
    } catch (error) {
      console.error("Error reading changelog:", error);
      res.status(500).json({ error: "Failed to load changelog" });
    }
  });

  // ============================================================================
  // "What's New" Changelog Modal API (pattern from Constellation)
  //
  // Monthly release workflow:
  //   1. Add a new `### Month Day, Year - Version X.Y` section at the TOP of
  //      CHANGELOG.md under the relevant month header.
  //   2. Either restart the server OR hit `POST /api/admin/changelog/refresh`
  //      (vega_admin / global_admin only) to re-detect the current version and
  //      clear the in-memory summary cache.
  //   3. Every user whose `lastDismissedChangelogVersion` differs from the new
  //      version will see the What's New modal on their next request.
  // ============================================================================

  // Current version detected from CHANGELOG.md. Exposed via refresh endpoint
  // so monthly releases can update it without a server restart.
  let currentChangelogVersion = "";

  // In-memory cache for AI-generated summaries (keyed by version)
  const changelogSummaryCache = new Map<string, { summary: string; highlights: Array<{ icon: string; title: string; description: string }> }>();

  function detectCurrentChangelogVersion(): string {
    try {
      const changelogPath = join(process.cwd(), "CHANGELOG.md");
      if (!existsSync(changelogPath)) {
        return "";
      }
      const content = readFileSync(changelogPath, "utf-8");
      // The first `Version X.Y` marker in the file is the newest release
      // (CHANGELOG.md is ordered newest-first by convention).
      const match = content.match(/Version\s+([\d.]+)/);
      return match ? match[1] : "";
    } catch (err: any) {
      console.error("[CHANGELOG] Failed to read CHANGELOG.md:", err.message);
      return "";
    }
  }

  // Seed on startup
  (function seedChangelogVersion() {
    currentChangelogVersion = detectCurrentChangelogVersion();
    if (currentChangelogVersion) {
      console.log(`[CHANGELOG] Auto-detected version: ${currentChangelogVersion}`);
    }
  })();

  // Extract structured highlights from markdown as fallback when AI is unavailable
  function extractFallbackHighlights(markdown: string): Array<{ icon: string; title: string; description: string }> {
    const highlights: Array<{ icon: string; title: string; description: string }> = [];
    const featurePattern = /\*\*([^*]+)\*\*\n((?:- [^\n]+\n?)+)/g;
    let match;
    const icons = ["star", "message-circle", "bar-chart-3", "clipboard-list", "wrench", "book-open", "zap", "target"];
    let iconIdx = 0;
    while ((match = featurePattern.exec(markdown)) !== null && highlights.length < 5) {
      const title = match[1].trim();
      if (title === "Release Date:" || title === "Status:" || title === "Codename:") continue;
      const bullets = match[2].split("\n").filter((l: string) => l.trim().startsWith("- ")).map((l: string) => l.replace(/^- /, "").trim());
      const description = bullets.slice(0, 2).join(". ");
      if (description) {
        highlights.push({ icon: icons[iconIdx % icons.length], title, description });
        iconIdx++;
      }
    }
    return highlights;
  }

  app.get("/api/changelog/whats-new", authWithTenant, async (req: any, res) => {
    try {
      const user = req.user;
      const tenantId = req.tenantId || user.tenantId;

      if (!currentChangelogVersion) {
        return res.json({ showModal: false });
      }

      // Check tenant setting
      if (tenantId) {
        const tenant = await storage.getTenantById(tenantId);
        if (tenant && tenant.showChangelogOnLogin === false) {
          return res.json({ showModal: false });
        }
      }

      // Only suppress for brand-new users (created in the last hour) who haven't
      // dismissed any version yet — they see the Launchpad welcome screen first.
      // Existing users with null simply haven't seen any What's New modal yet.
      if (!user.lastDismissedChangelogVersion) {
        const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (createdAt > oneHourAgo) {
          await storage.updateUser(user.id, { lastDismissedChangelogVersion: currentChangelogVersion });
          return res.json({ showModal: false });
        }
      }

      // Check if user already dismissed this version
      if (user.lastDismissedChangelogVersion === currentChangelogVersion) {
        return res.json({ showModal: false });
      }

      // Check cache
      if (changelogSummaryCache.has(currentChangelogVersion)) {
        const cached = changelogSummaryCache.get(currentChangelogVersion)!;
        return res.json({
          showModal: true,
          version: currentChangelogVersion,
          ...cached,
        });
      }

      // Read changelog and extract recent sections (last 2 weeks)
      let changelogContent = "";
      try {
        const changelogPath = join(process.cwd(), "CHANGELOG.md");
        const fullContent = await readFile(changelogPath, "utf-8");

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const versionBlocks = fullContent.split(/(?=###\s+)/);
        const recentSections: string[] = [];
        for (const block of versionBlocks) {
          const dateMatch = block.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/);
          if (dateMatch) {
            const blockDate = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`);
            if (blockDate >= twoWeeksAgo) {
              recentSections.push(block.trim());
            }
          }
        }

        changelogContent = recentSections.length > 0
          ? recentSections.join("\n\n").substring(0, 4000)
          : fullContent.substring(0, 2000);
      } catch {
        return res.json({ showModal: false });
      }

      if (!changelogContent) {
        return res.json({ showModal: true, version: currentChangelogVersion, summary: "New updates are available!", highlights: [] });
      }

      // Generate AI summary with structured highlights using getSimpleCompletion
      // (bypasses grounding docs — this is a standalone summarization task)
      try {
        const { getSimpleCompletion } = await import("./ai");
        const { AI_FEATURES } = await import("@shared/schema");

        const systemPrompt = `You summarize software release notes into friendly, warm "What's New" announcements for business users. Write as if speaking directly to the user ("You can now...", "We've improved..."). Use plain everyday language — no jargon, no markdown, no bold/italic markers. Return ONLY valid JSON with no code fences.`;

        const userPrompt = `Summarize these release notes from "Vega" (a company strategy and OKR management platform) into 3-5 highlights for end users.

Return this exact JSON structure:
{ "summary": "One friendly sentence overview", "highlights": [{ "icon": "lucide-icon-name", "title": "Short Catchy Title (3-5 words)", "description": "2-3 sentences about what this means for the user, written warmly and clearly." }] }

For icon, choose from: star, message-circle, bar-chart-3, shield-check, zap, target, wrench, book-open, clipboard-list, bell, rocket, layout-dashboard

RELEASE NOTES:
${changelogContent}`;

        const aiResponse = await getSimpleCompletion(
          systemPrompt,
          userPrompt,
          { maxTokens: 16384 },
          AI_FEATURES.OTHER
        );

        console.log("[CHANGELOG] AI raw response length:", aiResponse.length);
        console.log("[CHANGELOG] AI raw response preview:", aiResponse.substring(0, 300));

        // Strip markdown code fences if present
        let cleanedResponse = aiResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.highlights && parsed.highlights.length > 0) {
            // Strip any residual markdown from descriptions
            const cleanHighlights = parsed.highlights.map((h: any) => ({
              icon: h.icon || "star",
              title: (h.title || "").replace(/\*\*/g, ""),
              description: (h.description || "").replace(/\*\*/g, "").replace(/\*/g, ""),
            }));
            const result = { summary: (parsed.summary || "").replace(/\*\*/g, ""), highlights: cleanHighlights };
            changelogSummaryCache.set(currentChangelogVersion, result);
            console.log("[CHANGELOG] AI summary cached with", cleanHighlights.length, "highlights");
            return res.json({ showModal: true, version: currentChangelogVersion, ...result });
          }
        }
        console.warn("[CHANGELOG] AI response did not contain valid JSON highlights");
      } catch (aiError: any) {
        console.error("[CHANGELOG] AI summary generation failed:", aiError.message);
      }

      // Fallback: extract highlights from markdown structure
      const highlights = extractFallbackHighlights(changelogContent);
      const fallbackResult = { summary: "Here's what's new in the latest updates.", highlights };
      if (highlights.length > 0) {
        changelogSummaryCache.set(currentChangelogVersion, fallbackResult);
      }
      return res.json({ showModal: true, version: currentChangelogVersion, ...fallbackResult });
    } catch (error) {
      console.error("[CHANGELOG] Failed to check changelog status:", error);
      return res.json({ showModal: false });
    }
  });

  app.post("/api/changelog/dismiss", authWithTenant, async (req: any, res) => {
    try {
      const user = req.user;
      const { version } = req.body;

      if (!version || typeof version !== "string") {
        return res.status(400).json({ message: "Version is required" });
      }

      await storage.updateUser(user.id, { lastDismissedChangelogVersion: version } as any);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[CHANGELOG] Failed to dismiss changelog:", error);
      return res.status(500).json({ message: "Failed to dismiss changelog" });
    }
  });

  // Platform admin: re-detect the current changelog version and clear the
  // summary cache. Used as part of the monthly What's New release workflow
  // after editing CHANGELOG.md in production without restarting the server.
  app.post("/api/admin/changelog/refresh", platformAdminOnly, async (_req: any, res: Response) => {
    const previousVersion = currentChangelogVersion;
    const detected = detectCurrentChangelogVersion();
    currentChangelogVersion = detected;
    changelogSummaryCache.clear();

    console.log(
      `[CHANGELOG] Refreshed via admin endpoint. Previous: ${previousVersion || "none"} → Current: ${detected || "none"}`,
    );

    return res.json({
      success: true,
      previousVersion,
      currentVersion: detected,
      cacheCleared: true,
    });
  });

  // OpenAPI specification for M365 Copilot Agent integration
  app.get("/openapi.yaml", async (req, res) => {
    try {
      const specPath = join(process.cwd(), "public/openapi.yaml");
      const content = await readFile(specPath, "utf-8");
      res.type("text/yaml").send(content);
    } catch (error) {
      console.error("Error reading OpenAPI spec:", error);
      res.status(500).json({ error: "Failed to load OpenAPI specification" });
    }
  });

  // OpenAPI specification for the Galaxy Portal API
  app.get("/openapi-portal.yaml", async (req, res) => {
    try {
      const specPath = join(process.cwd(), "public/openapi-portal.yaml");
      const content = await readFile(specPath, "utf-8");
      res.type("text/yaml").send(content);
    } catch (error) {
      console.error("Error reading Portal OpenAPI spec:", error);
      res.status(500).json({ error: "Failed to load Portal OpenAPI specification" });
    }
  });

  // OpenAPI specification in JSON format
  app.get("/openapi.json", async (req, res) => {
    try {
      const specPath = join(process.cwd(), "public/openapi.yaml");
      const yamlContent = await readFile(specPath, "utf-8");
      const yaml = await import("js-yaml");
      const jsonSpec = yaml.load(yamlContent);
      res.json(jsonSpec);
    } catch (error) {
      console.error("Error reading OpenAPI spec:", error);
      res.status(500).json({ error: "Failed to load OpenAPI specification" });
    }
  });

  // M365 Copilot Agent manifests
  app.get("/copilot-agent/manifest.json", async (req, res) => {
    try {
      const manifestPath = join(process.cwd(), "public/copilot-agent/manifest.json");
      const content = await readFile(manifestPath, "utf-8");
      res.type("application/json").send(content);
    } catch (error) {
      console.error("Error reading Copilot manifest:", error);
      res.status(500).json({ error: "Failed to load Copilot manifest" });
    }
  });

  app.get("/copilot-agent/declarative-agent.json", async (req, res) => {
    try {
      const agentPath = join(process.cwd(), "public/copilot-agent/declarative-agent.json");
      const content = await readFile(agentPath, "utf-8");
      res.type("application/json").send(content);
    } catch (error) {
      console.error("Error reading declarative agent:", error);
      res.status(500).json({ error: "Failed to load declarative agent" });
    }
  });

  app.get("/copilot-agent/vega-api-plugin.json", async (req, res) => {
    try {
      const pluginPath = join(process.cwd(), "public/copilot-agent/vega-api-plugin.json");
      const content = await readFile(pluginPath, "utf-8");
      res.type("application/json").send(content);
    } catch (error) {
      console.error("Error reading API plugin:", error);
      res.status(500).json({ error: "Failed to load API plugin" });
    }
  });

  // ============================================
  // MCP (Model Context Protocol) Server
  // ============================================
  
  // Mount the MCP server router
  app.use("/mcp", mcpRouter);
  
  // Mount the OAuth 2.0 authorization server
  app.use("/oauth", oauthRouter);

  // Mount the Galaxy Portal API surface. Trusts Galaxy-issued JWTs and
  // exposes a read-only personalized view of tenant data.
  app.use("/api/portal", portalRouter);

  // MCP API Key Management (admin only - keys provide API access to tenant data)
  app.get("/api/mcp/keys", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const keys = await storage.getMcpApiKeysByUserId(req.user!.id);
      // Return keys without the hash (security)
      const safeKeys = keys.map(({ keyHash, ...rest }) => rest);
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching MCP keys:", error);
      res.status(500).json({ error: "Failed to fetch MCP keys" });
    }
  });

  app.post("/api/mcp/keys", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { name, scopes, expiresInDays, directAuth } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Key name is required" });
      }

      if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ error: "At least one scope is required" });
      }

      // Validate scopes
      const validScopes = Object.values(MCP_SCOPES);
      for (const scope of scopes) {
        if (!validScopes.includes(scope)) {
          return res.status(400).json({ error: `Invalid scope: ${scope}` });
        }
      }

      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const result = await createApiKeyForUser(
        req.user!.id,
        req.effectiveTenantId!,
        name.trim(),
        scopes,
        expiresAt,
        directAuth === true
      );

      // Return the full API key only once (it won't be stored/retrievable again)
      res.status(201).json({
        id: result.id,
        apiKey: result.apiKey,
        prefix: result.prefix,
        message: "Save this API key now. It won't be shown again.",
      });
    } catch (error) {
      console.error("Error creating MCP key:", error);
      res.status(500).json({ error: "Failed to create MCP key" });
    }
  });

  app.delete("/api/mcp/keys/:keyId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { keyId } = req.params;
      
      const key = await storage.getMcpApiKeyById(keyId);
      if (!key) {
        return res.status(404).json({ error: "Key not found" });
      }

      // Users can only revoke their own keys
      if (key.userId !== req.user!.id) {
        return res.status(403).json({ error: "Permission denied" });
      }

      await storage.revokeMcpApiKey(keyId, req.user!.id);
      res.json({ message: "Key revoked successfully" });
    } catch (error) {
      console.error("Error revoking MCP key:", error);
      res.status(500).json({ error: "Failed to revoke MCP key" });
    }
  });

  // Update MCP API key (IP allowlist, name, scopes)
  app.patch("/api/mcp/keys/:keyId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { keyId } = req.params;
      const { name, allowedIps, scopes } = req.body;
      
      const key = await storage.getMcpApiKeyById(keyId);
      if (!key) {
        return res.status(404).json({ error: "Key not found" });
      }

      if (key.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (allowedIps !== undefined) {
        if (!Array.isArray(allowedIps)) {
          return res.status(400).json({ error: "allowedIps must be an array" });
        }
        updates.allowedIps = allowedIps.length > 0 ? allowedIps : null;
      }
      if (scopes !== undefined) {
        if (!Array.isArray(scopes) || scopes.length === 0) {
          return res.status(400).json({ error: "At least one scope is required" });
        }
        const validScopes = Object.values(MCP_SCOPES);
        for (const scope of scopes) {
          if (!validScopes.includes(scope)) {
            return res.status(400).json({ error: `Invalid scope: ${scope}` });
          }
        }
        updates.scopes = scopes;
      }

      const updated = await storage.updateMcpApiKey(keyId, updates);
      const { keyHash, ...safeKey } = updated;
      res.json(safeKey);
    } catch (error) {
      console.error("Error updating MCP key:", error);
      res.status(500).json({ error: "Failed to update MCP key" });
    }
  });

  // Rotate MCP API key (creates new key, marks old for deprecation with grace period)
  app.post("/api/mcp/keys/:keyId/rotate", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { keyId } = req.params;
      const { gracePeriodHours = 24 } = req.body;
      
      const oldKey = await storage.getMcpApiKeyById(keyId);
      if (!oldKey) {
        return res.status(404).json({ error: "Key not found" });
      }

      if (oldKey.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      if (oldKey.status !== 'active') {
        return res.status(400).json({ error: "Can only rotate active keys" });
      }

      const gracePeriodEnds = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

      const newKey = await createApiKeyForUser(
        req.user!.id,
        req.effectiveTenantId!,
        `${oldKey.name} (rotated)`,
        oldKey.scopes,
        oldKey.expiresAt || undefined,
        oldKey.directAuth ?? false
      );

      // If old key had IP restrictions, update new key with same restrictions
      if (oldKey.allowedIps && oldKey.allowedIps.length > 0) {
        await storage.updateMcpApiKey(newKey.id, { allowedIps: oldKey.allowedIps });
      }

      // Mark old key for deprecation after grace period
      await storage.markKeyForRotation(keyId, gracePeriodEnds);

      res.status(201).json({
        newKey: {
          id: newKey.id,
          apiKey: newKey.apiKey,
          prefix: newKey.prefix,
        },
        oldKeyId: keyId,
        gracePeriodEnds: gracePeriodEnds.toISOString(),
        message: `New key created. Old key will continue working until ${gracePeriodEnds.toISOString()}. Save the new API key now - it won't be shown again.`,
      });
    } catch (error) {
      console.error("Error rotating MCP key:", error);
      res.status(500).json({ error: "Failed to rotate MCP key" });
    }
  });

  // Get available MCP scopes (admin only)
  app.get("/api/mcp/scopes", ...adminOnly, async (_req: Request, res: Response) => {
    res.json({
      scopes: Object.entries(MCP_SCOPES).map(([key, value]) => ({
        id: value,
        name: key.replace(/_/g, ' ').toLowerCase(),
        description: getScropeDescription(value),
      })),
    });
  });

  // OAuth Client Management (admin only)
  app.get("/api/oauth/clients", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const clients = await storage.getOauthClientsByTenantId(req.user!.tenantId);
      const sanitized = clients.map(c => ({
        ...c,
        clientSecretHash: undefined,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error('[OAuth] List clients error:', error);
      res.status(500).json({ error: 'Failed to list OAuth clients' });
    }
  });

  app.post("/api/oauth/clients", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { name, redirectUris, scopes } = req.body;
      if (!name || !redirectUris || !Array.isArray(redirectUris) || !scopes || !Array.isArray(scopes)) {
        return res.status(400).json({ error: 'name, redirectUris (array), and scopes (array) are required' });
      }

      const { clientId, clientSecret, clientSecretHash } = generateOAuthClientCredentials();

      const client = await storage.createOauthClient({
        tenantId: req.user!.tenantId,
        clientId,
        clientSecretHash,
        name,
        redirectUris,
        scopes,
        status: 'active',
        createdBy: req.user!.id,
      });

      res.status(201).json({
        ...client,
        clientSecret,
        clientSecretHash: undefined,
      });
    } catch (error) {
      console.error('[OAuth] Create client error:', error);
      res.status(500).json({ error: 'Failed to create OAuth client' });
    }
  });

  app.patch("/api/oauth/clients/:clientId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const client = await storage.getOauthClientById(req.params.clientId);
      if (!client || client.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: 'OAuth client not found' });
      }

      const { name, redirectUris, scopes, status } = req.body;
      const updates: Partial<Pick<typeof client, 'name' | 'redirectUris' | 'scopes' | 'status'>> = {};
      if (name) updates.name = name;
      if (redirectUris) updates.redirectUris = redirectUris;
      if (scopes) updates.scopes = scopes;
      if (status) updates.status = status;

      const updated = await storage.updateOauthClient(client.id, updates);
      res.json({ ...updated, clientSecretHash: undefined });
    } catch (error) {
      console.error('[OAuth] Update client error:', error);
      res.status(500).json({ error: 'Failed to update OAuth client' });
    }
  });

  app.delete("/api/oauth/clients/:clientId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const client = await storage.getOauthClientById(req.params.clientId);
      if (!client || client.tenantId !== req.user!.tenantId) {
        return res.status(404).json({ error: 'OAuth client not found' });
      }

      await storage.deleteOauthClient(client.id);
      res.json({ success: true });
    } catch (error) {
      console.error('[OAuth] Delete client error:', error);
      res.status(500).json({ error: 'Failed to delete OAuth client' });
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

      // Galaxy portal users authenticate exclusively via Galaxy-issued JWTs
      // at /api/portal/*. Reject any attempt to use the local password
      // pathway, regardless of the stored password hash.
      if (user.role === ROLES.PORTAL_USER || user.authProvider === 'galaxy') {
        return res.status(403).json({
          error: "This account uses Galaxy single sign-on and cannot log in with a password.",
        });
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
      const { email, password, name, recaptchaToken, organizationSize, industry, location } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Validate required organization classification fields
      if (!organizationSize || !industry || !location) {
        return res.status(400).json({ 
          error: "Organization classification is required",
          details: "Please provide organization size, industry, and location"
        });
      }

      // Verify reCAPTCHA if token provided and secret is configured
      const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
      console.log('[reCAPTCHA Debug] Server - Secret configured:', recaptchaSecret ? `${recaptchaSecret.substring(0, 10)}...` : 'NOT SET');
      console.log('[reCAPTCHA Debug] Server - Token received:', recaptchaToken ? `${recaptchaToken.substring(0, 20)}...` : 'NOT PROVIDED');
      
      if (recaptchaSecret && recaptchaToken) {
        try {
          console.log('[reCAPTCHA Debug] Server - Verifying with Google...');
          const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${recaptchaSecret}&response=${recaptchaToken}`,
          });
          const recaptchaResult = await recaptchaResponse.json() as { success: boolean; score?: number; 'error-codes'?: string[] };
          console.log('[reCAPTCHA Debug] Server - Verification result:', JSON.stringify(recaptchaResult));
          
          if (!recaptchaResult.success || (recaptchaResult.score && recaptchaResult.score < 0.5)) {
            console.log('[reCAPTCHA Debug] Server - Verification FAILED:', recaptchaResult['error-codes']);
            return res.status(400).json({ error: "reCAPTCHA verification failed. Please try again." });
          }
          console.log('[reCAPTCHA Debug] Server - Verification PASSED');
        } catch (recaptchaError) {
          console.error("[reCAPTCHA Debug] Server - Verification error:", recaptchaError);
        }
      } else {
        console.log('[reCAPTCHA Debug] Server - Skipping verification (secret or token missing)');
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
            organizationSize: organizationSize || null,
            industry: industry || null,
            location: location || null,
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
            organizationSize: organizationSize || null,
            industry: industry || null,
            location: location || null,
          });
          console.log(`[Signup] Created new tenant for domain ${domain}:`, tenant.id);
        }
        isNewTenant = true;
      }

      // Generate verification token (returns plaintext and hash)
      const { plaintext: verificationTokenPlaintext, hash: verificationTokenHash } = generateVerificationToken();
      console.log(`[Signup] Generated verification token for ${email}, hash prefix: ${verificationTokenHash.substring(0, 16)}...`);

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
      console.log(`[Signup] Created user ${user.id} with stored token hash prefix: ${user.verificationToken?.substring(0, 16)}...`);

      // Send verification email with plaintext token
      try {
        await sendVerificationEmail(email, verificationTokenPlaintext, user.name || undefined);
        console.log(`[Signup] Sent verification email to ${email}`);
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
        console.log('[Signup] Attempting HubSpot integration...');
        const { createHubSpotDeal, isHubSpotConnected } = await import('./hubspot');
        const hubspotConnected = await isHubSpotConnected();
        console.log('[Signup] HubSpot connected:', hubspotConnected);
        if (hubspotConnected) {
          console.log('[Signup] Creating HubSpot deal for:', email);
          const result = await createHubSpotDeal({
            tenantName: tenant.name,
            email,
            domain,
            planName: servicePlan?.displayName || 'Trial',
            signupDate: new Date(),
          });
          console.log('[Signup] HubSpot deal result:', result);
        } else {
          console.log('[Signup] Skipping HubSpot - not connected');
        }
      } catch (hubspotError) {
        console.error("[Signup] Failed to create HubSpot deal:", hubspotError);
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

  // Get current user data (for permissions/RBAC checks on frontend)
  app.get("/api/user", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.userId = undefined;
        return res.status(401).json({ error: "User not found" });
      }

      // Return user without password hash
      const { password, ...safeUser } = user;
      res.json(safeUser);
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

  // Track recently verified tokens to handle duplicate requests (in-memory, short-lived)
  const recentlyVerifiedTokens = new Map<string, { email: string; timestamp: number }>();
  
  // Clean up old entries every 5 minutes
  setInterval(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [token, data] of recentlyVerifiedTokens) {
      if (data.timestamp < fiveMinutesAgo) {
        recentlyVerifiedTokens.delete(token);
      }
    }
  }, 60 * 1000);

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
      
      // Check if this token was just verified (handles duplicate requests)
      const recentVerification = recentlyVerifiedTokens.get(tokenHash);
      if (recentVerification) {
        console.log(`[Verify Email] Token already verified recently for ${recentVerification.email}`);
        return res.json({ message: "Email verified successfully! You can now log in." });
      }
      
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
      
      // Remember this token was just verified (for 5 minutes)
      recentlyVerifiedTokens.set(tokenHash, { email: user.email, timestamp: Date.now() });

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

      // Portal users have no local credentials to reset.
      if (user.role === ROLES.PORTAL_USER || user.authProvider === 'galaxy') {
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
  // All authenticated users can see their own tenant(s)
  // Note: This endpoint uses only auth without tenant validation since it's used to discover tenants
  app.get("/api/tenants", requireAuth, loadCurrentUser, async (req: Request, res: Response) => {
    try {
      // Platform admins can see all tenants, others only see their own
      const userRole = req.user?.role;
      if (userRole === ROLES.VEGA_ADMIN || userRole === ROLES.GLOBAL_ADMIN || userRole === ROLES.VEGA_CONSULTANT) {
        const allTenants = await storage.getAllTenants();
        res.json(allTenants);
      } else {
        // Regular users only see their own tenant (from their user record, not header)
        const userTenantId = req.user?.tenantId;
        const tenant = userTenantId ? await storage.getTenantById(userTenantId) : null;
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
      // Use createTenantSchema which requires org classification fields
      const validatedData = createTenantSchema.parse(req.body);
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

      // SSRF guard for tenant-supplied JWKS URI overrides.
      const settings = validatedData.galaxySettings as { jwksUri?: string } | null | undefined;
      if (settings && typeof settings.jwksUri === 'string' && settings.jwksUri.length > 0) {
        try {
          await assertSafeJwksUri(settings.jwksUri);
        } catch (err) {
          return res.status(400).json({
            error: "Invalid galaxySettings.jwksUri",
            details: err instanceof Error ? err.message : String(err),
          });
        }
      }

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

  // Weekly digest (Task #62) — admin preview / test-send / run-now
  // Tenant admins can preview their own tenant; vega/global admins can target any tenant.
  app.post("/api/tenants/:id/weekly-digest/preview", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id: tenantId } = req.params;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const userId = (req.body?.userId as string | undefined) ?? req.user!.id;
      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "Target user not found in tenant" });
      }
      const { tenantLocalWeekStart, buildDigestForUser } = await import('./services/weekly-digest');
      const tz = tenant.weeklyDigestTimezone || 'America/Los_Angeles';
      const periodStart = tenantLocalWeekStart(tz);
      const [py, pm, pd] = periodStart.split('-').map((x) => parseInt(x, 10));
      const weekStartDate = new Date(Date.UTC(py, pm - 1, pd, 0, 0, 0));
      const payload = await buildDigestForUser({ user, tenant, periodStart, weekStartDate });
      return res.json(payload);
    } catch (err) {
      console.error('Error building weekly digest preview:', err);
      return res.status(500).json({ error: 'Failed to build preview' });
    }
  });

  app.post("/api/tenants/:id/weekly-digest/test-send", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id: tenantId } = req.params;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { tenantLocalWeekStart, sendDigestForUser } = await import('./services/weekly-digest');
      const tz = tenant.weeklyDigestTimezone || 'America/Los_Angeles';
      const periodStart = tenantLocalWeekStart(tz);
      const [py, pm, pd] = periodStart.split('-').map((x) => parseInt(x, 10));
      const weekStartDate = new Date(Date.UTC(py, pm - 1, pd, 0, 0, 0));
      const result = await sendDigestForUser({ user, tenant, periodStart, weekStartDate, force: true });
      return res.json(result);
    } catch (err) {
      console.error('Error sending weekly digest test email:', err);
      return res.status(500).json({ error: 'Failed to send test digest' });
    }
  });

  // Per-user weekly digest opt-in toggle
  app.patch("/api/me/notif-pref/weekly-digest", requireAuth, loadCurrentUser, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const enabled = !!req.body?.enabled;
      const updated = await storage.updateUser(req.user.id, { notifPrefWeeklyDigest: enabled } as any);
      return res.json({ enabled: updated.notifPrefWeeklyDigest });
    } catch (err) {
      console.error('Error updating weekly digest pref:', err);
      return res.status(500).json({ error: 'Failed to update preference' });
    }
  });

  // Galaxy Portal: 30-day distinct authenticated user count
  app.get("/api/tenants/:id/galaxy-portal/stats", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      if (!canAccessAny && id !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const distinctUsers = await storage.getPortalAuthCount(id, since);
      res.json({ windowDays: 30, distinctUsers });
    } catch (error) {
      console.error("Error fetching Galaxy portal stats:", error);
      res.status(500).json({ error: "Failed to fetch Galaxy portal stats" });
    }
  });

  // Galaxy Portal: audit log viewer
  app.get("/api/tenants/:id/portal-audit", ...adminWithOptionalTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      if (!canAccessAny && id !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Platform admins may pass any tenant id; verify it exists.
      if (canAccessAny) {
        const tenant = await storage.getTenantById(id);
        if (!tenant) {
          return res.status(404).json({ error: "Tenant not found" });
        }
      }

      const { startDate, endDate, statusCode, statusClass, galaxyUserId, userId, limit } = req.query as Record<string, string | undefined>;
      const filters: Parameters<typeof storage.getPortalAuditLogs>[1] = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) filters.startDate = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) filters.endDate = d;
      }
      if (statusCode) {
        const n = parseInt(statusCode, 10);
        if (!isNaN(n)) filters.statusCode = n;
      }
      if (statusClass && ['2xx', '3xx', '4xx', '5xx'].includes(statusClass)) {
        filters.statusClass = statusClass as '2xx' | '3xx' | '4xx' | '5xx';
      }
      if (galaxyUserId) filters.galaxyUserId = galaxyUserId;
      if (userId) filters.userId = userId;
      if (limit) {
        const n = parseInt(limit, 10);
        if (!isNaN(n)) filters.limit = n;
      }

      const logs = await storage.getPortalAuditLogs(id, filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching portal audit logs:", error);
      res.status(500).json({ error: "Failed to fetch portal audit logs" });
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

  // Get license quota for a tenant (tenant admins can view their own, platform admins can view any)
  app.get("/api/tenants/:id/license-quota", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Tenant admins can only view their own tenant
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      
      if (!canAccessAny && id !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const quota = await storage.getTenantLicenseQuota(id);
      const counts = await storage.getTenantLicenseCounts(id);
      
      res.json({
        ...quota,
        adminCount: counts.adminCount,
        totalUsers: counts.totalUsers
      });
    } catch (error) {
      console.error("Error fetching license quota:", error);
      res.status(500).json({ error: "Failed to fetch license quota" });
    }
  });

  // Vocabulary endpoints
  // Get effective vocabulary for current tenant (any authenticated user)
  // Note: Uses auth-only since vocabulary is needed before tenant context is established
  app.get("/api/vocabulary", requireAuth, loadCurrentUser, async (req: Request, res: Response) => {
    try {
      // First try header tenant, then user's assigned tenant
      const tenantId = (req.headers['x-tenant-id'] as string) || req.user?.tenantId || null;
      const vocabulary = await storage.getEffectiveVocabulary(tenantId);
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

  // Get tenant members for user selection (any authenticated user in the tenant)
  // Returns minimal user info for assignment dropdowns (id, email, displayName)
  // Tenant admin alerts (e.g., objective hierarchy depth cap fired)
  app.get("/api/tenant/admin-alerts", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId || req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "No tenant context available" });
      }
      const includeAck = req.query.includeAcknowledged === 'true';
      const alerts = await storage.getAdminAlertsByTenantId(tenantId, includeAck);
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch admin alerts:", error);
      res.status(500).json({ error: "Failed to fetch admin alerts" });
    }
  });

  app.post("/api/tenant/admin-alerts/:id/acknowledge", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId || req.user?.tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "No tenant context available" });
      }
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const alert = await storage.acknowledgeAdminAlert(req.params.id, tenantId, userId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Failed to acknowledge admin alert:", error);
      res.status(500).json({ error: "Failed to acknowledge admin alert" });
    }
  });

  app.get("/api/tenant-members", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "No tenant context available" });
      }

      const users = await storage.getAllUsers(tenantId);
      // Return minimal info for assignment purposes (no passwords, no sensitive data)
      const members = users.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.name || user.email.split('@')[0],
        role: user.role,
      }));
      res.json(members);
    } catch (error) {
      console.error("Error fetching tenant members:", error);
      res.status(500).json({ error: "Failed to fetch tenant members" });
    }
  });

  // Search users within tenant for assignment (any authenticated user)
  app.get("/api/users/search", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "No tenant context available" });
      }

      // Exact email lookup (used for fetching recent selections)
      const emailsParam = req.query.emails as string | undefined;
      if (emailsParam) {
        const emails = emailsParam.split(",").map(e => e.trim()).filter(Boolean).slice(0, 50);
        const users = await storage.getUsersByEmails(tenantId, emails);
        return res.json(users.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role,
        })));
      }

      const query = (req.query.q as string || "").trim().toLowerCase();
      const parsedLimit = parseInt(req.query.limit as string);
      const limit = Math.max(1, Math.min(parsedLimit || 20, 50));

      const users = await storage.searchUsers(tenantId, query, limit);
      const results = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
      }));

      res.json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
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
      
      if (!allowedRoles.includes(role as Role)) {
        return res.status(400).json({ 
          error: "Invalid role for user type",
          message: `Users with type '${userType}' can only have roles: ${allowedRoles.join(', ')}`
        });
      }
      
      // Tenant admins can only create users in their own tenant
      const callerRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(callerRole as any);
      
      // Tenant admins can only assign tenant_user or tenant_admin roles
      // They cannot create consultant, global_admin, or vega_admin users
      if (!canAccessAny) {
        const tenantAdminAssignableRoles = [ROLES.TENANT_USER, ROLES.TENANT_ADMIN, ROLES.ADMIN];
        if (!tenantAdminAssignableRoles.includes(role as any)) {
          return res.status(403).json({ 
            error: "Insufficient permissions",
            message: "Tenant administrators can only create User or Admin roles within their organization"
          });
        }
        
        // Tenant admins cannot create consultant or internal users
        if (userType !== USER_TYPES.CLIENT) {
          return res.status(403).json({
            error: "Insufficient permissions", 
            message: "Only platform administrators can create consultant or internal users"
          });
        }
      }
      
      if (!canAccessAny && validatedData.tenantId && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot create users in other tenants" });
      }
      
      // License quota enforcement for new users
      const licenseType = (validatedData as any).licenseType || 'read_write';
      const adminRolesForLicense = ['tenant_admin', 'admin'];
      const isAdmin = adminRolesForLicense.includes(role);
      const needsReadWriteLicense = licenseType === 'read_write' || isAdmin;
      
      if (needsReadWriteLicense && validatedData.tenantId) {
        const canAssign = await storage.canAssignReadWriteLicense(validatedData.tenantId);
        if (!canAssign) {
          const quota = await storage.getTenantLicenseQuota(validatedData.tenantId);
          return res.status(403).json({ 
            error: "License quota exceeded",
            message: `Your organization has reached its limit of ${quota.maxReadWriteUsers} read-write licenses. Please upgrade your plan or create this user with a read-only license.`,
            quota: {
              maxReadWriteUsers: quota.maxReadWriteUsers,
              currentReadWrite: quota.currentReadWrite,
              availableReadWrite: quota.availableReadWrite
            }
          });
        }
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
      
      if (!allowedRoles.includes(newRole as Role)) {
        return res.status(400).json({ 
          error: "Invalid role for user type",
          message: `Users with type '${newUserType}' can only have roles: ${allowedRoles.join(', ')}`
        });
      }
      
      // Tenant admins can only assign tenant_user or tenant_admin roles within their tenant
      // They cannot promote users to consultant, global_admin, or vega_admin roles
      if (!canAccessAny && validatedData.role) {
        const tenantAdminAssignableRoles = [ROLES.TENANT_USER, ROLES.TENANT_ADMIN, ROLES.ADMIN];
        if (!tenantAdminAssignableRoles.includes(validatedData.role as any)) {
          return res.status(403).json({ 
            error: "Insufficient permissions",
            message: "Tenant administrators can only assign User or Admin roles within their organization"
          });
        }
      }
      
      // Tenant admins cannot change user type to consultant or internal
      if (!canAccessAny && (validatedData as any).userType) {
        if ((validatedData as any).userType !== USER_TYPES.CLIENT) {
          return res.status(403).json({
            error: "Insufficient permissions", 
            message: "Only platform administrators can create consultant or internal users"
          });
        }
      }
      
      // Prevent non-platform admins from moving users to other tenants
      if (!canAccessAny && validatedData.tenantId && validatedData.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Cannot move users to other tenants" });
      }
      
      // License quota enforcement: check if changing to read-write license or admin role
      const currentLicenseType = targetUser.licenseType || 'read_write';
      const newLicenseType = (validatedData as any).licenseType ?? currentLicenseType;
      const isCurrentlyReadOnly = currentLicenseType === 'read_only';
      const isChangingToReadWrite = newLicenseType === 'read_write' && isCurrentlyReadOnly;
      
      // Admin roles always consume read-write licenses
      const adminRolesForLicense = ['tenant_admin', 'admin'];
      const currentIsAdmin = adminRolesForLicense.includes(targetUser.role);
      const newIsAdmin = adminRolesForLicense.includes(newRole);
      const isBecomingAdmin = newIsAdmin && !currentIsAdmin;
      
      // Check quota if user is gaining read-write access (either by license change or becoming admin)
      if ((isChangingToReadWrite || isBecomingAdmin) && targetUser.tenantId) {
        const canAssign = await storage.canAssignReadWriteLicense(targetUser.tenantId);
        if (!canAssign) {
          const quota = await storage.getTenantLicenseQuota(targetUser.tenantId);
          return res.status(403).json({ 
            error: "License quota exceeded",
            message: `Your organization has reached its limit of ${quota.maxReadWriteUsers} read-write licenses. Please contact your administrator to add more licenses or downgrade another user to read-only.`,
            quota: {
              maxReadWriteUsers: quota.maxReadWriteUsers,
              currentReadWrite: quota.currentReadWrite,
              availableReadWrite: quota.availableReadWrite
            }
          });
        }
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

  // ============================================
  // Bulk Reassignment - Get owned items for a user
  // ============================================
  app.get("/api/users/:id/owned-items", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = canAccessAny ? targetUser.tenantId : req.effectiveTenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      if (!canAccessAny && targetUser.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const result = await storage.getOwnedItemsByUser(tenantId, id);
      res.json(result);
    } catch (error) {
      console.error("Error fetching owned items:", error);
      res.status(500).json({ error: "Failed to fetch owned items" });
    }
  });

  // ============================================
  // Bulk Reassignment - Execute the reassignment
  // ============================================
  const reassignBodySchema = z.object({
    fromUserId: z.string().min(1),
    toUserId: z.string().min(1),
    notes: z.string().max(2000).optional(),
    keepOriginalAsCoOwner: z.boolean().optional(),
    entityIds: z
      .object({
        objectivesPrimary: z.array(z.string()).optional(),
        objectivesCoOwner: z.array(z.string()).optional(),
        objectivesCheckIn: z.array(z.string()).optional(),
        keyResults: z.array(z.string()).optional(),
        bigRocksOwner: z.array(z.string()).optional(),
        bigRocksAccountable: z.array(z.string()).optional(),
        ambitions: z.array(z.string()).optional(),
        strategies: z.array(z.string()).optional(),
        meetingsFacilitator: z.array(z.string()).optional(),
        meetingsAttendee: z.array(z.string()).optional(),
        supportTickets: z.array(z.string()).optional(),
      })
      .optional(),
  });

  app.post("/api/users/reassign", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const parsed = reassignBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const { fromUserId, toUserId, notes, keepOriginalAsCoOwner, entityIds } = parsed.data;

      if (fromUserId === toUserId) {
        return res.status(400).json({ error: "Source and destination users must be different" });
      }

      const [fromUser, toUser] = await Promise.all([
        storage.getUser(fromUserId),
        storage.getUser(toUserId),
      ]);

      if (!fromUser || !toUser) {
        return res.status(404).json({ error: "One or both users not found" });
      }

      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);

      // Both users must be in the same tenant
      if (fromUser.tenantId !== toUser.tenantId || !fromUser.tenantId) {
        return res.status(400).json({ error: "Both users must belong to the same tenant" });
      }

      const tenantId = fromUser.tenantId;
      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const performer = req.user!;
      let counts;
      try {
        const result = await storage.reassignOwnership({
          tenantId,
          fromUserId,
          fromUserEmail: fromUser.email,
          fromUserName: fromUser.name,
          toUserId,
          toUserEmail: toUser.email,
          toUserName: toUser.name,
          performedById: performer.id,
          performedByEmail: performer.email,
          performedByName: performer.name ?? null,
          notes: notes ?? null,
          keepOriginalAsCoOwner: keepOriginalAsCoOwner ?? false,
          selection: entityIds,
        });
        counts = result.counts;
      } catch (txError: any) {
        console.error("Reassignment transaction failed:", txError);
        await storage.createReassignmentAuditLog({
          tenantId,
          fromUserId,
          fromUserEmail: fromUser.email,
          fromUserName: fromUser.name,
          toUserId,
          toUserEmail: toUser.email,
          toUserName: toUser.name,
          performedById: performer.id,
          performedByEmail: performer.email,
          performedByName: performer.name ?? null,
          counts: {
            objectivesPrimary: 0, objectivesCoOwner: 0, objectivesCheckIn: 0,
            keyResults: 0, bigRocksOwner: 0, bigRocksAccountable: 0,
            ambitions: 0, strategies: 0, meetingsFacilitator: 0,
            meetingsAttendee: 0, supportTickets: 0, total: 0,
          },
          notes: notes ?? null,
          status: 'failed',
          errorMessage: txError?.message ?? String(txError),
        });
        return res.status(500).json({ error: "Reassignment failed", message: txError?.message });
      }

      // Audit log was created INSIDE the transaction by reassignOwnership() so it
      // shares the same atomic boundary as the data changes. No second insert here.

      // In-app notifications
      const summaryMessage = counts.total === 0
        ? `No items needed to be reassigned from ${fromUser.name || fromUser.email}.`
        : `${counts.total} item${counts.total === 1 ? '' : 's'} ${counts.total === 1 ? 'was' : 'were'} reassigned from ${fromUser.name || fromUser.email}.`;

      try {
        await storage.createNotification({
          tenantId,
          userId: toUserId,
          type: 'reassignment_received',
          title: 'Items reassigned to you',
          body: summaryMessage,
          linkUrl: '/dashboard',
        });
        if (fromUser.id !== performer.id) {
          await storage.createNotification({
            tenantId,
            userId: fromUserId,
            type: 'reassignment_performed',
            title: 'Your items were reassigned',
            body: `${counts.total} of your item${counts.total === 1 ? '' : 's'} ${counts.total === 1 ? 'was' : 'were'} reassigned to ${toUser.name || toUser.email}.`,
            linkUrl: '/dashboard',
          });
        }
      } catch (notifError) {
        console.error("Failed to create notifications:", notifError);
      }

      // Email notifications (best-effort)
      const emailPromises: Promise<any>[] = [];
      if (counts.total > 0) {
        emailPromises.push(
          sendReassignmentEmail(toUser.email, toUser.name ?? '', {
            role: 'recipient',
            fromUserName: fromUser.name ?? '',
            fromUserEmail: fromUser.email,
            toUserName: toUser.name ?? '',
            toUserEmail: toUser.email,
            performedByName: performer.name ?? performer.email,
            counts,
          }).catch(err => console.error("Failed to email recipient:", err))
        );
        if (fromUser.id !== performer.id) {
          emailPromises.push(
            sendReassignmentEmail(fromUser.email, fromUser.name ?? '', {
              role: 'previous-owner',
              fromUserName: fromUser.name ?? '',
              fromUserEmail: fromUser.email,
              toUserName: toUser.name ?? '',
              toUserEmail: toUser.email,
              performedByName: performer.name ?? performer.email,
              counts,
            }).catch(err => console.error("Failed to email previous owner:", err))
          );
        }
      }
      // Don't block on emails
      Promise.allSettled(emailPromises);

      res.json({ success: true, counts });
    } catch (error) {
      console.error("Error performing reassignment:", error);
      res.status(500).json({ error: "Failed to reassign ownership" });
    }
  });

  // ============================================
  // Reassignment Audit Logs
  // ============================================
  app.get("/api/reassignment-audit-logs", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantQuery = req.query.tenantId as string | undefined;
      const tenantId = canAccessAny && tenantQuery ? tenantQuery : req.effectiveTenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;
      const logs = await storage.getReassignmentAuditLogs(tenantId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ============================================
  // Notifications
  // ============================================
  app.get("/api/notifications", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;
      const items = await storage.getNotificationsForUser(userId, { unreadOnly, limit });
      res.json(items);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const notif = await storage.markNotificationRead(req.params.id, userId);
      if (!notif) return res.status(404).json({ error: "Notification not found" });
      res.json(notif);
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.post("/api/notifications/mark-all-read", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const count = await storage.markAllNotificationsRead(userId);
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to update notifications" });
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
        // Return empty foundation for new tenants instead of 404
        return res.json({
          id: null,
          tenantId,
          mission: "",
          vision: "",
          values: [],
          annualGoals: [],
          tagline: "",
          companySummary: "",
          messagingStatement: "",
          cultureStatement: "",
          brandVoice: "",
          fiscalYearStartMonth: 1,
        });
      }
      
      // Backfill missing years in annualGoals for legacy data
      // Goals without years are assigned the previous year
      const currentYear = new Date().getFullYear();
      const defaultYear = currentYear - 1;
      
      if (foundation.annualGoals && Array.isArray(foundation.annualGoals)) {
        const migratedGoals = foundation.annualGoals.map((goal: any) => {
          if (typeof goal === 'string') {
            // Legacy string format - convert to object with default year
            return { title: goal, year: defaultYear, description: '' };
          }
          if (!goal.year || typeof goal.year !== 'number' || goal.year < 2000 || goal.year > 2100) {
            // Missing or invalid year - assign default
            return { ...goal, year: defaultYear };
          }
          return goal;
        });
        
        // Return foundation with migrated goals
        return res.json({
          ...foundation,
          annualGoals: migratedGoals
        });
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
      await storage.deleteStrategy(id, req.user?.id);
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

  app.post("/api/okrs", ...authWithTenant, requireReadWriteLicense, async (req: Request, res: Response) => {
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

  app.patch("/api/okrs/:id", ...authWithTenant, requireReadWriteLicense, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertOkrSchema.partial().parse(req.body);
      const previous = await storage.getOkrById(id);
      const okr = await storage.updateOkr(id, validatedData);
      if (!okr) {
        return res.status(404).json({ error: "OKR not found" });
      }

      try {
        if (
          validatedData.assignedTo &&
          previous &&
          validatedData.assignedTo !== previous.assignedTo
        ) {
          const assignee = await storage.getUserByEmail(validatedData.assignedTo);
          if (assignee) {
            const { createNotification } = await import('./services/notification-service');
            await createNotification({
              tenantId: assignee.tenantId || okr.tenantId,
              userId: assignee.id,
              type: 'assigned',
              title: `Assigned to OKR: ${okr.objective}`,
              body: `Q${okr.quarter ?? ''} ${okr.year ?? ''}`.trim(),
              entityType: 'okr',
              entityId: okr.id,
              linkUrl: `/strategy`,
            });
          }
        }
      } catch (notifyErr) {
        console.error('Failed to create assignment notification:', notifyErr);
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

      // Tenant isolation: only users from the meeting's tenant may read it,
      // unless they have a cross-tenant admin/consultant role.
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);
      if (!canAccessAny && meeting.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
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
      
      // Fetch existing meeting to check ownership
      const existingMeeting = await storage.getMeetingById(id);
      if (!existingMeeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      // Tenant isolation: a user with broad update permission in one tenant must
      // not be able to modify a meeting in another tenant. Cross-tenant roles bypass.
      const crossTenantRoles: string[] = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT];
      const userRoleStr = req.user?.role as string;
      const isCrossTenant = crossTenantRoles.includes(userRoleStr);
      if (!isCrossTenant && existingMeeting.tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // RBAC: Check if user can modify this meeting
      // Users with UPDATE_ANY_OKR can edit any meeting, others must be facilitator or attendee
      const userRole = req.user?.role as Role;
      const hasUpdateAnyPermission = hasPermission(userRole, PERMISSIONS.UPDATE_ANY_OKR);
      const isFacilitator = existingMeeting.facilitator && 
        (existingMeeting.facilitator === req.user?.email || 
         existingMeeting.facilitator === req.user?.name);
      const isAttendee = existingMeeting.attendees?.includes(req.user?.email || '');
      
      if (!hasUpdateAnyPermission && !isFacilitator && !isAttendee) {
        return res.status(403).json({ 
          error: "Access denied",
          message: "You can only edit meetings you facilitate or attend."
        });
      }
      
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      const dataToUpdate = {
        ...validatedData,
        date: validatedData.date ? new Date(validatedData.date) : undefined,
        nextMeetingDate: validatedData.nextMeetingDate ? new Date(validatedData.nextMeetingDate) : undefined,
      };
      const meeting = await storage.updateMeeting(id, dataToUpdate);
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

  // Meeting Prep AI endpoint
  app.get("/api/meetings/:id/prep", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = req.effectiveTenantId;
      
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }
      
      // Import and execute the meeting prep tool
      const { executeGenerateMeetingPrep, generateMeetingPrepParams } = await import('./ai-tools');
      
      const result = await executeGenerateMeetingPrep(tenantId, generateMeetingPrepParams.parse({ meetingId: id }));
      res.json(result);
    } catch (error: any) {
      console.error("Error generating meeting prep:", error);
      if (error.message === "Meeting not found") {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.status(500).json({ error: "Failed to generate meeting prep" });
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

  // ============================================================================
  // Trash / Soft-delete recovery routes (admin/owner only)
  // ============================================================================

  // List soft-deleted items for the current tenant
  app.get("/api/trash", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role as string;
      const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = req.effectiveTenantId
        || (isPlatformAdmin ? (req.headers['x-tenant-id'] as string | undefined) : undefined);

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      const items = await storage.getTrashItemsByTenantId(tenantId);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching trash:", error);
      res.status(500).json({ error: "Failed to fetch trash items" });
    }
  });

  // Restore a soft-deleted item by type and id
  app.post("/api/trash/:type/:id/restore", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const userRole = req.user?.role as string;
      const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = req.effectiveTenantId
        || (isPlatformAdmin ? (req.headers['x-tenant-id'] as string | undefined) : undefined);

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      // All restore methods are tenant-scoped: they fetch and authorize the row
      // BEFORE any mutation. They return undefined if the item doesn't exist or
      // belongs to a different tenant — preventing cross-tenant data modification.
      let restored: Objective | KeyResult | BigRock | Strategy | Ambition | undefined;

      if (type === 'objective') {
        restored = await storage.restoreObjective(id, tenantId);
      } else if (type === 'keyResult' || type === 'key-result') {
        restored = await storage.restoreKeyResult(id, tenantId);
      } else if (type === 'bigRock' || type === 'big-rock') {
        restored = await storage.restoreBigRock(id, tenantId);
      } else if (type === 'strategy') {
        restored = await storage.restoreStrategy(id, tenantId);
      } else if (type === 'ambition') {
        restored = await storage.restoreAmbition(tenantId, id);
      } else {
        return res.status(400).json({ error: "Unknown trash item type" });
      }

      if (!restored) {
        // Could be: not in trash, not found, or belongs to a different tenant.
        // We don't disclose which to avoid leaking existence of cross-tenant rows.
        return res.status(404).json({ error: "Item not found in trash" });
      }

      res.json({ success: true, item: restored });
    } catch (error: any) {
      console.error("Error restoring trash item:", error);
      res.status(500).json({ error: "Failed to restore item" });
    }
  });

  // Soft-delete an ambition (stored in foundation JSONB)
  app.delete("/api/foundations/:tenantId/ambitions/:ambitionId", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { tenantId, ambitionId } = req.params;
      const userRole = req.user?.role as string;
      const canAccessAny = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT].includes(userRole as any);

      if (!canAccessAny && tenantId !== req.effectiveTenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.softDeleteAmbition(tenantId, ambitionId, req.user?.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting ambition:", error);
      res.status(500).json({ error: "Failed to delete ambition" });
    }
  });

  // Import and use enhanced OKR routes (with auth + tenant isolation)
  const { okrRouter } = await import("./routes-okr");
  app.use("/api/okr", ...authWithTenant, okrRouter);

  // Combined dashboard context endpoint (single round trip for dashboards)
  const { dashboardRouter } = await import("./routes-dashboard");
  app.use("/api/dashboard", ...authWithTenant, dashboardRouter);

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

  // Import and use Export routes (Company OS document export)
  const exportRouter = await import("./routes-export");
  app.use("/api/export", ...authWithTenant, exportRouter.default);

  // Import and use Jobs routes (Scheduled Jobs management)
  const { jobsRouter } = await import("./routes-jobs");
  app.use("/api/jobs", ...authWithTenant, jobsRouter);

  // Import and use Support routes (Help & Support Ticket System)
  const { supportRouter } = await import("./routes-support");
  app.use("/api/support", supportRouter);

  const { notificationsRouter } = await import("./routes-notifications");
  app.use("/api/notifications", notificationsRouter);

  // ============================================
  // GLOBAL CROSS-ENTITY SEARCH
  // ============================================

  // GET /api/search?q=...&types=objective,key_result,...&limit=8
  // Returns ranked results across all entity types in the user's tenant.
  app.get("/api/search", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId;
      if (!tenantId) return res.status(400).json({ error: "Tenant context required" });

      const q = typeof req.query.q === "string" ? req.query.q : "";
      if (!q.trim()) {
        return res.json({ query: "", total: 0, results: [] });
      }
      if (q.length > 200) {
        return res.status(400).json({ error: "Query too long" });
      }

      const typesParam = typeof req.query.types === "string" ? req.query.types : "";
      // Accept short aliases (kr, rock) and singular/plural forms; normalize
      // to the canonical SEARCH_ENTITY_TYPES values used by storage.
      const TYPE_ALIASES: Record<string, string> = {
        kr: "key_result",
        keyresult: "key_result",
        keyresults: "key_result",
        key_results: "key_result",
        rock: "big_rock",
        rocks: "big_rock",
        bigrock: "big_rock",
        bigrocks: "big_rock",
        big_rocks: "big_rock",
        objectives: "objective",
        strategies: "strategy",
        ambitions: "ambition",
        teams: "team",
        meetings: "meeting",
        tickets: "ticket",
        documents: "document",
      };
      const ALLOWED_TYPES = new Set([
        "objective",
        "key_result",
        "big_rock",
        "strategy",
        "ambition",
        "team",
        "meeting",
        "ticket",
        "document",
      ]);
      const types = typesParam
        ? typesParam
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .map((t) => TYPE_ALIASES[t] ?? t)
            .filter((t) => ALLOWED_TYPES.has(t))
        : undefined;
      const limit = Math.min(parseInt(String(req.query.limit ?? "8"), 10) || 8, 15);

      const userRole = req.user!.role as Role;
      // Match existing per-entity read-route authorization exactly so that
      // global search never reveals entities a user couldn't fetch directly.
      // Support tickets: only vega_admin / vega_consultant can see all
      // tickets in a tenant (see server/routes-support.ts isAdminRole).
      // Tenant admins / regular users only see their own tickets.
      const isSupportAdmin =
        userRole === ROLES.VEGA_ADMIN || userRole === ROLES.VEGA_CONSULTANT;
      // Grounding documents are gated by the MANAGE_AI_GROUNDING permission,
      // matching the existing AI grounding admin endpoints.
      const canSeeGroundingDocs = hasPermission(userRole, PERMISSIONS.MANAGE_AI_GROUNDING);

      const results = await storage.searchAcrossEntities(tenantId, q, {
        types,
        limit,
        userId: req.user!.id,
        isSupportAdmin,
        canSeeGroundingDocs,
      });

      res.json({ query: q, total: results.length, results });
    } catch (error) {
      console.error("Error performing global search:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // POST /api/search/telemetry - lightweight event tracking for search analytics.
  // Events: 'query' | 'result_clicked' | 'no_results'
  app.post("/api/search/telemetry", ...authWithTenant, async (req: Request, res: Response) => {
    try {
      const { event, query, resultType, totalResults } = req.body ?? {};
      const validEvents = ["query", "result_clicked", "no_results"];
      if (!event || !validEvents.includes(event)) {
        return res.status(400).json({ error: "Invalid event" });
      }
      // Best-effort logging — keep payloads small. Queries are truncated and tenant-scoped.
      const safeQuery = typeof query === "string" ? query.slice(0, 200) : "";
      console.log(
        `[search-telemetry] tenant=${req.effectiveTenantId} user=${req.user?.id} event=${event} ` +
          `q="${safeQuery}" resultType=${resultType ?? "-"} total=${totalResults ?? "-"}`
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("Error recording search telemetry:", error);
      res.status(500).json({ error: "Failed to record telemetry" });
    }
  });

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

  // ============================================
  // AI CONFIGURATION (Vega Admin only)
  // ============================================

  // Get current AI configuration
  app.get("/api/admin/ai-config", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const config = await storage.getAiConfiguration();
      // Return default values if no configuration exists
      res.json(config || {
        activeProvider: 'replit_ai',
        activeModel: 'gpt-4o',
        enableStreaming: true,
        enableFunctionCalling: true,
        maxTokensPerRequest: 4000,
        monthlyTokenBudget: null,
        providerConfig: null
      });
    } catch (error) {
      console.error("Error fetching AI configuration:", error);
      res.status(500).json({ error: "Failed to fetch AI configuration" });
    }
  });

  // Update AI configuration
  app.patch("/api/admin/ai-config", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { 
        activeProvider, 
        activeModel, 
        providerConfig,
        enableStreaming,
        enableFunctionCalling,
        maxTokensPerRequest,
        monthlyTokenBudget
      } = req.body;
      
      const config = await storage.updateAiConfiguration({
        activeProvider,
        activeModel,
        providerConfig,
        enableStreaming,
        enableFunctionCalling,
        maxTokensPerRequest,
        monthlyTokenBudget
      }, req.user!.id);
      
      // Clear the AI config cache so changes take effect immediately
      const { clearAiConfigCache } = await import('./ai');
      clearAiConfigCache();
      
      res.json(config);
    } catch (error) {
      console.error("Error updating AI configuration:", error);
      res.status(500).json({ error: "Failed to update AI configuration" });
    }
  });

  // Get available AI providers and models
  app.get("/api/admin/ai-config/options", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { AI_MODELS, AI_MODEL_INFO, AI_PROVIDERS } = await import('@shared/schema');
      // Flatten all models into a single array (removing duplicates)
      const allModels = [...new Set(Object.values(AI_MODELS).flat())];
      
      // Check provider readiness (only return boolean status, not secret details)
      const providerStatus: Record<string, boolean> = {
        replit_ai: true, // Always available via Replit integration
        openai: !!process.env.OPENAI_API_KEY,
        azure_openai: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
        anthropic: !!process.env.ANTHROPIC_API_KEY,
      };
      
      res.json({
        providers: Object.entries(AI_PROVIDERS).map(([key, value]) => ({
          id: value,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        })),
        models: allModels,
        modelInfo: AI_MODEL_INFO,
        providerStatus, // Simple boolean: is provider ready to use?
      });
    } catch (error) {
      console.error("Error fetching AI options:", error);
      res.status(500).json({ error: "Failed to fetch AI options" });
    }
  });

  // ============================================
  // SYSTEM BANNERS (Vega Admin only)
  // ============================================

  // Get active banner (public - for display on homepage/dashboard)
  app.get("/api/banners/active", async (req: Request, res: Response) => {
    try {
      const banner = await storage.getActiveBanner();
      res.json(banner || null);
    } catch (error) {
      console.error("Error fetching active banner:", error);
      res.status(500).json({ error: "Failed to fetch active banner" });
    }
  });

  // Get all banners (platform admin only)
  app.get("/api/admin/banners", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const banners = await storage.getAllBanners();
      res.json(banners);
    } catch (error) {
      console.error("Error fetching banners:", error);
      res.status(500).json({ error: "Failed to fetch banners" });
    }
  });

  // Create a banner (platform admin only)
  app.post("/api/admin/banners", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { content, linkUrl, linkText, status, scheduledStart, scheduledEnd, backgroundColor, textColor } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      const banner = await storage.createBanner({
        content,
        linkUrl,
        linkText,
        status: status || 'off',
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        backgroundColor,
        textColor,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      });
      res.status(201).json(banner);
    } catch (error) {
      console.error("Error creating banner:", error);
      res.status(500).json({ error: "Failed to create banner" });
    }
  });

  // Update a banner (platform admin only)
  app.patch("/api/admin/banners/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content, linkUrl, linkText, status, scheduledStart, scheduledEnd, backgroundColor, textColor } = req.body;
      
      const existing = await storage.getBannerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Banner not found" });
      }
      
      const banner = await storage.updateBanner(id, {
        content,
        linkUrl,
        linkText,
        status,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        backgroundColor,
        textColor,
        updatedBy: req.user!.id,
      });
      res.json(banner);
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ error: "Failed to update banner" });
    }
  });

  // Delete a banner (platform admin only)
  app.delete("/api/admin/banners/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await storage.getBannerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Banner not found" });
      }
      await storage.deleteBanner(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ error: "Failed to delete banner" });
    }
  });

  // ============================================
  // SEO CONFIG
  // ============================================

  // Serve robots.txt (public)
  app.get("/robots.txt", async (req: Request, res: Response) => {
    try {
      const config = await storage.getSeoConfig();
      const canonicalUrl = config?.canonicalUrl || "https://vega.synozur.com";
      const sitemapUrl = `${canonicalUrl}/sitemap.xml`;
      const content = `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /api/\nSitemap: ${sitemapUrl}\n`;
      res.type("text/plain").send(content);
    } catch (error) {
      console.error("Error serving robots.txt:", error);
      res.type("text/plain").send("User-agent: *\nAllow: /\n");
    }
  });

  // Serve sitemap.xml (public)
  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    try {
      const config = await storage.getSeoConfig();
      const baseUrl = config?.canonicalUrl || "https://vega.synozur.com";
      const today = new Date().toISOString().split("T")[0];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;
      res.type("application/xml").send(xml);
    } catch (error) {
      console.error("Error serving sitemap.xml:", error);
      res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
    }
  });

  // Get SEO config (public - used by landing page)
  app.get("/api/seo/config", async (req: Request, res: Response) => {
    try {
      const config = await storage.getSeoConfig();
      res.json(config || {
        title: "Vega - The Synozur Alliance Company OS",
        description: "Vega delivers the ultimate Company Operating System experience with AI-powered foundations, strategy, planning, and focus rhythm modules for modern organizations. Designed by former Microsoft Viva product leadership.",
        ogDescription: "Vega delivers the ultimate Company Operating System experience. Designed by former Microsoft Viva product leadership.",
        keywords: "company operating system, OKR software, strategy execution, AI-powered OKRs, business alignment, leadership cadence, Synozur, Vega",
        canonicalUrl: "https://vega.synozur.com",
      });
    } catch (error) {
      console.error("Error fetching SEO config:", error);
      res.status(500).json({ error: "Failed to fetch SEO config" });
    }
  });

  // Update SEO config (platform admin only)
  app.patch("/api/seo/config", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { title, description, ogDescription, keywords, canonicalUrl } = req.body;
      const config = await storage.updateSeoConfig(
        { title, description, ogDescription, keywords, canonicalUrl },
        req.user!.id
      );
      res.json(config);
    } catch (error) {
      console.error("Error updating SEO config:", error);
      res.status(500).json({ error: "Failed to update SEO config" });
    }
  });

  app.get("/api/landing-settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getLandingPageSettings();
      res.json(settings || { heroMediaType: 'image' });
    } catch (error) {
      console.error("Error fetching landing page settings:", error);
      res.status(500).json({ error: "Failed to fetch landing page settings" });
    }
  });

  // Update landing page settings (platform admin only)
  app.patch("/api/admin/landing-settings", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { heroMediaType } = req.body;
      const settings = await storage.updateLandingPageSettings({
        heroMediaType,
        updatedBy: req.user!.id,
      });
      res.json(settings);
    } catch (error) {
      console.error("Error updating landing page settings:", error);
      res.status(500).json({ error: "Failed to update landing page settings" });
    }
  });

  // ============================================
  // CAPABILITY SHOWCASE SECTION
  // ============================================

  // Get capability section settings (public - for display on homepage)
  app.get("/api/capability-section", async (req: Request, res: Response) => {
    try {
      const section = await storage.getCapabilitySection();
      res.json(section || { enabled: false, headline: 'Explore Vega Capabilities', subHeadline: 'Discover how Vega transforms strategy into weekly action' });
    } catch (error) {
      console.error("Error fetching capability section:", error);
      res.status(500).json({ error: "Failed to fetch capability section" });
    }
  });

  // Update capability section settings (platform admin only)
  app.patch("/api/admin/capability-section", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { enabled, headline, subHeadline } = req.body;
      const section = await storage.updateCapabilitySection({
        enabled,
        headline,
        subHeadline,
        updatedBy: req.user!.id,
      });
      res.json(section);
    } catch (error) {
      console.error("Error updating capability section:", error);
      res.status(500).json({ error: "Failed to update capability section" });
    }
  });

  // Get all capability tabs (public - for display on homepage)
  app.get("/api/capability-tabs", async (req: Request, res: Response) => {
    try {
      const tabs = await storage.getCapabilityTabs();
      res.json(tabs);
    } catch (error) {
      console.error("Error fetching capability tabs:", error);
      res.status(500).json({ error: "Failed to fetch capability tabs" });
    }
  });

  // Create capability tab (platform admin only)
  app.post("/api/admin/capability-tabs", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { tabLabel, heading, bodyCopy, primaryImageUrl, secondaryImageUrl, ctaText, ctaUrl, sortOrder } = req.body;
      if (!tabLabel || !heading || !bodyCopy) {
        return res.status(400).json({ error: "Tab label, heading, and body copy are required" });
      }
      const tab = await storage.createCapabilityTab({
        tabLabel,
        heading,
        bodyCopy,
        primaryImageUrl,
        secondaryImageUrl,
        ctaText,
        ctaUrl,
        sortOrder,
      });
      res.json(tab);
    } catch (error) {
      console.error("Error creating capability tab:", error);
      res.status(500).json({ error: "Failed to create capability tab" });
    }
  });

  // Update capability tab (platform admin only)
  app.patch("/api/admin/capability-tabs/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await storage.getCapabilityTabById(id);
      if (!existing) {
        return res.status(404).json({ error: "Capability tab not found" });
      }
      const { tabLabel, heading, bodyCopy, primaryImageUrl, secondaryImageUrl, ctaText, ctaUrl, sortOrder } = req.body;
      const tab = await storage.updateCapabilityTab(id, {
        tabLabel,
        heading,
        bodyCopy,
        primaryImageUrl,
        secondaryImageUrl,
        ctaText,
        ctaUrl,
        sortOrder,
      });
      res.json(tab);
    } catch (error) {
      console.error("Error updating capability tab:", error);
      res.status(500).json({ error: "Failed to update capability tab" });
    }
  });

  // Delete capability tab (platform admin only)
  app.delete("/api/admin/capability-tabs/:id", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await storage.getCapabilityTabById(id);
      if (!existing) {
        return res.status(404).json({ error: "Capability tab not found" });
      }
      await storage.deleteCapabilityTab(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting capability tab:", error);
      res.status(500).json({ error: "Failed to delete capability tab" });
    }
  });

  // Reorder capability tabs (platform admin only)
  app.post("/api/admin/capability-tabs/reorder", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { tabOrders } = req.body;
      if (!Array.isArray(tabOrders)) {
        return res.status(400).json({ error: "tabOrders array is required" });
      }
      await storage.reorderCapabilityTabs(tabOrders);
      const tabs = await storage.getCapabilityTabs();
      res.json(tabs);
    } catch (error) {
      console.error("Error reordering capability tabs:", error);
      res.status(500).json({ error: "Failed to reorder capability tabs" });
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

  // ============================================
  // PAGE VISIT TRACKING
  // ============================================

  // Record a page visit (public - no auth required)
  app.post("/api/track/visit", async (req: Request, res: Response) => {
    try {
      const { page, visitorId } = req.body;
      if (!page) {
        return res.status(400).json({ error: "Page is required" });
      }

      const userAgent = req.get('user-agent') || '';
      const referrer = req.get('referer') || '';
      const forwardedFor = req.get('x-forwarded-for');
      const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip || '';
      
      // Try to get country from Cloudflare header first (fastest)
      let country: string | null = req.get('cf-ipcountry') || null;
      
      // If no Cloudflare header and we have a valid IP, try IP geolocation API
      if (!country && ipAddress && ipAddress !== '::1' && ipAddress !== '127.0.0.1' && !ipAddress.startsWith('192.168.') && !ipAddress.startsWith('10.')) {
        try {
          // Use ip-api.com free service (rate limit: 45 req/min)
          const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}?fields=countryCode`);
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            if (geoData.countryCode) {
              country = geoData.countryCode;
            }
          }
        } catch (geoError) {
          // Silently fail - country will be null/Unknown
        }
      }

      const visit = await storage.recordPageVisit({
        page,
        visitorId: visitorId || null,
        userAgent,
        referrer,
        ipAddress,
        country,
      });

      res.status(201).json({ success: true, id: visit.id });
    } catch (error) {
      console.error("Error recording page visit:", error);
      res.status(500).json({ error: "Failed to record visit" });
    }
  });

  // Get traffic analytics (platform admin only)
  app.get("/api/admin/traffic", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      // Parse dates as Pacific Time to avoid timezone misdating
      // Append T00:00:00 for start of day in Pacific
      const start = startDate ? new Date(`${startDate}T00:00:00-08:00`) : undefined;
      // End date should be end of day in Pacific (23:59:59)
      const end = endDate ? new Date(`${endDate}T23:59:59-08:00`) : undefined;

      const stats = await storage.getPageVisitStats(start, end);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching traffic stats:", error);
      res.status(500).json({ error: "Failed to fetch traffic stats" });
    }
  });

  // Get tenant activity report (platform admin only)
  app.get("/api/admin/tenant-activity", ...platformAdminOnly, async (req: Request, res: Response) => {
    try {
      const windowDays = req.query.windowDays ? parseInt(req.query.windowDays as string, 10) : 30;
      const report = await storage.getTenantActivityReport(windowDays);
      res.json(report);
    } catch (error) {
      console.error("Error fetching tenant activity report:", error);
      res.status(500).json({ error: "Failed to fetch tenant activity report" });
    }
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // ==================== Scheduled Jobs ====================
  
  const { jobScheduler } = await import('./services/job-scheduler');
  
  // In-memory deduplication for reminders (clears daily)
  const sentReminders = new Map<string, Set<number>>(); // tenantId -> Set of daysRemaining already sent
  
  // Register expiration reminders job - runs once daily at 8 AM Pacific
  await jobScheduler.registerJob(
    'expiration-reminders',
    'Plan Expiration Reminders',
    'Sends email reminders to tenant admins before their plan expires (7, 3, 1 days before)',
    'notification',
    'Daily',
    86400000, // 24 hours
    async () => {
      const reminderDays = [7, 3, 1];
      let totalSent = 0;
      const details: any[] = [];
      
      for (const days of reminderDays) {
        try {
          const expiringTenants = await storage.getTenantsWithExpiringPlans(days);
          
          for (const tenant of expiringTenants) {
            const sentForTenant = sentReminders.get(tenant.id) || new Set();
            if (sentForTenant.has(days)) {
              continue;
            }
            
            const plan = tenant.servicePlanId 
              ? await storage.getServicePlanById(tenant.servicePlanId)
              : null;
            
            const tenantUsers = await storage.getAllUsers(tenant.id);
            const admins = tenantUsers.filter((u: { role: string }) => u.role === 'tenant_admin');
            
            if (admins.length === 0) {
              continue;
            }
            
            const expirationDate = tenant.planExpiresAt || new Date();
            const planName = plan?.displayName || 'Trial';
            
            for (const admin of admins) {
              try {
                const { isEmailEnabled, createNotification } = await import('./services/notification-service');
                const emailOk = await isEmailEnabled(admin.id, 'plan_expiration');
                if (emailOk) {
                  await sendPlanExpirationReminderEmail(
                    admin.email,
                    admin.name || admin.email,
                    tenant.name,
                    planName,
                    days,
                    expirationDate
                  );
                }
                await createNotification({
                  tenantId: tenant.id,
                  userId: admin.id,
                  type: 'plan_expiration',
                  title: `${planName} plan expires in ${days} day${days === 1 ? '' : 's'}`,
                  body: `${tenant.name} — expires ${expirationDate.toDateString()}`,
                  entityType: 'tenant',
                  entityId: tenant.id,
                  linkUrl: `/tenant-admin`,
                });
                totalSent++;
                details.push({ tenant: tenant.name, admin: admin.email, days });
              } catch (emailError) {
                console.error(`[Expiration Reminder] Failed to send to ${admin.email}:`, emailError);
              }
            }
            
            sentForTenant.add(days);
            sentReminders.set(tenant.id, sentForTenant);
          }
        } catch (error) {
          console.error(`[Expiration Reminder] Error checking ${days}-day expirations:`, error);
        }
      }
      
      return { 
        summary: totalSent > 0 ? `Sent ${totalSent} expiration reminders` : 'No reminders needed',
        details: { emailsSent: totalSent, reminders: details }
      };
    }
  );
  
  // Register Planner auto-sync job - runs every 4 hours
  await jobScheduler.registerJob(
    'planner-sync',
    'Microsoft Planner Sync',
    'Automatically syncs plans, buckets, and tasks from Microsoft Planner for all connected users',
    'integration',
    'Every 4 hours',
    14400000, // 4 hours
    async () => {
      const { syncAllPlannerData } = await import('./services/graph-planner');
      const { isPlannerConfigured } = await import('./services/planner-auth');
      
      if (!isPlannerConfigured()) {
        return { summary: 'Planner integration not configured (missing credentials)', details: { configured: false } };
      }

      let totalPlans = 0;
      let totalTasks = 0;
      let syncedTenants = 0;
      let failedTenants = 0;
      const details: any[] = [];

      try {
        const tenants = await storage.getAllTenants();

        for (const tenant of tenants) {
          if (!tenant.azureTenantId) {
            console.log(`[PlannerSync] Skipping tenant ${tenant.name} — no Azure Tenant ID configured`);
            continue;
          }
          try {
            const result = await syncAllPlannerData(tenant.id, tenant.azureTenantId);
            totalPlans += result.plans.length;
            totalTasks += result.tasks.length;
            syncedTenants++;
            details.push({
              tenant: tenant.name,
              plans: result.plans.length,
              tasks: result.tasks.length,
            });
          } catch (syncError: any) {
            failedTenants++;
            console.error(`[PlannerSync] Failed for tenant ${tenant.name}:`, syncError.message);
          }
        }
      } catch (error: any) {
        console.error('[PlannerSync] Job error:', error);
      }

      return {
        summary: syncedTenants > 0
          ? `Synced ${totalPlans} plans, ${totalTasks} tasks across ${syncedTenants} organizations`
          : failedTenants > 0
            ? `No successful syncs. ${failedTenants} organizations failed.`
            : 'No organizations with Planner enabled',
        details: { syncedTenants, failedTenants, totalPlans, totalTasks, tenantDetails: details },
      };
    }
  );

  // Register Big Rock ↔ Planner bidirectional task sync (includes assignees) - runs every 2 hours
  await jobScheduler.registerJob(
    'planner-bigrock-task-sync',
    'Planner Big Rock Task Sync',
    'Bidirectionally syncs tasks and assignees between Microsoft Planner and Big Rocks for all mapped Big Rocks with sync enabled',
    'integration',
    'Every 2 hours',
    7200000, // 2 hours
    async () => {
      const { 
        syncPlannerBuckets, 
        syncPlannerTasks, 
        syncPlannerTasksToBigRockTasks,
        calculatePlannerProgress
      } = await import('./services/graph-planner');
      const { isPlannerConfigured } = await import('./services/planner-auth');

      if (!isPlannerConfigured()) {
        return { summary: 'Planner integration not configured (missing credentials)', details: { configured: false } };
      }

      const bigRocksToSync = await storage.getBigRocksWithPlannerSync();
      
      if (bigRocksToSync.length === 0) {
        return { summary: 'No Big Rocks with Planner sync enabled', details: { count: 0 } };
      }

      let synced = 0;
      let failed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      const details: any[] = [];

      for (const bigRock of bigRocksToSync) {
        if (!bigRock.plannerPlanId) continue;

        const plan = await storage.getPlannerPlanById(bigRock.plannerPlanId);
        if (!plan) {
          failed++;
          details.push({ bigRock: bigRock.title, error: 'Mapped plan not found' });
          continue;
        }

        const tenant = await storage.getTenantById(bigRock.tenantId);
        if (!tenant?.azureTenantId) {
          failed++;
          details.push({ bigRock: bigRock.title, error: 'Tenant has no Azure Tenant ID configured' });
          continue;
        }

        try {
          await syncPlannerBuckets(bigRock.tenantId, plan.id, plan.graphPlanId, tenant.azureTenantId);

          await syncPlannerTasks(bigRock.tenantId, plan.id, plan.graphPlanId, tenant.azureTenantId);

          const result = await syncPlannerTasksToBigRockTasks(
            bigRock.id,
            bigRock.tenantId,
            bigRock.plannerPlanId,
            bigRock.plannerBucketId || null,
            tenant.azureTenantId
          );

          // Step 4: Calculate and update progress
          const progress = await calculatePlannerProgress(
            bigRock.plannerPlanId,
            bigRock.plannerBucketId || null,
            bigRock.tenantId
          );

          await storage.updateBigRock(bigRock.id, {
            completionPercentage: Math.round(progress.percentage || 0),
            plannerLastSyncAt: new Date(),
            plannerSyncError: null,
          });

          totalCreated += result.created;
          totalUpdated += result.updated;
          synced++;
          details.push({
            bigRock: bigRock.title,
            tenant: bigRock.tenantId,
            created: result.created,
            updated: result.updated,
            total: result.total,
            progress: Math.round(progress.percentage || 0),
          });
        } catch (syncError: any) {
          failed++;
          const errorMsg = syncError.message || 'Unknown sync error';
          details.push({ bigRock: bigRock.title, error: errorMsg });
          await storage.updateBigRock(bigRock.id, {
            plannerSyncError: `Auto-sync failed: ${errorMsg}`,
          });
          console.error(`[PlannerBigRockSync] Failed for "${bigRock.title}":`, errorMsg);
        }
      }

      return {
        summary: synced > 0
          ? `Synced ${synced} Big Rocks (${totalCreated} tasks created, ${totalUpdated} updated)${failed > 0 ? `, ${failed} failed` : ''}`
          : failed > 0
            ? `All ${failed} Big Rock syncs failed`
            : 'No Big Rocks needed syncing',
        details: { synced, failed, totalCreated, totalUpdated, bigRocks: details },
      };
    }
  );

  // Register Excel auto-sync job - runs every 2 hours
  await jobScheduler.registerJob(
    'excel-auto-sync',
    'Excel Key Result Auto-Sync',
    'Automatically syncs all Excel-linked Key Results for all tenants using stored user tokens',
    'integration',
    'Every 2 hours',
    7200000, // 2 hours
    async () => {
      const { getExcelCellValue } = await import('./microsoftGraph');
      const allKRs = await storage.getAllKeyResults();
      const excelLinkedKRs = allKRs.filter(
        (kr: any) => kr.excelFileId && kr.excelCellReference
      );

      if (excelLinkedKRs.length === 0) {
        return { summary: 'No Excel-linked Key Results found' };
      }

      let synced = 0;
      let skipped = 0;
      let failed = 0;
      const details: any[] = [];

      for (const kr of excelLinkedKRs) {
        // Find a user in the tenant to use as the auth context.
        // Prefer the KR owner, then any tenant user with a graph token.
        let authUserId: string | undefined;
        try {
          const tenantUsers = await storage.getAllUsers(kr.tenantId);
          // Try the KR's ownerEmail first
          if (kr.ownerEmail) {
            const owner = tenantUsers.find((u: any) => u.email === kr.ownerEmail);
            if (owner) authUserId = owner.id;
          }
          // Fall back to any tenant user that has a graph token on record (try all service types)
          if (!authUserId) {
            const tokenServices = ['onedrive', 'sharepoint', 'planner'];
            outer: for (const u of tenantUsers) {
              for (const svc of tokenServices) {
                const tok = await storage.getGraphToken(u.id, svc);
                if (tok?.accessToken) { authUserId = u.id; break outer; }
              }
            }
          }
        } catch (_) {}

        if (!authUserId) {
          skipped++;
          details.push({ kr: kr.title, status: 'skipped', reason: 'No auth user found' });
          continue;
        }

        try {
          const cellRef = kr.excelSheetName
            ? `${kr.excelSheetName}!${kr.excelCellReference}`
            : kr.excelCellReference;

          const cellValue = await getExcelCellValue(
            kr.excelFileId,
            cellRef,
            (kr.excelSourceType as 'onedrive' | 'sharepoint') || 'onedrive',
            undefined,
            kr.excelDriveId || undefined,
            authUserId
          );

          if (cellValue.numberValue !== undefined) {
            const initial = kr.initialValue ?? 0;
            const target = kr.targetValue ?? 100;
            const range = target - initial;
            const updateData: any = {
              excelLastSyncAt: new Date(),
              excelLastSyncValue: cellValue.numberValue,
              excelSyncError: null,
            };

            if (range !== 0) {
              const previousValue = kr.currentValue ?? initial;
              updateData.currentValue = cellValue.numberValue;
              updateData.progress = Math.min(100, Math.max(0, ((cellValue.numberValue - initial) / range) * 100));

              if (cellValue.numberValue !== previousValue) {
                const prevProgress = Math.min(100, Math.max(0, ((previousValue - initial) / range) * 100));
                const newProgress = updateData.progress;
                try {
                  await storage.createCheckIn({
                    tenantId: kr.tenantId,
                    entityType: 'key_result',
                    entityId: kr.id,
                    previousValue,
                    newValue: cellValue.numberValue,
                    previousProgress: prevProgress,
                    newProgress,
                    note: `Auto-synced from Excel: ${kr.excelFileName || 'linked file'}`,
                    userId: authUserId,
                    userEmail: '',
                    asOfDate: new Date() as any,
                  });
                } catch (_) {}
              }
            }

            await storage.updateKeyResult(kr.id, updateData);
            synced++;
            details.push({ kr: kr.title, status: 'synced', value: cellValue.numberValue });
          } else {
            skipped++;
            details.push({ kr: kr.title, status: 'skipped', reason: 'No numeric value in cell' });
          }
        } catch (err: any) {
          failed++;
          const errorMsg = err.message || 'Unknown error';
          const needsRelink = /token|expired|unauthorized|unauthenticated|forbidden|401|403/i.test(errorMsg);
          await storage.updateKeyResult(kr.id, {
            excelLastSyncAt: new Date(),
            excelSyncError: needsRelink
              ? 'Token expired — owner needs to reconnect via the Key Result settings'
              : `Sync failed: ${errorMsg}`,
          });
          details.push({ kr: kr.title, status: 'failed', error: errorMsg, needsRelink });
          console.error(`[ExcelAutoSync] Failed for KR "${kr.title}":`, errorMsg);
        }
      }

      return {
        summary: `Excel sync: ${synced} synced, ${skipped} skipped, ${failed} failed`,
        details: { synced, skipped, failed, keyResults: details },
      };
    }
  );

  // Register daily progress snapshots job - captures one row per active OKR per day.
  // `selfScheduled: true` opts out of the scheduler's default fixed interval; we
  // instead anchor execution to Pacific midnight via startPacificMidnightScheduler()
  // below so the daily run lines up with the Pacific calendar day used as the
  // snapshot key (snapshot_date).
  await jobScheduler.registerJob(
    'daily-progress-snapshots',
    'Daily Progress Snapshots',
    'Captures a daily snapshot of progress and status for every active objective and key result. Provides stable history for forecasts and velocity that is not affected by check-in edits or deletions. Runs at 00:05 Pacific Time daily.',
    'maintenance',
    'Daily @ 00:05 Pacific',
    86400000, // 24 hours (informational; actual schedule is Pacific-anchored)
    async () => {
      const { runDailySnapshotJob } = await import('./services/progress-snapshots');
      return await runDailySnapshotJob();
    },
    { selfScheduled: true }
  );

  // Register reminder cache reset job - runs once daily at midnight Pacific  
  await jobScheduler.registerJob(
    'reminder-cache-reset',
    'Daily Reminder Cache Reset',
    'Clears the sent reminders cache daily to allow fresh reminders the next day',
    'maintenance',
    'Daily',
    86400000, // 24 hours
    async () => {
      const cacheSize = sentReminders.size;
      sentReminders.clear();
      return { summary: cacheSize > 0 ? `Cleared reminder cache (${cacheSize} entries)` : 'Cache already empty' };
    }
  );

  // Register weekly AI digest job (Task #62) — hourly tick that fires Monday 6am
  // in each enabled tenant's local timezone. selfScheduled: true so we anchor
  // execution to top-of-hour via startWeeklyDigestScheduler() below.
  await jobScheduler.registerJob(
    'weekly-digest',
    'Weekly AI Digest',
    'Sends each opted-in user an AI-summarized email of their weekly OKR progress every Monday morning (tenant-local). Per-tenant kill switch in Tenant Admin.',
    'notification',
    'Hourly (sends Mon 06:00 tenant-local)',
    3600000, // 1 hour (informational; actual tick is hour-aligned)
    async () => {
      const { runWeeklyDigestJob } = await import('./services/weekly-digest');
      return await runWeeklyDigestJob();
    },
    { selfScheduled: true }
  );

  // Register trash purge job - hard-deletes soft-deleted items older than 30 days
  await jobScheduler.registerJob(
    'trash-purge',
    'Trash Auto-Purge',
    'Permanently deletes soft-deleted strategic items (objectives, key results, big rocks, strategies, ambitions) older than 30 days',
    'maintenance',
    'Daily',
    86400000, // 24 hours
    async () => {
      const result = await storage.purgeOldDeletedItems(30);
      const total = result.objectives + result.keyResults + result.bigRocks + result.strategies + result.ambitions;
      return {
        summary: total > 0
          ? `Purged ${total} item(s): ${result.objectives} objectives, ${result.keyResults} key results, ${result.bigRocks} big rocks, ${result.strategies} strategies, ${result.ambitions} ambitions`
          : 'No items to purge',
        details: result,
      };
    }
  );

  // Initialize job scheduler and run startup jobs
  await jobScheduler.initialize();
  setTimeout(() => {
    jobScheduler.runJob('expiration-reminders', 'startup');
  }, 10000);

  // Anchor the daily snapshot job to Pacific midnight (instead of the default
  // 24-hour interval-from-startup). Idempotent — re-arms after each fire and
  // re-anchors after every server restart.
  {
    const { startPacificMidnightScheduler } = await import('./services/progress-snapshots');
    startPacificMidnightScheduler();
  }

  // Anchor the weekly digest job to top-of-hour ticks so we hit local 06:00 Mon.
  {
    const { startWeeklyDigestScheduler } = await import('./services/weekly-digest');
    startWeeklyDigestScheduler();
  }

  // On startup: capture today's snapshot so current-day data is available.
  // The historical backfill is gated on an empty progress_snapshots table to
  // avoid doing unbounded work on every boot — it runs once after the
  // 0005_add_progress_snapshots migration is applied to a previously-empty
  // schema, then no-ops thereafter. Set RUN_PROGRESS_SNAPSHOT_BACKFILL=force
  // to force a re-run (e.g. after schema changes).
  setTimeout(async () => {
    try {
      const { backfillSnapshotsFromCheckIns, hasAnyProgressSnapshots } =
        await import('./services/progress-snapshots');
      const force = process.env.RUN_PROGRESS_SNAPSHOT_BACKFILL === 'force';
      const alreadyPopulated = await hasAnyProgressSnapshots();
      if (force || !alreadyPopulated) {
        const result = await backfillSnapshotsFromCheckIns({ force });
        console.log(`[ProgressSnapshots] Backfill: ${result.summary}`);
      } else {
        console.log('[ProgressSnapshots] Backfill skipped — snapshots already populated');
      }
    } catch (err) {
      console.error('[ProgressSnapshots] Backfill failed:', err);
    }
    try {
      await jobScheduler.runJob('daily-progress-snapshots', 'startup');
    } catch (err) {
      console.error('[ProgressSnapshots] Startup capture failed:', err);
    }
  }, 15000);

  const httpServer = createServer(app);

  return httpServer;
}
