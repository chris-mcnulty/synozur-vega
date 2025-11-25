import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { insertGroundingDocumentSchema } from "@shared/schema";
import { getChatCompletion, streamChatCompletion, generateOKRSuggestions, suggestBigRocks, type ChatMessage } from "./ai";
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
  try {
    const { messages, tenantId } = chatRequestSchema.parse(req.body);
    const user = (req as any).user;
    
    // Use user's tenant if not specified
    const effectiveTenantId = tenantId || user.tenantId;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = streamChatCompletion(messages as ChatMessage[], {
      tenantId: effectiveTenantId,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Error in AI chat stream:", error);
    if (!res.headersSent) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to stream AI response" });
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
