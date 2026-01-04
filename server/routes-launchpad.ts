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

/**
 * Detect if document contains structured OKR patterns
 * Returns true if explicit OKRs are found, false for narrative content
 */
function hasStructuredOKRs(text: string): boolean {
  const okrPatterns = [
    /\bobjective\s*\d+\s*:/i,           // "Objective 1:"
    /\bKR\s*\d+\s*:/i,                   // "KR1:", "KR 1:"
    /\bkey\s*result\s*\d+\s*:/i,         // "Key Result 1:"
    /\bobjectives?\s*&?\s*key\s*results?/i, // "Objectives & Key Results"
    /\bOKR\s*(hierarchy|framework)/i,   // "OKR hierarchy", "OKR framework"
    /\bteam\s+objectives?\s*:/i,        // "Team Objectives:"
    /\borganizational\s+objectives?\s*:/i, // "Organizational Objectives:"
    /\bdepartment\s+objectives?\s*:/i,  // "Department Objectives:"
    /\bbig\s*rocks?\s*\(/i,             // "Big Rocks (..."
    /\bquarterly\s+initiatives?\s*:/i,  // "Quarterly Initiatives:"
  ];
  
  let matchCount = 0;
  for (const pattern of okrPatterns) {
    if (pattern.test(text)) {
      matchCount++;
    }
  }
  
  // If 2+ patterns match, it's likely a structured OKR document
  return matchCount >= 2;
}

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
        existingContext += `- Existing Annual Goals: ${existingFoundation.annualGoals.map(g => typeof g === 'string' ? g : g.title).join(", ")}\n`;
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

    // Detect document type to choose appropriate extraction mode
    const isStructuredOKR = hasStructuredOKRs(session.sourceDocumentText);
    console.log(`[Launchpad] Document mode: ${isStructuredOKR ? 'EXTRACTION (structured OKRs detected)' : 'INFERENCE (narrative content)'}`);

    // Extraction mode prompt - for documents with explicit OKRs
    const extractionPrompt = `You are an expert document parser for organizational OKR systems. Your task is to EXTRACT (not summarize) every Objective, Key Result, and Big Rock from the document.

CRITICAL EXTRACTION RULES:
1. Extract EVERY objective listed in the document - do NOT summarize or consolidate
2. If the document lists 10 objectives, return 10 objectives. If it lists 50, return 50.
3. Preserve the exact titles and descriptions as written in the document
4. Extract ALL key results for EACH objective - do not skip any
5. The document may have hierarchical OKRs (organizational, departmental, team-level) - extract ALL levels

Return a JSON object with these fields:
- mission: Mission statement if present (extract verbatim)
- vision: Vision statement if present (extract verbatim)
- values: Array of {title, description} - extract ALL values listed
- goals: Array of {title, description} for annual goals/targets
  IMPORTANT: Goal titles MUST be descriptive phrases (3-8 words), not single words
- strategies: Array of {title, description, linkedGoals} - extract ALL strategies
- objectives: Array of ALL objectives found, each with:
  - title: The objective title (extract verbatim)
  - description: The objective description
  - level: "organization", "department", or "team" 
  - team: The team/department name if specified (e.g., "IT & Product", "Marketing", "HR")
  - keyResults: Array of ALL key results for this objective, each with:
    - title: The KR text (extract verbatim, e.g., "Vega live in production by Q2")
    - metricType: "number", "percentage", "currency", "boolean", or "custom"
    - targetValue: The target number if applicable
    - unit: The unit of measurement if applicable
  - bigRocks: Array of major initiatives/projects tied to this objective
- bigRocks: Top-level array for standalone big rocks not tied to objectives

BIG ROCKS GUIDANCE:
Big Rocks are major initiatives, projects, or milestones that drive progress toward objectives. Look for:
- Projects, programs, or launches mentioned (e.g., "Launch loyalty program", "RFID rollout")
- System implementations or upgrades mentioned
- Major milestones or deliverables
- Strategic initiatives or programs
For each objective, identify 1-3 big rocks that represent the main work/projects to achieve it.
Example: If an objective is "Grow e-commerce to 25% of sales", big rocks might be: "Implement BOPIS functionality", "Launch mobile app", "Redesign checkout flow"

EXAMPLE - If document says:
"IT Team Objectives:
Objective 1: Deliver Vega
- KR1: Vega live by Q2
- KR2: 3 clients piloted
Objective 2: Drive innovation  
- KR1: 100% AI integration
- KR2: 80% adoption"

You MUST return 2 separate objectives with their respective key results, NOT 1 combined objective.

DO NOT:
- Consolidate multiple objectives into one
- Skip objectives or key results
- Summarize - extract verbatim

Always return valid JSON.`;

    // Inference mode prompt - for narrative documents without explicit OKRs
    const inferencePrompt = `You are an expert organizational strategist. Analyze the provided document and generate a comprehensive Company Operating System structure based on the content.

The document does NOT contain explicit OKRs - you must INFER appropriate objectives, key results, and initiatives from the narrative content.

Return a JSON object with these fields:
- mission: A concise mission statement (1-2 sentences) - extract if present, or infer from document
- vision: A compelling vision statement (1-2 sentences) - extract if present, or infer from document
- values: Array of {title, description} for core values - extract or infer from document
- goals: Array of {title, description} for annual goals/targets
  IMPORTANT: Goal titles MUST be descriptive phrases of 3-8 words that convey the goal's intent.
  Examples of GOOD goal titles: "Increase recurring revenue by 25%", "Expand into European markets"
  Examples of BAD goal titles: "Revenue", "Growth" (single words are not acceptable)
- strategies: Array of {title, description, linkedGoals} for strategic initiatives
- objectives: Array of {title, description, level, keyResults, bigRocks} where:
  - level is "organization", "department", or "team"
  - keyResults is array of {title, metricType, targetValue, unit} - propose measurable key results
  - bigRocks is array of {title, description, priority} - major initiatives/projects for THIS objective
- bigRocks: Top-level array of {title, description, priority, quarter} for standalone big rocks. IMPORTANT: quarter must be an integer (1, 2, 3, or 4), NOT a string like "Q1"

BIG ROCKS ARE REQUIRED:
Big Rocks are the major initiatives, projects, and milestones that will drive progress. They are NOT optional.
- For EACH objective, include 1-3 big rocks representing the key work to achieve it
- Big rocks should be actionable projects like "Launch loyalty program", "Implement RFID system", "Redesign checkout flow"
- Priority should be "high", "medium", or "low"
- If the document mentions specific projects, use those; otherwise, infer logical initiatives from the objectives

GUIDELINES:
- Propose 3-6 high-impact objectives based on the document content
- Each objective should have 2-4 measurable key results
- EACH objective MUST have 1-3 big rocks (major initiatives/projects)
- Use specific, measurable language for key results
- If a section is not present in the document, make reasonable inferences or return empty array

Always return valid JSON.`;

    const systemPrompt = isStructuredOKR ? extractionPrompt : inferencePrompt;

    const extractionUserPrompt = `Analyze this organizational document and extract a Company OS structure for the year ${session.targetYear}:
${groundingContext ? `\nUse this company background context to better understand the organization:\n${groundingContext}` : ""}
${existingContext ? `\nFor reference, here is what already exists (user may choose to skip duplicates):\n${existingContext}` : ""}
---
DOCUMENT TO ANALYZE:
${session.sourceDocumentText.substring(0, 45000)}
---

CRITICAL: Extract EVERY objective and key result from this document - do not summarize or consolidate. 
The document contains multiple team-level objectives (IT, Marketing, Sales, HR, Finance, etc.) - extract ALL of them as separate objectives.
IMPORTANT: For each objective, also identify 1-3 Big Rocks (major initiatives/projects) that will drive progress. Look for projects, launches, implementations, or programs mentioned in the document. If none are explicitly stated, infer logical initiatives from the key results.
Return valid JSON with all elements found.`;

    const inferenceUserPrompt = `Analyze this organizational document and generate a Company OS structure for the year ${session.targetYear}:
${groundingContext ? `\nUse this company background context to better understand the organization:\n${groundingContext}` : ""}
${existingContext ? `\nFor reference, here is what already exists (avoid duplicating these):\n${existingContext}` : ""}
---
DOCUMENT TO ANALYZE:
${session.sourceDocumentText.substring(0, 45000)}
---

Based on the content, propose appropriate objectives, key results, strategies, and initiatives.
IMPORTANT: For each objective, include 1-3 Big Rocks (major initiatives/projects) that will drive progress toward that objective. Big rocks are actionable projects like "Launch loyalty program", "Implement new CRM", "Redesign checkout flow".
Return valid JSON with your proposed Company OS structure.`;

    const userPrompt = isStructuredOKR ? extractionUserPrompt : inferenceUserPrompt;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more deterministic extraction
      max_tokens: 16000, // Increase token limit to allow extraction of all OKRs
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

    // Normalize AI response to ensure all items have proper titles
    // AI sometimes returns 'name' instead of 'title' or omits titles entirely
    const normalizeItem = (item: any) => {
      if (!item) return item;
      // Use 'name' as 'title' if title is missing
      if (!item.title && item.name) {
        item.title = item.name;
      }
      // Use description as title if both are missing (truncated)
      if (!item.title && item.description) {
        item.title = item.description.slice(0, 100);
      }
      return item;
    };

    // Normalize objectives and their nested items
    if (proposal.objectives && Array.isArray(proposal.objectives)) {
      proposal.objectives = proposal.objectives.map((obj: any) => {
        normalizeItem(obj);
        if (obj.keyResults && Array.isArray(obj.keyResults)) {
          obj.keyResults = obj.keyResults.map(normalizeItem).filter((kr: any) => kr?.title);
        }
        if (obj.bigRocks && Array.isArray(obj.bigRocks)) {
          obj.bigRocks = obj.bigRocks.map(normalizeItem).filter((br: any) => br?.title);
        }
        return obj;
      }).filter((obj: any) => obj?.title);
    }

    // Normalize top-level big rocks
    if (proposal.bigRocks && Array.isArray(proposal.bigRocks)) {
      proposal.bigRocks = proposal.bigRocks.map(normalizeItem).filter((br: any) => br?.title);
    }

    // Normalize strategies
    if (proposal.strategies && Array.isArray(proposal.strategies)) {
      proposal.strategies = proposal.strategies.map(normalizeItem).filter((s: any) => s?.title);
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

    // Helper to normalize titles for deduplication (handles null/undefined)
    const normalizeTitle = (title: string | null | undefined) => (title || '').toLowerCase().trim();

    // Pre-fetch existing items for deduplication
    const existingStrategies = await storage.getStrategiesByTenantId(session.tenantId);
    const existingObjectives = await storage.getObjectivesByTenantId(session.tenantId);
    const existingBigRocks = await storage.getBigRocksByTenantId(session.tenantId);
    
    const existingStrategyTitles = new Set(existingStrategies.map((s: any) => normalizeTitle(s.title)));
    const existingObjectiveTitles = new Set(existingObjectives.map((o: any) => normalizeTitle(o.title)));
    const existingBigRockTitles = new Set(existingBigRocks.map((b: any) => normalizeTitle(b.title)));

    // Foundation updates (mission, vision, values, goals) - combined to avoid overwriting
    const existingFoundation = await storage.getFoundationByTenantId(session.tenantId);
    const shouldUpdateMission = approveMission && proposal.mission;
    const shouldUpdateVision = approveVision && proposal.vision;
    const shouldUpdateValues = approveValues && proposal.values && proposal.values.length > 0;
    
    // Track the values we'll use (either new from proposal or existing)
    const newMission = shouldUpdateMission ? proposal.mission : (existingFoundation?.mission || "");
    const newVision = shouldUpdateVision ? proposal.vision : (existingFoundation?.vision || "");
    const newValues = shouldUpdateValues ? proposal.values : (existingFoundation?.values || []);
    
    // Track skipped sections
    if (!approveMission && proposal.mission) createdEntities.skipped.push('mission');
    if (!approveVision && proposal.vision) createdEntities.skipped.push('vision');
    if (!approveValues && proposal.values?.length) createdEntities.skipped.push('values');

    // Goals - only if approved
    let newAnnualGoals = existingFoundation?.annualGoals || [];
    if (approveGoals && proposal.goals && proposal.goals.length > 0) {
      const existingAnnualGoals = existingFoundation?.annualGoals || [];
      // Handle both old string[] format and new AnnualGoal[] format for backwards compatibility
      const existingGoalTitles = new Set(existingAnnualGoals.map(g => normalizeTitle(typeof g === 'string' ? g : g.title)));
      
      // Create AnnualGoal objects with year from session.targetYear
      const targetYear = session.targetYear;
      const goalsToAdd = proposal.goals
        .map((g: any) => {
          let title = typeof g === 'string' ? g : g.title || "";
          const description = typeof g === 'string' ? "" : g.description || "";
          
          // If title is too short (less than 3 words), derive from description
          if (title.split(/\s+/).length < 3 && description) {
            // Extract first meaningful clause from description (up to ~50 chars)
            const firstClause = description.split(/[.;,]/).find((c: string) => c.trim().length > 10) || description;
            title = firstClause.trim().slice(0, 60).replace(/\s+\S*$/, ''); // Trim to word boundary
          }
          const finalTitle = title || description.slice(0, 60);
          return { 
            title: finalTitle, 
            year: targetYear,
            description: description || undefined 
          };
        })
        .filter((goal: any) => !existingGoalTitles.has(normalizeTitle(goal.title)));

      if (goalsToAdd.length > 0) {
        // Migrate old string goals to new format if needed
        const migratedExistingGoals = existingAnnualGoals.map(g => 
          typeof g === 'string' ? { title: g, year: targetYear - 1 } : g
        );
        newAnnualGoals = [...migratedExistingGoals, ...goalsToAdd];
        createdEntities.goals = goalsToAdd.length;
      }
      createdEntities.duplicatesSkipped += proposal.goals.length - goalsToAdd.length;
    } else if (!approveGoals && proposal.goals?.length) {
      createdEntities.skipped.push('goals');
    }
    
    // Single upsert for all foundation fields to avoid overwriting
    const shouldUpdateFoundation = shouldUpdateMission || shouldUpdateVision || shouldUpdateValues || createdEntities.goals > 0;
    if (shouldUpdateFoundation) {
      await storage.upsertFoundation({
        tenantId: session.tenantId,
        mission: newMission,
        vision: newVision,
        values: newValues,
        annualGoals: newAnnualGoals,
      });
      createdEntities.foundation = true;
      if (shouldUpdateValues) createdEntities.values = proposal.values?.length || 0;
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
            // Skip big rocks without a valid title
            if (!br.title || !br.title.trim()) {
              continue;
            }
            // Skip if big rock with same title already exists
            if (existingBigRockTitles.has(normalizeTitle(br.title))) {
              createdEntities.duplicatesSkipped++;
              continue;
            }
            await storage.createBigRock({
              objectiveId: objective.id,
              tenantId: session.tenantId,
              title: br.title.trim(),
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
        // Skip big rocks without a valid title
        if (!br.title || !br.title.trim()) {
          continue;
        }
        // Skip if big rock with same title already exists
        if (existingBigRockTitles.has(normalizeTitle(br.title))) {
          createdEntities.duplicatesSkipped++;
          continue;
        }
        // Parse quarter - handle both integer (1-4) and string formats ("Q1", "1", etc.)
        let brQuarter = (br as any).quarter;
        if (typeof brQuarter === 'string') {
          // Extract numeric part from strings like "Q1", "Q2", etc.
          const match = brQuarter.match(/\d+/);
          brQuarter = match ? parseInt(match[0]) : null;
        }
        const finalQuarter = (brQuarter && brQuarter >= 1 && brQuarter <= 4) ? brQuarter : effectiveBigRockQuarter;
        
        await storage.createBigRock({
          tenantId: session.tenantId,
          title: br.title.trim(),
          description: br.description,
          priority: br.priority as any || "high",
          status: "not_started",
          quarter: finalQuarter,
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
