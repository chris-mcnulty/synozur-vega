import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertGroundingDocumentSchema, AI_FEATURES } from "@shared/schema";
import { getChatCompletion, getSimpleCompletion, streamChatCompletion, streamChatWithTools, generateOKRSuggestions, suggestBigRocks, streamProgressSummary, streamGoalSuggestions, streamStrategyDraft, parseMeetingRecap, scoreOKRQuality, generateMeetingAgenda, type ChatMessage, type ProgressSummaryData, type GoalSuggestionContext, type StrategyDraftContext, type MeetingRecapResult, type OKRQualityScoreResult, type GenerateMeetingAgendaResult } from "./ai";
import { z } from "zod";
import { hasPermission, PERMISSIONS, Role } from "@shared/rbac";
import { loadCurrentUser, requireTenantAccess } from "./middleware/rbac";

export const aiRouter = Router();

// Apply auth middleware to all AI routes
aiRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
});

// Load user for all routes
aiRouter.use(loadCurrentUser);

// Middleware to check if user has admin permissions for grounding documents
function requireAIAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!hasPermission(req.user.role as Role, PERMISSIONS.MANAGE_AI_GROUNDING)) {
    return res.status(403).json({ error: "Admin access required for AI grounding management" });
  }

  next();
}

// Middleware to check if user can use AI chat
function requireAIChat(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!hasPermission(req.user.role as Role, PERMISSIONS.USE_AI_CHAT)) {
    return res.status(403).json({ error: "AI chat not available for your role" });
  }

  next();
}

// ============================================
// FILE PARSING ROUTES (Admin Only)
// ============================================

// Parse PDF file and extract text
aiRouter.post("/parse-pdf", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        // pdf-parse v2.x uses class-based API
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();
        res.json({ text: result.text });
      } catch (parseError) {
        console.error("Error parsing PDF:", parseError);
        res.status(400).json({ error: "Failed to parse PDF file" });
      }
    });
  } catch (error) {
    console.error("Error handling PDF upload:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

// Parse DOCX file and extract text
aiRouter.post("/parse-docx", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        res.json({ text: result.value });
      } catch (parseError) {
        console.error("Error parsing DOCX:", parseError);
        res.status(400).json({ error: "Failed to parse DOCX file" });
      }
    });
  } catch (error) {
    console.error("Error handling DOCX upload:", error);
    res.status(500).json({ error: "Failed to process DOCX" });
  }
});

// ============================================
// GROUNDING DOCUMENTS ROUTES (Admin Only)
// ============================================

// Get all grounding documents
aiRouter.get("/grounding-documents", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const documents = await storage.getAllGroundingDocuments();
    res.json(documents);
  } catch (error) {
    console.error("Error fetching grounding documents:", error);
    res.status(500).json({ error: "Failed to fetch grounding documents" });
  }
});

// Get single grounding document
aiRouter.get("/grounding-documents/:id", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const document = await storage.getGroundingDocumentById(id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching grounding document:", error);
    res.status(500).json({ error: "Failed to fetch grounding document" });
  }
});

// Create grounding document
aiRouter.post("/grounding-documents", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const validatedData = insertGroundingDocumentSchema.parse({
      ...req.body,
      createdBy: user.id,
    });
    
    const document = await storage.createGroundingDocument(validatedData);
    res.status(201).json(document);
  } catch (error) {
    console.error("Error creating grounding document:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create grounding document" });
  }
});

// Update grounding document
aiRouter.patch("/grounding-documents/:id", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    const existingDoc = await storage.getGroundingDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const validatedData = insertGroundingDocumentSchema.partial().parse({
      ...req.body,
      updatedBy: user.id,
    });
    
    const document = await storage.updateGroundingDocument(id, validatedData);
    res.json(document);
  } catch (error) {
    console.error("Error updating grounding document:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update grounding document" });
  }
});

// Delete grounding document
aiRouter.delete("/grounding-documents/:id", requireAIAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingDoc = await storage.getGroundingDocumentById(id);
    if (!existingDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    await storage.deleteGroundingDocument(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting grounding document:", error);
    res.status(500).json({ error: "Failed to delete grounding document" });
  }
});

// ============================================
// AI CHAT ROUTES
// ============================================

// Chat completion endpoint
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  tenantId: z.string().optional(),
});

aiRouter.post("/chat", requireAIChat, async (req: Request, res: Response) => {
  try {
    const { messages, tenantId } = chatRequestSchema.parse(req.body);
    const user = (req as any).user;
    
    // Use user's tenant if not specified
    const effectiveTenantId = tenantId || user.tenantId;

    const response = await getChatCompletion(messages as ChatMessage[], {
      tenantId: effectiveTenantId,
    });

    res.json({ response });
  } catch (error: any) {
    console.error("Error in AI chat:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to get AI response" });
  }
});

// Streaming chat endpoint (Server-Sent Events) - WITH TOOL SUPPORT
aiRouter.post("/chat/stream", requireAIChat, async (req: Request, res: Response) => {
  console.log("[AI Chat Stream] Request received");
  try {
    const { messages, tenantId } = chatRequestSchema.parse(req.body);
    const user = (req as any).user;
    console.log("[AI Chat Stream] User:", user.email, "Messages count:", messages.length);
    
    // Security: Validate tenant access
    // Admin/consultant roles can access any tenant, regular users only their own
    const adminRoles = ["admin", "global_admin", "vega_admin", "vega_consultant"];
    const canAccessAnyTenant = adminRoles.includes(user.role);
    
    let effectiveTenantId = user.tenantId; // Default to user's own tenant
    
    if (tenantId) {
      if (tenantId === user.tenantId || canAccessAnyTenant) {
        effectiveTenantId = tenantId;
      } else {
        console.warn("[AI Chat Stream] Tenant access denied for user:", user.email, "attempted:", tenantId);
        return res.status(403).json({ error: "Access denied to specified tenant" });
      }
    }
    
    if (!effectiveTenantId) {
      return res.status(400).json({ error: "No tenant context available" });
    }
    
    console.log("[AI Chat Stream] Tenant ID:", effectiveTenantId);

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log("[AI Chat Stream] Starting stream with tools...");
    // Use the new streamChatWithTools function that supports function calling
    const stream = streamChatWithTools(messages as ChatMessage[], {
      tenantId: effectiveTenantId,
      enableTools: true,
      userRole: user.role,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    console.log("[AI Chat Stream] Stream completed, chunks:", chunkCount);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("[AI Chat Stream] Error:", error.message || error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to stream AI response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Legacy streaming chat endpoint (without tools) - for backwards compatibility
aiRouter.post("/chat/stream-legacy", requireAIChat, async (req: Request, res: Response) => {
  console.log("[AI Chat Stream Legacy] Request received");
  try {
    const { messages, tenantId } = chatRequestSchema.parse(req.body);
    const user = (req as any).user;
    
    const effectiveTenantId = tenantId || user.tenantId;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = streamChatCompletion(messages as ChatMessage[], {
      tenantId: effectiveTenantId,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("[AI Chat Stream Legacy] Error:", error.message || error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to stream AI response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// OKR suggestions endpoint
const okrSuggestionSchema = z.object({
  tenantId: z.string(),
  focusArea: z.string().optional(),
  quarter: z.number().optional(),
  year: z.number().optional(),
});

aiRouter.post("/suggest/okrs", requireAIChat, async (req: Request, res: Response) => {
  try {
    const { tenantId, focusArea, quarter, year } = okrSuggestionSchema.parse(req.body);
    
    // Get existing strategies and objectives for context
    const strategies = await storage.getStrategiesByTenantId(tenantId);
    const existingObjectives = await storage.getObjectivesByTenantId(tenantId, quarter, year);

    const suggestions = await generateOKRSuggestions({
      tenantId,
      strategies,
      existingObjectives,
      focusArea,
      quarter,
      year,
    });

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Error generating OKR suggestions:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to generate OKR suggestions" });
  }
});

// Big Rock suggestions endpoint
const bigRockSuggestionSchema = z.object({
  tenantId: z.string(),
  objectiveId: z.string(),
});

aiRouter.post("/suggest/big-rocks", requireAIChat, async (req: Request, res: Response) => {
  try {
    const { tenantId, objectiveId } = bigRockSuggestionSchema.parse(req.body);
    
    const objective = await storage.getObjectiveById(objectiveId);
    if (!objective) {
      return res.status(404).json({ error: "Objective not found" });
    }

    const keyResults = await storage.getKeyResultsByObjectiveId(objectiveId);

    const suggestions = await suggestBigRocks({
      tenantId,
      objective,
      keyResults,
    });

    res.json({ suggestions });
  } catch (error: any) {
    console.error("Error generating Big Rock suggestions:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to generate Big Rock suggestions" });
  }
});

// Progress summary endpoint - generates AI summary of OKR progress for a given interval
const progressSummarySchema = z.object({
  tenantId: z.string(),
  objectives: z.array(z.object({
    id: z.string(),
    title: z.string(),
    progress: z.number(),
    status: z.string(),
    keyResults: z.array(z.object({
      id: z.string(),
      title: z.string(),
      currentValue: z.number(),
      targetValue: z.number(),
      unit: z.string(),
      progress: z.number(),
    })).optional(),
  })),
  quarter: z.number(),
  year: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customPrompt: z.string().optional(),
});

aiRouter.post("/progress-summary/stream", requireAIChat, async (req: Request, res: Response) => {
  console.log("[Progress Summary] Request received");
  try {
    const parsed = progressSummarySchema.parse(req.body);
    const user = (req as any).user;
    console.log("[Progress Summary] User:", user.email, "Objectives count:", parsed.objectives.length);
    
    // Build date range description
    let dateRange = "";
    if (parsed.startDate && parsed.endDate) {
      dateRange = `${parsed.startDate} to ${parsed.endDate}`;
    } else if (parsed.startDate) {
      dateRange = `From ${parsed.startDate}`;
    } else if (parsed.endDate) {
      dateRange = `Until ${parsed.endDate}`;
    }

    // Fetch check-ins for all objectives and their key results within the date range
    const allCheckIns: ProgressSummaryData['checkIns'] = [];
    
    for (const obj of parsed.objectives) {
      // Get check-ins for the objective
      const objCheckIns = await storage.getCheckInsByEntityId('objective', obj.id);
      
      // Filter by date range if provided
      const filteredObjCheckIns = objCheckIns.filter(ci => {
        if (!ci.asOfDate) return true;
        const checkInDate = new Date(ci.asOfDate);
        if (parsed.startDate && checkInDate < new Date(parsed.startDate)) return false;
        if (parsed.endDate && checkInDate > new Date(parsed.endDate + 'T23:59:59')) return false;
        return true;
      });
      
      for (const ci of filteredObjCheckIns) {
        allCheckIns.push({
          entityType: 'objective',
          entityId: ci.entityId,
          entityTitle: obj.title,
          previousProgress: ci.previousProgress || 0,
          newProgress: ci.newProgress || 0,
          note: ci.note || undefined,
          achievements: ci.achievements || undefined,
          challenges: ci.challenges || undefined,
          nextSteps: ci.nextSteps || undefined,
          createdAt: ci.createdAt || new Date(),
        });
      }

      // Get check-ins for each key result
      if (obj.keyResults) {
        for (const kr of obj.keyResults) {
          const krCheckIns = await storage.getCheckInsByEntityId('key_result', kr.id);
          
          const filteredKrCheckIns = krCheckIns.filter(ci => {
            if (!ci.asOfDate) return true;
            const checkInDate = new Date(ci.asOfDate);
            if (parsed.startDate && checkInDate < new Date(parsed.startDate)) return false;
            if (parsed.endDate && checkInDate > new Date(parsed.endDate + 'T23:59:59')) return false;
            return true;
          });
          
          for (const ci of filteredKrCheckIns) {
            allCheckIns.push({
              entityType: 'key_result',
              entityId: ci.entityId,
              entityTitle: kr.title,
              previousProgress: ci.previousProgress || 0,
              newProgress: ci.newProgress || 0,
              note: ci.note || undefined,
              achievements: ci.achievements || undefined,
              challenges: ci.challenges || undefined,
              nextSteps: ci.nextSteps || undefined,
              createdAt: ci.createdAt || new Date(),
            });
          }
        }
      }
    }

    console.log("[Progress Summary] Found check-ins:", allCheckIns.length);

    // Cap check-ins to the 50 most recent to keep the user message payload small.
    // 187+ check-ins was causing model timeouts even with a lean system prompt.
    const MAX_CHECK_INS = 50;
    const cappedCheckIns = allCheckIns
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_CHECK_INS);
    if (allCheckIns.length > MAX_CHECK_INS) {
      console.log(`[Progress Summary] Capped check-ins from ${allCheckIns.length} to ${MAX_CHECK_INS}`);
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Prepare the summary data
    const summaryData: ProgressSummaryData = {
      objectives: parsed.objectives,
      checkIns: cappedCheckIns,
      quarter: parsed.quarter,
      year: parsed.year,
      dateRange: dateRange || undefined,
    };

    console.log("[Progress Summary] Starting AI stream...");
    const stream = streamProgressSummary({
      tenantId: parsed.tenantId,
      data: summaryData,
      customPrompt: parsed.customPrompt,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    console.log("[Progress Summary] Stream completed, chunks:", chunkCount);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("[Progress Summary] Error:", error.message || error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to generate progress summary" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Goal suggestions endpoint - generates AI suggestions for annual goals based on organizational context
const goalSuggestionSchema = z.object({
  tenantId: z.string(),
});

aiRouter.post("/suggest/goals/stream", requireAIChat, async (req: Request, res: Response) => {
  console.log("[Goal Suggestions] Request received");
  try {
    const { tenantId } = goalSuggestionSchema.parse(req.body);
    const user = (req as any).user;
    console.log("[Goal Suggestions] User:", user.email, "Tenant:", tenantId);

    // Gather all organizational context
    const [foundationResult, strategies, objectives] = await Promise.all([
      storage.getFoundationByTenantId(tenantId),
      storage.getStrategiesByTenantId(tenantId),
      storage.getObjectivesByTenantId(tenantId),
    ]);
    
    const foundation = foundationResult || null;
    const existingGoals = foundation?.annualGoals || [];

    console.log("[Goal Suggestions] Context - Foundation:", !!foundation, 
      "Strategies:", strategies.length, 
      "Objectives:", objectives.length,
      "Existing Goals:", existingGoals.length);

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Stream the goal suggestions
    const stream = streamGoalSuggestions({
      tenantId,
      foundation,
      strategies,
      objectives,
      existingGoals,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    console.log("[Goal Suggestions] Stream completed, chunks:", chunkCount);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("[Goal Suggestions] Error:", error.message || error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to generate goal suggestions" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Strategy draft endpoint - generates AI-drafted strategy based on user description and grounding documents
const strategyDraftSchema = z.object({
  tenantId: z.string(),
  prompt: z.string().min(10, "Please provide a more detailed description of the strategy you want to create"),
});

aiRouter.post("/strategy-draft/stream", requireAIChat, async (req: Request, res: Response) => {
  console.log("[Strategy Draft] Request received");
  try {
    const { tenantId, prompt } = strategyDraftSchema.parse(req.body);
    const user = (req as any).user;
    console.log("[Strategy Draft] User:", user.email, "Tenant:", tenantId);

    // Gather organizational context
    const [foundationResult, strategies] = await Promise.all([
      storage.getFoundationByTenantId(tenantId),
      storage.getStrategiesByTenantId(tenantId),
    ]);
    
    const foundation = foundationResult || null;

    console.log("[Strategy Draft] Context - Foundation:", !!foundation, 
      "Existing Strategies:", strategies.length);

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Stream the strategy draft
    const stream = streamStrategyDraft({
      tenantId,
      prompt,
      foundation,
      existingStrategies: strategies,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    console.log("[Strategy Draft] Stream completed, chunks:", chunkCount);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("[Strategy Draft] Error:", error.message || error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to generate strategy draft" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================
// MEETING RECAP PARSER
// ============================================

const meetingRecapSchema = z.object({
  meetingNotes: z.string().min(10, "Meeting notes must be at least 10 characters"),
  tenantId: z.string(),
  meetingTitle: z.string().optional(),
  meetingType: z.string().optional(),
  linkedOKRs: z.array(z.object({
    type: z.string(),
    title: z.string(),
  })).optional(),
});

aiRouter.post("/parse-meeting-recap", requireAIChat, async (req: Request, res: Response) => {
  try {
    const { meetingNotes, tenantId, meetingTitle, meetingType, linkedOKRs } = meetingRecapSchema.parse(req.body);
    
    console.log("[Meeting Recap] Parsing notes for meeting:", meetingTitle || "Untitled");
    console.log("[Meeting Recap] Notes length:", meetingNotes.length);

    const result = await parseMeetingRecap(meetingNotes, {
      tenantId,
      meetingTitle,
      meetingType,
      linkedOKRs,
    });

    console.log("[Meeting Recap] Parsed successfully:", {
      actionItems: result.actionItems.length,
      decisions: result.decisions.length,
      blockers: result.blockers.length,
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Meeting Recap] Error:", error.message || error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to parse meeting notes" });
  }
});

// ============================================
// MEETING AGENDA GENERATOR
// ============================================

const generateAgendaSchema = z.object({
  meetingType: z.string().min(1),
  meetingTitle: z.string().optional(),
  tenantId: z.string(),
  linkedOKRs: z.array(z.object({
    type: z.string(),
    title: z.string(),
    status: z.string().optional(),
    progress: z.number().optional(),
  })).optional(),
  atRiskItems: z.array(z.string()).optional(),
});

aiRouter.post("/generate-agenda", requireAIChat, async (req: Request, res: Response) => {
  try {
    const params = generateAgendaSchema.parse(req.body);
    console.log("[Meeting Agenda] Generating agenda for type:", params.meetingType, "| linked OKRs:", params.linkedOKRs?.length ?? 0);

    const result = await generateMeetingAgenda(params);

    console.log("[Meeting Agenda] Generated", result.agenda.length, "items. Theme:", result.focusTheme);
    res.json(result);
  } catch (error: any) {
    console.error("[Meeting Agenda] Error:", error.message || error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to generate agenda" });
  }
});

// ============================================
// OKR QUALITY SCORING
// ============================================

const okrQualityScoreSchema = z.object({
  objectiveTitle: z.string().min(3, "Objective title must be at least 3 characters"),
  objectiveDescription: z.string().optional(),
  keyResults: z.array(z.object({
    title: z.string(),
    target: z.number().optional(),
    current: z.number().optional(),
    unit: z.string().optional(),
  })).optional(),
  tenantId: z.string().optional(),
  alignedObjectives: z.array(z.string()).optional(),
});

aiRouter.post("/score-okr", requireAIChat, async (req: Request, res: Response) => {
  try {
    const input = okrQualityScoreSchema.parse(req.body);
    const user = (req as any).user;
    
    console.log("[OKR Quality Score] Request from:", user.email);
    console.log("[OKR Quality Score] Objective:", input.objectiveTitle);

    const result = await scoreOKRQuality({
      ...input,
      tenantId: input.tenantId || user.tenantId,
    });

    console.log("[OKR Quality Score] Score:", result.score);
    res.json(result);
  } catch (error: any) {
    console.error("[OKR Quality Score] Error:", error.message || error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to score OKR quality" });
  }
});

// ============================================
// AI USAGE TRACKING ROUTES
// ============================================

// Get AI usage summary for a tenant (tenant admin only)
aiRouter.get("/usage/summary", requireTenantAccess, async (req: Request, res: Response) => {
  try {
    const tenantId = (req.session as any).currentTenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }
    
    // Check if user has admin permission (tenant admin or higher)
    if (!hasPermission(req.user?.role as Role, PERMISSIONS.MANAGE_TENANT_SETTINGS)) {
      return res.status(403).json({ error: "Admin access required to view AI usage" });
    }

    const periodType = (req.query.periodType as 'daily' | 'monthly') || 'daily';
    const limit = parseInt(req.query.limit as string) || 30;

    // Get usage summaries for the tenant
    const summaries = await storage.getAiUsageSummaries(tenantId, periodType, limit);
    
    // Also get recent logs for detailed view
    const recentLogs = await storage.getAiUsageLogs(tenantId, undefined, undefined, 100);
    
    // Calculate current period stats from logs
    const now = new Date();
    const periodStart = new Date(now);
    if (periodType === 'daily') {
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    const currentPeriodLogs = recentLogs.filter(log => 
      new Date(log.createdAt) >= periodStart
    );

    const currentPeriodStats = {
      requests: currentPeriodLogs.length,
      totalTokens: currentPeriodLogs.reduce((sum, log) => sum + log.totalTokens, 0),
      estimatedCostMicrodollars: currentPeriodLogs.reduce((sum, log) => sum + (log.estimatedCostMicrodollars || 0), 0),
      byModel: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      byFeature: {} as Record<string, { requests: number; tokens: number; cost: number }>,
    };

    for (const log of currentPeriodLogs) {
      if (!currentPeriodStats.byModel[log.model]) {
        currentPeriodStats.byModel[log.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      currentPeriodStats.byModel[log.model].requests++;
      currentPeriodStats.byModel[log.model].tokens += log.totalTokens;
      currentPeriodStats.byModel[log.model].cost += log.estimatedCostMicrodollars || 0;

      if (!currentPeriodStats.byFeature[log.feature]) {
        currentPeriodStats.byFeature[log.feature] = { requests: 0, tokens: 0, cost: 0 };
      }
      currentPeriodStats.byFeature[log.feature].requests++;
      currentPeriodStats.byFeature[log.feature].tokens += log.totalTokens;
      currentPeriodStats.byFeature[log.feature].cost += log.estimatedCostMicrodollars || 0;
    }

    res.json({
      currentPeriod: currentPeriodStats,
      historicalSummaries: summaries,
      recentLogs: recentLogs.slice(0, 20),
    });
  } catch (error: any) {
    console.error("[AI Usage] Error fetching usage summary:", error.message || error);
    res.status(500).json({ error: error.message || "Failed to fetch AI usage summary" });
  }
});

// Get platform-wide AI usage (platform admins only)
aiRouter.get("/usage/platform", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Check if user has platform admin permission
    if (!hasPermission(req.user.role as Role, PERMISSIONS.MANAGE_PLATFORM)) {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    const periodType = (req.query.periodType as 'daily' | 'monthly') || 'daily';
    
    // Get current period start
    const now = new Date();
    const periodStart = new Date(now);
    if (periodType === 'daily') {
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    const summary = await storage.getPlatformAiUsageSummary(periodType, periodStart);
    
    // Transform byTenant array to Record format expected by frontend
    const byTenantRecord: Record<string, { requests: number; tokens: number; cost: number; tenantName?: string }> = {};
    for (const tenant of summary.byTenant) {
      byTenantRecord[tenant.tenantId] = {
        requests: tenant.requests,
        tokens: tenant.tokens,
        cost: tenant.cost,
        tenantName: tenant.tenantName,
      };
    }
    
    res.json({
      periodType,
      periodStart,
      totalRequests: summary.totalRequests,
      totalTokens: summary.totalTokens,
      totalCostMicrodollars: summary.totalCostMicrodollars,
      byTenant: byTenantRecord,
      byModel: summary.byModel,
      byProvider: summary.byProvider,
      estimatedCostDollars: summary.totalCostMicrodollars / 1000000,
    });
  } catch (error: any) {
    console.error("[AI Usage] Error fetching platform usage:", error.message || error);
    res.status(500).json({ error: error.message || "Failed to fetch platform AI usage" });
  }
});

// ============================================
// MODEL COMPARISON (platform admins only)
// ============================================

aiRouter.get("/usage/model-comparison", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!hasPermission(req.user.role as Role, PERMISSIONS.MANAGE_PLATFORM)) {
      return res.status(403).json({ error: "Platform admin access required" });
    }

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const { aiUsageLogs } = await import("@shared/schema");
    const { db } = await import("./db");
    const { sql, and, gte } = await import("drizzle-orm");

    const logs = await db
      .select()
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, startDate));

    const modelStats: Record<string, {
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalCostMicrodollars: number;
      totalLatencyMs: number;
      latencyCount: number;
      errors: number;
      byDay: Record<string, { requests: number; tokens: number; cost: number; avgLatency: number; latencyCount: number }>;
    }> = {};

    for (const log of logs) {
      const model = log.model;
      if (!modelStats[model]) {
        modelStats[model] = {
          requests: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0,
          totalCostMicrodollars: 0, totalLatencyMs: 0, latencyCount: 0, errors: 0, byDay: {},
        };
      }
      const s = modelStats[model];
      s.requests++;
      s.totalTokens += log.totalTokens;
      s.promptTokens += log.promptTokens;
      s.completionTokens += log.completionTokens;
      s.totalCostMicrodollars += log.estimatedCostMicrodollars || 0;
      if (log.latencyMs) { s.totalLatencyMs += log.latencyMs; s.latencyCount++; }
      if (log.errorCode) s.errors++;

      const dayKey = new Date(log.createdAt).toISOString().split('T')[0];
      if (!s.byDay[dayKey]) {
        s.byDay[dayKey] = { requests: 0, tokens: 0, cost: 0, avgLatency: 0, latencyCount: 0 };
      }
      s.byDay[dayKey].requests++;
      s.byDay[dayKey].tokens += log.totalTokens;
      s.byDay[dayKey].cost += log.estimatedCostMicrodollars || 0;
      if (log.latencyMs) {
        s.byDay[dayKey].avgLatency += log.latencyMs;
        s.byDay[dayKey].latencyCount++;
      }
    }

    const models = Object.entries(modelStats).map(([model, stats]) => {
      const dailyData = Object.entries(stats.byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          requests: d.requests,
          tokens: d.tokens,
          cost: d.cost,
          avgLatency: d.latencyCount > 0 ? Math.round(d.avgLatency / d.latencyCount) : 0,
        }));

      return {
        model,
        requests: stats.requests,
        totalTokens: stats.totalTokens,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        totalCostMicrodollars: stats.totalCostMicrodollars,
        avgLatencyMs: stats.latencyCount > 0 ? Math.round(stats.totalLatencyMs / stats.latencyCount) : 0,
        avgTokensPerRequest: stats.requests > 0 ? Math.round(stats.totalTokens / stats.requests) : 0,
        costPerRequest: stats.requests > 0 ? Math.round(stats.totalCostMicrodollars / stats.requests) : 0,
        errorRate: stats.requests > 0 ? Number(((stats.errors / stats.requests) * 100).toFixed(1)) : 0,
        errors: stats.errors,
        dailyData,
      };
    }).sort((a, b) => b.requests - a.requests);

    res.json({ days, startDate, models });
  } catch (error: any) {
    console.error("[AI Usage] Error fetching model comparison:", error.message || error);
    res.status(500).json({ error: error.message || "Failed to fetch model comparison data" });
  }
});

// ============================================
// CHECK-IN NOTE REWRITING
// ============================================

const checkInRewriteSchema = z.object({
  keyResultId: z.string().optional(),
  bigRockId: z.string().optional(),
  objectiveId: z.string().optional(),
  originalNote: z.string().min(1, "Original note is required"),
  newValue: z.number().optional(),
  newProgress: z.number().optional(),
  mode: z.enum(["full", "clarity", "concise", "expand"]).default("full"),
  entityType: z.enum(["key_result", "big_rock", "objective"]).default("key_result"),
});

aiRouter.post("/rewrite-checkin", requireAIChat, async (req: Request, res: Response) => {
  try {
    const input = checkInRewriteSchema.parse(req.body);
    const user = (req as any).user;
    const tenantId = (req.session as any).currentTenantId || user.tenantId;
    
    console.log("[Check-in Rewrite] Request from:", user.email);
    console.log("[Check-in Rewrite] Mode:", input.mode);
    console.log("[Check-in Rewrite] Entity type:", input.entityType);

    let context: any = {};
    
    if (input.entityType === "key_result" && input.keyResultId) {
      const keyResult = await storage.getKeyResultById(input.keyResultId);
      if (keyResult) {
        context.krTitle = keyResult.title;
        context.krDescription = keyResult.description;
        context.targetValue = keyResult.targetValue || 100;
        context.startValue = keyResult.initialValue || 0;
        context.currentValue = keyResult.currentValue || 0;
        context.unit = keyResult.unit || "";
        context.metricType = keyResult.metricType || "number";
        context.progress = keyResult.progress || 0;
        
        if (keyResult.objectiveId) {
          const objective = await storage.getObjectiveById(keyResult.objectiveId);
          if (objective) {
            context.objectiveTitle = objective.title;
            context.objectiveDescription = objective.description;
            context.quarter = objective.quarter;
            context.year = objective.year;
          }
        }
      }
    } else if (input.entityType === "big_rock" && input.bigRockId) {
      const bigRock = await storage.getBigRockById(input.bigRockId);
      if (bigRock) {
        context.title = bigRock.title;
        context.description = bigRock.description;
        context.progress = bigRock.completionPercentage || 0;
        context.status = bigRock.status;
        
        if (bigRock.objectiveId) {
          const objective = await storage.getObjectiveById(bigRock.objectiveId);
          if (objective) {
            context.objectiveTitle = objective.title;
            context.quarter = objective.quarter;
            context.year = objective.year;
          }
        }
      }
    } else if (input.entityType === "objective" && input.objectiveId) {
      const objective = await storage.getObjectiveById(input.objectiveId);
      if (objective) {
        context.title = objective.title;
        context.description = objective.description;
        context.progress = objective.progress || 0;
        context.status = objective.status;
        context.quarter = objective.quarter;
        context.year = objective.year;
        if (objective.parentId) {
          const parent = await storage.getObjectiveById(objective.parentId);
          if (parent) context.parentTitle = parent.title;
        }
      }
    }

    const now = new Date();
    const quarterEnd = context.quarter && context.year 
      ? new Date(context.year, context.quarter * 3, 0) 
      : null;
    const daysRemaining = quarterEnd 
      ? Math.max(0, Math.ceil((quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const progressDelta = input.newProgress !== undefined && context.progress !== undefined
      ? input.newProgress - context.progress
      : (input.newValue !== undefined && context.currentValue !== undefined 
          ? ((input.newValue - context.currentValue) / Math.max(1, context.targetValue - context.startValue) * 100)
          : 0);

    const modeInstructions = {
      full: "Provide a professional, detailed rewrite that includes context about progress toward the goal. Be specific and data-driven.",
      clarity: "Improve grammar, structure, and clarity while keeping the original meaning. Don't add new information.",
      concise: "Shorten the note while preserving the key points. Make it punchy and scannable.",
      expand: "Expand the note by adding relevant context about progress, timeline, and next steps based on the data provided.",
    };

    const systemPrompt = `You are a professional writing assistant that rewrites OKR check-in notes.

Your task: Rewrite the provided check-in note to be more professional and effective.

Style guidelines:
- ${modeInstructions[input.mode]}
- Keep notes brief (1-3 sentences)
- Be professional but conversational
- Use data when available

CRITICAL: Output ONLY the rewritten note text. No explanations, no quotes, no preamble.`;

    let userPrompt: string;

    if (input.entityType === "key_result") {
      // Calculate actual progress from newValue if provided (for key results)
      let displayProgress: number;
      if (input.newValue !== undefined && context.targetValue) {
        const startValue = context.startValue || 0;
        const range = context.targetValue - startValue;
        displayProgress = range > 0 ? Math.round(((input.newValue - startValue) / range) * 100) : 0;
      } else {
        displayProgress = input.newProgress || context.progress || 0;
      }
      
      // Calculate expected progress based on period timing
      let expectedProgress: number | null = null;
      let paceStatus: string = "";
      if (context.quarter && context.year) {
        const periodStart = new Date(context.year, (context.quarter - 1) * 3, 1);
        const periodEnd = new Date(context.year, context.quarter * 3, 0);
        const totalDays = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(0, (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        expectedProgress = Math.round((daysElapsed / totalDays) * 100);
        
        // Determine pace status
        const progressDiff = displayProgress - expectedProgress;
        if (progressDiff >= 10) {
          paceStatus = "ahead of pace";
        } else if (progressDiff >= -10) {
          paceStatus = "on pace";
        } else if (progressDiff >= -25) {
          paceStatus = "slightly behind pace";
        } else {
          paceStatus = "behind pace";
        }
      }
      
      userPrompt = `Context:
- Key Result: ${context.krTitle || "Unknown"}
- Target: ${context.targetValue || 100} ${context.unit || ""}
- Current Value: ${input.newValue !== undefined ? input.newValue : context.currentValue || 0} ${context.unit || ""}
- Progress: ${displayProgress}%${expectedProgress !== null ? ` (expected at this point in the period: ${expectedProgress}%)` : ""}${paceStatus ? `\n- Pace: ${paceStatus}` : ""}
${context.objectiveTitle ? `- Objective: ${context.objectiveTitle}` : ""}

Original note to rewrite:
"${input.originalNote}"`;
    } else if (input.entityType === "objective") {
      userPrompt = `Context:
- Objective: ${context.title || "Unknown"}
- Status: ${context.status || "unknown"}
- Progress: ${input.newProgress || context.progress || 0}%
${context.parentTitle ? `- Parent Objective: ${context.parentTitle}` : ""}

Original note to rewrite:
"${input.originalNote}"`;
    } else {
      userPrompt = `Context:
- Big Rock: ${context.title || "Unknown"}
- Status: ${context.status || "unknown"}
- Completion: ${input.newProgress || context.progress || 0}%
${context.objectiveTitle ? `- Objective: ${context.objectiveTitle}` : ""}

Original note to rewrite:
"${input.originalNote}"`;
    }

    console.log("[Check-in Rewrite] Calling AI with system prompt length:", systemPrompt.length);
    console.log("[Check-in Rewrite] User prompt:", userPrompt);
    
    const result = await getSimpleCompletion(
      systemPrompt,
      userPrompt,
      { tenantId, maxTokens: 1000 },  // Increased for GPT-5 reasoning tokens
      AI_FEATURES.CHECK_IN_REWRITE
    );

    console.log("[Check-in Rewrite] Raw AI result:", result);
    const cleanedResult = result.replace(/^["']|["']$/g, '').trim();

    console.log("[Check-in Rewrite] Success, original length:", input.originalNote.length, "rewritten length:", cleanedResult.length);

    res.json({
      rewrittenNote: cleanedResult,
      mode: input.mode,
    });
  } catch (error: any) {
    console.error("[Check-in Rewrite] Error:", error.message || error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to rewrite check-in note" });
  }
});

aiRouter.post("/parent-objective-checkin-draft", requireAIChat, async (req: Request, res: Response) => {
  try {
    const { objectiveId, includeBigRocks } = req.body;
    const user = (req as any).user;
    const tenantId = (req.session as any).currentTenantId || user.tenantId;

    if (!objectiveId) {
      return res.status(400).json({ error: "objectiveId is required" });
    }

    const objective = await storage.getObjectiveById(objectiveId);
    if (!objective || objective.tenantId !== tenantId) {
      return res.status(404).json({ error: "Objective not found" });
    }

    const childObjectives = await storage.getChildObjectives(objectiveId);
    const directKeyResults = await storage.getKeyResultsByObjectiveId(objectiveId);

    const childObjectivesWithKRs = await Promise.all(
      childObjectives.map(async (child) => {
        const krs = await storage.getKeyResultsByObjectiveId(child.id);
        return {
          title: child.title,
          progress: child.progress || 0,
          status: child.status || 'not_started',
          keyResults: krs.map(kr => ({
            title: kr.title,
            currentValue: kr.currentValue || 0,
            targetValue: kr.targetValue || 0,
            unit: kr.unit || undefined,
            progress: kr.progress || 0,
            status: kr.status || 'not_started',
            lastCheckInNote: kr.lastCheckInNote || null,
          })),
        };
      })
    );

    const directKRData = directKeyResults.map(kr => ({
      title: kr.title,
      currentValue: kr.currentValue || 0,
      targetValue: kr.targetValue || 0,
      unit: kr.unit || undefined,
      progress: kr.progress || 0,
      status: kr.status || 'not_started',
      lastCheckInNote: kr.lastCheckInNote || null,
    }));

    let bigRockData: any[] | undefined;
    if (includeBigRocks) {
      const linkedBigRocks = await storage.getBigRocksLinkedToObjective(objectiveId);
      const inProgressRocks = linkedBigRocks.filter(br =>
        (br.completionPercentage || 0) < 100 &&
        br.quarter === objective.quarter &&
        br.year === objective.year
      );

      if (inProgressRocks.length > 0) {
        const bigRockIds = inProgressRocks.map(br => br.id);
        const taskCounts = await storage.getBigRockTaskCountsByBigRockIds(bigRockIds);

        bigRockData = inProgressRocks.map(br => {
          const counts = taskCounts.get(br.id);
          return {
            title: br.title,
            completionPercentage: br.completionPercentage || 0,
            status: br.status || 'not-started',
            taskCount: counts?.total || 0,
            completedTaskCount: counts?.completed || 0,
          };
        });
      }
    }

    const { generateParentObjectiveCheckInSummary } = await import('./ai');

    const draft = await generateParentObjectiveCheckInSummary({
      tenantId,
      objective: {
        title: objective.title,
        description: objective.description,
        progress: objective.progress || 0,
        status: objective.status || 'not_started',
        quarter: objective.quarter || 1,
        year: objective.year || new Date().getFullYear(),
      },
      childObjectives: childObjectivesWithKRs,
      keyResults: directKRData,
      bigRocks: bigRockData,
    });

    res.json({
      draft,
      childCount: childObjectives.length,
      keyResultCount: directKeyResults.length,
      bigRockCount: bigRockData?.length || 0,
    });
  } catch (error: any) {
    console.error("[Parent Objective Check-in Draft] Error:", error.message || error);
    res.status(500).json({ error: error.message || "Failed to generate check-in draft" });
  }
});

// Narrative Update Parser endpoint
interface NarrativeSuggestion {
  entityType: 'objective' | 'key_result' | 'big_rock';
  entityId: string;
  entityTitle: string;
  suggestedValue: number | null;
  suggestedProgress: number | null;
  suggestedStatus: string | null;
  note: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const narrativeUpdateSchema = z.object({
  text: z.string().min(1),
  tenantId: z.string().optional(), // Ignored server-side; tenant derived from session via requireTenantAccess
  quarter: z.number().optional(),
  year: z.number().optional(),
});

aiRouter.post("/parse-narrative-update", requireAIChat, requireTenantAccess, async (req: Request, res: Response) => {
  try {
    const { text, quarter, year } = narrativeUpdateSchema.parse(req.body);

    // Use the session-resolved tenant (validated by requireTenantAccess middleware)
    const tenantId = req.effectiveTenantId || (req.session as any).currentTenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: "No tenant context available" });
    }

    // Fetch current OKRs and Big Rocks for the tenant/period
    const [objectives, keyResults, bigRocks] = await Promise.all([
      storage.getObjectivesByTenantId(tenantId, quarter, year),
      storage.getKeyResultsByTenantId(tenantId, quarter, year),
      storage.getBigRocksByTenantId(tenantId, quarter, year),
    ]);

    // Build entity context for the prompt
    // Keep entity context lean — omit verbose descriptions to reduce prompt token usage.
    // Reasoning models (e.g. GPT-5) consume tokens internally; we need headroom for output.
    const objectiveList = objectives.map(o => ({
      type: 'objective',
      id: o.id,
      title: o.title,
      progress: o.progress,
      status: o.status,
    }));

    const keyResultList = keyResults.map(kr => ({
      type: 'key_result',
      id: kr.id,
      title: kr.title,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      unit: kr.unit || '',
      progress: kr.progress,
      status: kr.status,
      metricType: kr.metricType,
    }));

    const bigRockList = bigRocks.map(br => ({
      type: 'big_rock',
      id: br.id,
      title: br.title,
      completionPercentage: br.completionPercentage,
      status: br.status,
    }));

    const allEntities = [...objectiveList, ...keyResultList, ...bigRockList];

    const systemPrompt = `You are an OKR progress assistant. Your job is to analyze a narrative text (such as an executive report, team recap, or meeting notes) and identify which existing OKRs (Objectives, Key Results) and Big Rocks are mentioned or implied, then suggest check-in updates for each.

You must only suggest updates for existing entities — never suggest creating new ones.

For each match, extract:
- Which entity it refers to (by semantic match to entity title/description)
- The updated value or progress percentage (if mentioned)
- A suggested status (not_started, on_track, behind, at_risk, completed)
- A concise pre-written check-in note summarizing what was reported
- Your confidence level (high, medium, low)
- Brief reasoning for the match

Return a JSON array of suggestions. Each suggestion must have:
{
  "entityType": "objective" | "key_result" | "big_rock",
  "entityId": "<id from entity list>",
  "entityTitle": "<entity title>",
  "suggestedValue": <number or null>,
  "suggestedProgress": <0-100 or null>,
  "suggestedStatus": "<status string or null>",
  "note": "<concise check-in note>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<why you matched this>"
}

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.`;

    const userMessage = `Here are the existing OKRs and Big Rocks (JSON, compact):

${JSON.stringify(allEntities)}

Here is the narrative text to analyze:

---
${text}
---

Return JSON array of suggested check-in updates for matched entities only. Do not invent entity IDs — only use IDs from the list above.`;

    // Use a high maxTokens budget: reasoning models (GPT-5) consume tokens internally for
    // chain-of-thought before producing output. 3000 is insufficient — all tokens get used
    // on reasoning, leaving nothing for the JSON response. 16000 gives ample headroom.
    const rawResponse = await getSimpleCompletion(
      systemPrompt,
      userMessage,
      { tenantId, maxTokens: 16000 },
      AI_FEATURES.CHAT
    );

    // Parse the JSON response
    let rawSuggestions: unknown[] = [];
    try {
      const cleaned = rawResponse.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const parsed: unknown = JSON.parse(cleaned);
      if (Array.isArray(parsed)) rawSuggestions = parsed;
    } catch (parseErr) {
      console.error("[parse-narrative-update] Failed to parse AI response:", rawResponse);
      rawSuggestions = [];
    }

    // Zod schema to validate each individual suggestion from the AI
    const suggestionItemSchema = z.object({
      entityType: z.enum(['objective', 'key_result', 'big_rock']),
      entityId: z.string(),
      entityTitle: z.string(),
      suggestedValue: z.number().nullable().optional().default(null),
      suggestedProgress: z.number().nullable().optional().default(null),
      suggestedStatus: z.string().nullable().optional().default(null),
      note: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    });

    // Build entity lookup map for strict (id, type) pair validation
    const entityMap = new Map(allEntities.map(e => [e.id, e.type]));

    const suggestions: NarrativeSuggestion[] = rawSuggestions
      .map((item): NarrativeSuggestion | null => {
        const parsed = suggestionItemSchema.safeParse(item);
        if (!parsed.success) return null;
        const s = parsed.data;
        // Enforce that entityId and entityType match the actual entity
        const actualType = entityMap.get(s.entityId);
        if (!actualType || actualType !== s.entityType) return null;
        return {
          entityType: s.entityType,
          entityId: s.entityId,
          entityTitle: s.entityTitle,
          suggestedValue: s.suggestedValue ?? null,
          suggestedProgress: s.suggestedProgress ?? null,
          suggestedStatus: s.suggestedStatus ?? null,
          note: s.note,
          confidence: s.confidence,
          reasoning: s.reasoning,
        };
      })
      .filter((s): s is NarrativeSuggestion => s !== null);

    res.json({ suggestions });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request format", details: error.errors });
    }
    const msg = error instanceof Error ? error.message : "Failed to parse narrative update";
    console.error("[parse-narrative-update] Error:", msg);
    res.status(500).json({ error: msg });
  }
});
