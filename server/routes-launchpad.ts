import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "./storage";
import multer from "multer";
import OpenAI from "openai";
import { type LaunchpadProposal } from "@shared/schema";
import { hasPermission, PERMISSIONS, Role, canAccessAnyTenant } from "@shared/rbac";

const router = Router();

/**
 * Helper function to check if user has permission to use Launchpad
 * Returns null if permitted, or an error object if denied
 */
function checkLaunchpadPermission(user: any): { error: string; message: string } | null {
  if (!user) {
    return { error: "Authentication required", message: "Please log in to use Launchpad" };
  }
  
  const userRole = user.role as Role;
  if (!hasPermission(userRole, PERMISSIONS.USE_LAUNCHPAD)) {
    return { 
      error: "Access denied", 
      message: "You don't have permission to use Launchpad. This feature is available to consultants and administrators."
    };
  }
  
  return null;
}

/**
 * Check if user can access a specific Launchpad session.
 * Allows access if: user owns session, session is in current tenant context, or user has cross-tenant access.
 */
function canAccessSession(session: any, user: any, effectiveTenantId: string): boolean {
  const userRole = user.role as Role;
  const isOwnSession = session.userId === user.id;
  const hasCrossTenantAccess = canAccessAnyTenant(userRole);
  const isSameTenant = session.tenantId === effectiveTenantId;
  
  return isSameTenant || isOwnSession || hasCrossTenantAccess;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOCX, TXT'));
    }
  }
});

async function extractTextFromDocument(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // pdf-parse is a CommonJS module - import its default export properly
    const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return buffer.toString('utf-8');
  }
}

router.post("/upload", upload.single('document'), async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }
    
    const user = req.user as any;
    if (!user.tenantId && !req.effectiveTenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No document uploaded" });
    }

    const targetYear = parseInt(req.body.targetYear) || new Date().getFullYear();
    const targetQuarter = req.body.targetQuarter ? parseInt(req.body.targetQuarter) : undefined;

    const documentText = await extractTextFromDocument(req.file.buffer, req.file.mimetype);
    
    if (documentText.length < 100) {
      return res.status(400).json({ error: "Document appears to be too short or empty" });
    }

    // Use effective tenant ID (allows consultants to use Launchpad for clients)
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    
    const session = await storage.createLaunchpadSession({
      tenantId: effectiveTenantId,
      userId: user.id,
      sourceDocumentName: req.file.originalname,
      sourceDocumentText: documentText.substring(0, 100000),
      status: "draft",
      targetYear,
      targetQuarter,
      analysisProgress: 0,
    });

    res.json(session);
  } catch (error: any) {
    console.error("Launchpad upload error:", error);
    res.status(500).json({ error: error.message || "Failed to upload document" });
  }
});

router.post("/:sessionId/analyze", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const session = await storage.getLaunchpadSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    
    if (!canAccessSession(session, user, effectiveTenantId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!session.sourceDocumentText) {
      return res.status(400).json({ error: "No document text to analyze" });
    }

    await storage.updateLaunchpadSession(session.id, {
      status: "analyzing",
      analysisProgress: 10,
    });

    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });

    const systemPrompt = `You are an expert organizational strategist. Analyze the provided document and extract/propose a comprehensive Company Operating System structure.

Return a JSON object with these fields:
- mission: A concise mission statement (1-2 sentences)
- vision: A compelling vision statement (1-2 sentences)  
- values: Array of {title, description} for 3-5 core values
- goals: Array of {title, description} for 3-5 annual goals
- strategies: Array of {title, description, linkedGoals} for 3-6 strategic initiatives
- objectives: Array of {title, description, level, keyResults, bigRocks} where:
  - level is "organization", "department", or "team"
  - keyResults is array of {title, metricType, targetValue, unit}
  - bigRocks is array of {title, description, priority}

Be specific and actionable. If the document doesn't contain certain elements, propose reasonable ones based on context.
Always return valid JSON that can be parsed.`;

    const userPrompt = `Analyze this organizational document and extract/propose a Company OS structure for the year ${session.targetYear}:

---
${session.sourceDocumentText.substring(0, 50000)}
---

Return only valid JSON matching the structure described.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    await storage.updateLaunchpadSession(session.id, {
      analysisProgress: 80,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let proposal: LaunchpadProposal;
    
    try {
      proposal = JSON.parse(responseText);
    } catch (parseError) {
      await storage.updateLaunchpadSession(session.id, {
        status: "error",
        analysisError: "Failed to parse AI response",
      });
      return res.status(500).json({ error: "AI response parsing failed" });
    }

    const updatedSession = await storage.updateLaunchpadSession(session.id, {
      aiProposal: proposal,
      userEdits: proposal,
      status: "pending_review",
      analysisProgress: 100,
    });

    res.json(updatedSession);
  } catch (error: any) {
    console.error("Launchpad analyze error:", error);
    
    await storage.updateLaunchpadSession(req.params.sessionId, {
      status: "error",
      analysisError: error.message,
    }).catch(() => {});
    
    res.status(500).json({ error: error.message || "Analysis failed" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    if (!effectiveTenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const sessions = await storage.getLaunchpadSessions(effectiveTenantId, user.id);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:sessionId", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const session = await storage.getLaunchpadSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    if (!canAccessSession(session, user, effectiveTenantId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:sessionId", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const session = await storage.getLaunchpadSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    if (!canAccessSession(session, user, effectiveTenantId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { userEdits } = req.body;
    const updated = await storage.updateLaunchpadSession(session.id, { userEdits });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:sessionId/approve", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const session = await storage.getLaunchpadSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    if (!canAccessSession(session, user, effectiveTenantId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const proposal = session.userEdits || session.aiProposal;
    if (!proposal) {
      return res.status(400).json({ error: "No proposal to approve" });
    }

    // Get bigRockQuarter from request body if provided (for annual objectives)
    const { bigRockQuarter } = req.body || {};

    const createdEntities = {
      foundation: false,
      values: 0,
      goals: 0,
      strategies: 0,
      objectives: 0,
      keyResults: 0,
      bigRocks: 0,
    };

    if (proposal.mission || proposal.vision || (proposal.values && proposal.values.length > 0)) {
      const existingFoundation = await storage.getFoundationByTenantId(session.tenantId);
      
      const foundationData: any = {
        tenantId: session.tenantId,
        mission: proposal.mission || existingFoundation?.mission || "",
        vision: proposal.vision || existingFoundation?.vision || "",
        values: proposal.values || existingFoundation?.values || [],
      };

      await storage.upsertFoundation(foundationData);
      createdEntities.foundation = true;
      createdEntities.values = proposal.values?.length || 0;
    }

    if (proposal.goals && proposal.goals.length > 0) {
      const existingFoundation = await storage.getFoundationByTenantId(session.tenantId);
      const existingGoals = (existingFoundation as any)?.goals || [];
      
      const newGoals = proposal.goals.map((g, idx) => ({
        id: `goal-${Date.now()}-${idx}`,
        title: g.title,
        description: g.description,
        year: session.targetYear,
        progress: 0,
      }));

      await storage.upsertFoundation({
        tenantId: session.tenantId,
        mission: existingFoundation?.mission || "",
        vision: existingFoundation?.vision || "",
        values: existingFoundation?.values || [],
        goals: [...existingGoals, ...newGoals],
      } as any);
      
      createdEntities.goals = proposal.goals.length;
    }

    if (proposal.strategies && proposal.strategies.length > 0) {
      for (const s of proposal.strategies) {
        await storage.createStrategy({
          tenantId: session.tenantId,
          title: s.title,
          description: s.description,
          status: "active",
        });
        
        createdEntities.strategies++;
      }
    }

    if (proposal.objectives && proposal.objectives.length > 0) {
      // Use targetQuarter if set, otherwise leave null for annual objectives
      const quarter = session.targetQuarter || null;
      
      for (const obj of proposal.objectives) {
        const objective = await storage.createObjective({
          tenantId: session.tenantId,
          title: obj.title,
          description: obj.description,
          level: obj.level || "organization",
          quarter,
          year: session.targetYear,
          status: "not_started",
        } as any);
        
        createdEntities.objectives++;

        if (obj.keyResults && obj.keyResults.length > 0) {
          for (const kr of obj.keyResults) {
            await storage.createKeyResult({
              objectiveId: objective.id,
              tenantId: session.tenantId,
              title: kr.title,
              metricType: kr.metricType || "numeric",
              targetValue: kr.targetValue || 100,
              currentValue: 0,
              initialValue: 0,
              unit: kr.unit || "",
            });
            createdEntities.keyResults++;
          }
        }

        if (obj.bigRocks && obj.bigRocks.length > 0) {
          // Big rocks require a quarter due to database constraint
          // Use: 1) explicit bigRockQuarter from request, 2) session.targetQuarter, 3) current quarter
          const effectiveBigRockQuarter = bigRockQuarter || session.targetQuarter || Math.ceil((new Date().getMonth() + 1) / 3);
          for (const br of obj.bigRocks) {
            await storage.createBigRock({
              objectiveId: objective.id,
              tenantId: session.tenantId,
              title: br.title,
              description: br.description,
              priority: br.priority as any || "high",
              status: "not_started",
              quarter: effectiveBigRockQuarter,
              year: session.targetYear,
            });
            createdEntities.bigRocks++;
          }
        }
      }
    }

    await storage.updateLaunchpadSession(session.id, {
      status: "approved",
    });

    res.json({
      success: true,
      message: "Company OS entities created successfully",
      created: createdEntities,
    });
  } catch (error: any) {
    console.error("Launchpad approve error:", error);
    res.status(500).json({ error: error.message || "Failed to create entities" });
  }
});

router.delete("/:sessionId", async (req: Request, res: Response) => {
  try {
    // Check permission to use Launchpad
    const permError = checkLaunchpadPermission(req.user);
    if (permError) {
      return res.status(403).json(permError);
    }

    const session = await storage.getLaunchpadSessionById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const user = req.user as any;
    const effectiveTenantId = req.effectiveTenantId || user.tenantId;
    if (!canAccessSession(session, user, effectiveTenantId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    await storage.deleteLaunchpadSession(session.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
