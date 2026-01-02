import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertGroundingDocumentSchema } from "@shared/schema";
import { getChatCompletion, streamChatCompletion, streamChatWithTools, generateOKRSuggestions, suggestBigRocks, streamProgressSummary, streamGoalSuggestions, streamStrategyDraft, parseMeetingRecap, scoreOKRQuality, type ChatMessage, type ProgressSummaryData, type GoalSuggestionContext, type StrategyDraftContext, type MeetingRecapResult, type OKRQualityScoreResult } from "./ai";
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

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Prepare the summary data
    const summaryData: ProgressSummaryData = {
      objectives: parsed.objectives,
      checkIns: allCheckIns,
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
