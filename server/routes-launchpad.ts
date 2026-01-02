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
    // pdf-parse v2.x uses class-based API
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
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

    // Fetch existing data to avoid duplicates
    const existingFoundation = await storage.getFoundationByTenantId(session.tenantId);
    const existingStrategies = await storage.getStrategiesByTenantId(session.tenantId);
    const existingObjectives = await storage.getObjectivesByTenantId(session.tenantId);
    
    // Fetch AI grounding documents for enhanced context
    const groundingDocs = await storage.getActiveGroundingDocumentsForTenant(session.tenantId);

    await storage.updateLaunchpadSession(session.id, {
      analysisProgress: 20,
    });

    // Build grounding context from tenant's AI background documents
    let groundingContext = "";
    if (groundingDocs.length > 0) {
      groundingContext = "\n\n## COMPANY BACKGROUND CONTEXT:\n";
      groundingContext += groundingDocs.map(doc => `### ${doc.title}\n${doc.content}`).join("\n\n");
    }

    // Build context about existing data
    let existingContext = "";
    if (existingFoundation?.mission || existingFoundation?.vision || (existingFoundation?.values && existingFoundation.values.length > 0)) {
      existingContext += "\n\n## EXISTING COMPANY DATA (do NOT duplicate these):\n";
      if (existingFoundation.mission) {
        existingContext += `- Existing Mission: "${existingFoundation.mission}"\n`;
      }
      if (existingFoundation.vision) {
        existingContext += `- Existing Vision: "${existingFoundation.vision}"\n`;
      }
      if (existingFoundation.values && existingFoundation.values.length > 0) {
        existingContext += `- Existing Values: ${existingFoundation.values.map(v => v.title).join(", ")}\n`;
      }
      if (existingFoundation.annualGoals && existingFoundation.annualGoals.length > 0) {
        existingContext += `- Existing Annual Goals: ${existingFoundation.annualGoals.join(", ")}\n`;
      }
    }
    if (existingStrategies.length > 0) {
      existingContext += `- Existing Strategies: ${existingStrategies.map(s => s.title).join(", ")}\n`;
    }
    if (existingObjectives.length > 0) {
      existingContext += `- Existing Objectives: ${existingObjectives.map(o => o.title).join(", ")}\n`;
    }

    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });

    const systemPrompt = `You are an expert organizational strategist. Analyze the provided document and extract a comprehensive Company Operating System structure.

ALWAYS extract everything you find in the document - the user will decide what to keep via a selective approval UI.

Return a JSON object with these fields:
- mission: A concise mission statement (1-2 sentences) - extract if present in document
- vision: A compelling vision statement (1-2 sentences) - extract if present in document  
- values: Array of {title, description} for core values - extract all values from document
- goals: Array of {title, description} for annual goals/targets - extract all goals from document
  IMPORTANT: Goal titles MUST be descriptive phrases of 3-8 words that convey the goal's intent. 
  Examples of GOOD goal titles: "Increase recurring revenue by 25%", "Expand into European markets", "Launch mobile app for customers"
  Examples of BAD goal titles: "Revenue", "Growth", "Expansion" (single words are not acceptable)
- strategies: Array of {title, description, linkedGoals} for strategic initiatives - extract all strategies
- objectives: Array of {title, description, level, keyResults, bigRocks} where:
  - level is "organization", "department", or "team"
  - keyResults is array of {title, metricType, targetValue, unit}
  - bigRocks is array of {title, description, priority} - extract all major initiatives/projects
- bigRocks: Also include a top-level array of {title, description, priority, quarter} for standalone big rocks/initiatives not tied to specific objectives

IMPORTANT:
- Extract EVERYTHING from the document - user will selectively approve what to import
- Be thorough - don't skip sections even if similar data might exist
- Big Rocks are major quarterly initiatives/projects - extract all mentioned in the document
- If a section is not present in the document, return an empty array or null

Always return valid JSON that can be parsed.`;

    const userPrompt = `Analyze this organizational document and extract a Company OS structure for the year ${session.targetYear}:
${groundingContext ? `\nUse this company background context to better understand the organization:\n${groundingContext}` : ""}
${existingContext ? `\nFor reference, here is what already exists (user may choose to skip duplicates):\n${existingContext}` : ""}
---
DOCUMENT TO ANALYZE:
${session.sourceDocumentText.substring(0, 45000)}
---

Return valid JSON with all elements found in the document. Extract everything - the user will decide what to approve.`;

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

    // Store existing data reference for the review UI
    const existingData = {
      mission: existingFoundation?.mission || null,
      vision: existingFoundation?.vision || null,
      values: existingFoundation?.values || [],
      annualGoals: existingFoundation?.annualGoals || [],
      strategies: existingStrategies.map(s => ({ id: s.id, title: s.title, description: s.description })),
      objectives: existingObjectives.map(o => ({ id: o.id, title: o.title, description: o.description })),
    };

    const updatedSession = await storage.updateLaunchpadSession(session.id, {
      aiProposal: proposal,
      userEdits: proposal,
      existingData: existingData as any,
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

    // Get section approval flags from request body (defaults from session or true)
    const { 
      bigRockQuarter,
      approveMission = session.approveMission ?? true,
      approveVision = session.approveVision ?? true,
      approveValues = session.approveValues ?? true,
      approveGoals = session.approveGoals ?? true,
      approveStrategies = session.approveStrategies ?? true,
      approveObjectives = session.approveObjectives ?? true,
      approveBigRocks = (session as any).approveBigRocks ?? true,
    } = req.body || {};

    const createdEntities = {
      foundation: false,
      values: 0,
      goals: 0,
      strategies: 0,
      objectives: 0,
      keyResults: 0,
      bigRocks: 0,
      skipped: [] as string[],
      duplicatesSkipped: 0,
    };

    // Helper to normalize titles for deduplication
    const normalizeTitle = (title: string) => title.toLowerCase().trim();

    // Pre-fetch existing items for deduplication
    const existingStrategies = await storage.getStrategiesByTenantId(session.tenantId);
    const existingObjectives = await storage.getObjectivesByTenantId(session.tenantId);
    const existingBigRocks = await storage.getBigRocksByTenantId(session.tenantId);
    
    const existingStrategyTitles = new Set(existingStrategies.map((s: any) => normalizeTitle(s.title)));
    const existingObjectiveTitles = new Set(existingObjectives.map((o: any) => normalizeTitle(o.title)));
    const existingBigRockTitles = new Set(existingBigRocks.map((b: any) => normalizeTitle(b.title)));

    // Foundation updates (mission, vision, values) - only if approved
    const existingFoundation = await storage.getFoundationByTenantId(session.tenantId);
    const shouldUpdateMission = approveMission && proposal.mission;
    const shouldUpdateVision = approveVision && proposal.vision;
    const shouldUpdateValues = approveValues && proposal.values && proposal.values.length > 0;
    
    if (shouldUpdateMission || shouldUpdateVision || shouldUpdateValues) {
      const foundationData: any = {
        tenantId: session.tenantId,
        mission: shouldUpdateMission ? proposal.mission : (existingFoundation?.mission || ""),
        vision: shouldUpdateVision ? proposal.vision : (existingFoundation?.vision || ""),
        values: shouldUpdateValues ? proposal.values : (existingFoundation?.values || []),
      };

      await storage.upsertFoundation(foundationData);
      createdEntities.foundation = true;
      if (shouldUpdateValues) createdEntities.values = proposal.values?.length || 0;
    }
    
    // Track skipped sections
    if (!approveMission && proposal.mission) createdEntities.skipped.push('mission');
    if (!approveVision && proposal.vision) createdEntities.skipped.push('vision');
    if (!approveValues && proposal.values?.length) createdEntities.skipped.push('values');

    // Goals - only if approved
    if (approveGoals && proposal.goals && proposal.goals.length > 0) {
      const existingAnnualGoals = existingFoundation?.annualGoals || [];
      const existingGoalTitles = new Set(existingAnnualGoals.map(g => normalizeTitle(g)));
      
      // annualGoals is a string[] - extract titles from the proposal goals
      // Ensure goal titles are descriptive (3+ words) - use description if title is too short
      const newGoalTitles = proposal.goals
        .map((g: any) => {
          let title = typeof g === 'string' ? g : g.title || "";
          const description = typeof g === 'string' ? "" : g.description || "";
          
          // If title is too short (less than 3 words), derive from description
          if (title.split(/\s+/).length < 3 && description) {
            // Extract first meaningful clause from description (up to ~50 chars)
            const firstClause = description.split(/[.;,]/).find((c: string) => c.trim().length > 10) || description;
            title = firstClause.trim().slice(0, 60).replace(/\s+\S*$/, ''); // Trim to word boundary
          }
          return title || description.slice(0, 60);
        })
        .filter((title: string) => !existingGoalTitles.has(normalizeTitle(title)));

      if (newGoalTitles.length > 0) {
        await storage.upsertFoundation({
          tenantId: session.tenantId,
          mission: existingFoundation?.mission || "",
          vision: existingFoundation?.vision || "",
          values: existingFoundation?.values || [],
          annualGoals: [...existingAnnualGoals, ...newGoalTitles],
        });
        createdEntities.goals = newGoalTitles.length;
      }
      createdEntities.duplicatesSkipped += proposal.goals.length - newGoalTitles.length;
    } else if (!approveGoals && proposal.goals?.length) {
      createdEntities.skipped.push('goals');
    }

    // Strategies - only if approved (with deduplication)
    if (approveStrategies && proposal.strategies && proposal.strategies.length > 0) {
      for (const s of proposal.strategies) {
        // Skip if strategy with same title already exists
        if (existingStrategyTitles.has(normalizeTitle(s.title))) {
          createdEntities.duplicatesSkipped++;
          continue;
        }
        await storage.createStrategy({
          tenantId: session.tenantId,
          title: s.title,
          description: s.description,
          status: "active",
        });
        existingStrategyTitles.add(normalizeTitle(s.title)); // Prevent duplicates within same batch
        createdEntities.strategies++;
      }
    } else if (!approveStrategies && proposal.strategies?.length) {
      createdEntities.skipped.push('strategies');
    }

    // Objectives - only if approved (with deduplication)
    if (approveObjectives && proposal.objectives && proposal.objectives.length > 0) {
      // Use targetQuarter if set, otherwise leave null for annual objectives
      const quarter = session.targetQuarter || null;
      
      for (const obj of proposal.objectives) {
        // Skip if objective with same title already exists
        if (existingObjectiveTitles.has(normalizeTitle(obj.title))) {
          createdEntities.duplicatesSkipped++;
          continue;
        }
        
        const objective = await storage.createObjective({
          tenantId: session.tenantId,
          title: obj.title,
          description: obj.description,
          level: obj.level || "organization",
          quarter,
          year: session.targetYear,
          status: "not_started",
        } as any);
        
        existingObjectiveTitles.add(normalizeTitle(obj.title)); // Prevent duplicates within same batch
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

        // Create big rocks attached to this objective (only if approveBigRocks is true, with dedup)
        if (approveBigRocks && obj.bigRocks && obj.bigRocks.length > 0) {
          // Big rocks require a quarter due to database constraint
          // Use: 1) explicit bigRockQuarter from request, 2) session.targetQuarter, 3) current quarter
          const effectiveBigRockQuarter = bigRockQuarter || session.targetQuarter || Math.ceil((new Date().getMonth() + 1) / 3);
          for (const br of obj.bigRocks) {
            // Skip if big rock with same title already exists
            if (existingBigRockTitles.has(normalizeTitle(br.title))) {
              createdEntities.duplicatesSkipped++;
              continue;
            }
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
            existingBigRockTitles.add(normalizeTitle(br.title));
            createdEntities.bigRocks++;
          }
        }
      }
    } else if (!approveObjectives && proposal.objectives?.length) {
      createdEntities.skipped.push('objectives');
    }

    // Create top-level (standalone) big rocks - only if approveBigRocks is true (with dedup)
    if (approveBigRocks && proposal.bigRocks && proposal.bigRocks.length > 0) {
      const effectiveBigRockQuarter = bigRockQuarter || session.targetQuarter || Math.ceil((new Date().getMonth() + 1) / 3);
      for (const br of proposal.bigRocks) {
        // Skip if big rock with same title already exists
        if (existingBigRockTitles.has(normalizeTitle(br.title))) {
          createdEntities.duplicatesSkipped++;
          continue;
        }
        await storage.createBigRock({
          tenantId: session.tenantId,
          title: br.title,
          description: br.description,
          priority: br.priority as any || "high",
          status: "not_started",
          quarter: (br as any).quarter || effectiveBigRockQuarter,
          year: session.targetYear,
        });
        existingBigRockTitles.add(normalizeTitle(br.title));
        createdEntities.bigRocks++;
      }
    } else if (!approveBigRocks && (proposal.bigRocks?.length || proposal.objectives?.some((o: any) => o.bigRocks?.length))) {
      createdEntities.skipped.push('bigRocks');
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
