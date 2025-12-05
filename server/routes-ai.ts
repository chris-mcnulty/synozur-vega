import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { insertGroundingDocumentSchema } from "@shared/schema";
import { getChatCompletion, streamChatCompletion, generateOKRSuggestions, suggestBigRocks, streamProgressSummary, streamGoalSuggestions, streamStrategyDraft, type ChatMessage, type ProgressSummaryData, type GoalSuggestionContext, type StrategyDraftContext } from "./ai";
import { z } from "zod";

export const aiRouter = Router();

// Middleware to check if user is admin (for grounding documents management)
async function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  // Check if user has admin-level role
  const adminRoles = ["admin", "global_admin", "vega_admin", "vega_consultant"];
  if (!adminRoles.includes(user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  (req as any).user = user;
  next();
}

// Simple auth check for regular users
async function requireAuth(req: Request, res: Response, next: Function) {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  (req as any).user = user;
  next();
}

// ============================================
// FILE PARSING ROUTES (Admin Only)
// ============================================

// Parse PDF file and extract text
aiRouter.post("/parse-pdf", requireAdmin, async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const data = await pdfParse(buffer);
        res.json({ text: data.text });
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
aiRouter.post("/parse-docx", requireAdmin, async (req: Request, res: Response) => {
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
aiRouter.get("/grounding-documents", requireAdmin, async (req: Request, res: Response) => {
  try {
    const documents = await storage.getAllGroundingDocuments();
    res.json(documents);
  } catch (error) {
    console.error("Error fetching grounding documents:", error);
    res.status(500).json({ error: "Failed to fetch grounding documents" });
  }
});

// Get single grounding document
aiRouter.get("/grounding-documents/:id", requireAdmin, async (req: Request, res: Response) => {
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
aiRouter.post("/grounding-documents", requireAdmin, async (req: Request, res: Response) => {
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
aiRouter.patch("/grounding-documents/:id", requireAdmin, async (req: Request, res: Response) => {
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
aiRouter.delete("/grounding-documents/:id", requireAdmin, async (req: Request, res: Response) => {
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

aiRouter.post("/chat", requireAuth, async (req: Request, res: Response) => {
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

// Streaming chat endpoint (Server-Sent Events)
aiRouter.post("/chat/stream", requireAuth, async (req: Request, res: Response) => {
  console.log("[AI Chat Stream] Request received");
  try {
    const { messages, tenantId } = chatRequestSchema.parse(req.body);
    const user = (req as any).user;
    console.log("[AI Chat Stream] User:", user.email, "Messages count:", messages.length);
    
    // Use user's tenant if not specified
    const effectiveTenantId = tenantId || user.tenantId;
    console.log("[AI Chat Stream] Tenant ID:", effectiveTenantId);

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log("[AI Chat Stream] Starting stream...");
    const stream = streamChatCompletion(messages as ChatMessage[], {
      tenantId: effectiveTenantId,
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

// OKR suggestions endpoint
const okrSuggestionSchema = z.object({
  tenantId: z.string(),
  focusArea: z.string().optional(),
  quarter: z.number().optional(),
  year: z.number().optional(),
});

aiRouter.post("/suggest/okrs", requireAuth, async (req: Request, res: Response) => {
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

aiRouter.post("/suggest/big-rocks", requireAuth, async (req: Request, res: Response) => {
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

aiRouter.post("/progress-summary/stream", requireAuth, async (req: Request, res: Response) => {
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

aiRouter.post("/suggest/goals/stream", requireAuth, async (req: Request, res: Response) => {
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

aiRouter.post("/strategy-draft/stream", requireAuth, async (req: Request, res: Response) => {
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
