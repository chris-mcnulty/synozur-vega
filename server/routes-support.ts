import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { loadCurrentUser, requireTenantAccess } from "./middleware/rbac";
import { hasPermission, PERMISSIONS, Role } from "@shared/rbac";
import { z } from "zod";
import { sendSupportTicketAcknowledgement, sendSupportTicketInternalNotification } from "./email";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@shared/schema";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

export const supportRouter = Router();

supportRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
});

supportRouter.use(loadCurrentUser);

const isAdminRole = (role: string): boolean => {
  return role === "vega_admin" || role === "vega_consultant";
};

const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  metadata: z.record(z.any()).optional(),
});

const createReplySchema = z.object({
  message: z.string().min(1),
  isInternal: z.boolean().optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedTo: z.string().optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
});

supportRouter.post("/tickets", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const { category, subject, description, priority, metadata } = parsed.data;

    const ticket = await storage.createSupportTicket({
      tenantId: req.user.tenantId!,
      userId: req.user.id,
      category,
      subject,
      description,
      priority,
      metadata: metadata || null,
    });

    try {
      await sendSupportTicketAcknowledgement(
        req.user.email,
        req.user.firstName || req.user.email,
        ticket.ticketNumber,
        ticket.subject,
        ticket.category,
        ticket.priority
      );
    } catch (emailErr) {
      console.error("Failed to send ticket acknowledgement email:", emailErr);
    }

    try {
      const adminUsers = await storage.getVegaAdminUsers();
      const tenant = await storage.getTenantById(req.user.tenantId!);
      for (const admin of adminUsers) {
        try {
          await sendSupportTicketInternalNotification(
            admin.email,
            ticket.ticketNumber,
            `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
            req.user.email,
            tenant?.name || 'Unknown',
            ticket.category,
            ticket.priority,
            ticket.subject,
            ticket.description
          );
        } catch (e) { /* individual email failure ok */ }
      }
    } catch (emailErr) {
      console.error("Failed to send internal ticket notification:", emailErr);
    }

    return res.status(201).json(ticket);
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return res.status(500).json({ error: "Failed to create support ticket" });
  }
});

supportRouter.get("/tickets", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (isAdminRole(req.user.role)) {
      const { status, priority, category, tenantId } = req.query as Record<string, string | undefined>;
      const tickets = await storage.getAllSupportTickets({
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        tenantId: tenantId || undefined,
      });
      return res.json(tickets);
    }

    const tickets = await storage.getSupportTicketsByUserId(req.user.id);
    return res.json(tickets);
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return res.status(500).json({ error: "Failed to fetch support tickets" });
  }
});

supportRouter.get("/tickets/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const isOwner = ticket.userId === req.user.id;
    const isAdmin = isAdminRole(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const replies = await storage.getSupportTicketReplies(ticket.id, isAdmin);
    const author = await storage.getUser(ticket.userId);
    const tenant = await storage.getTenantById(ticket.tenantId);

    return res.json({
      ...ticket,
      replies,
      author: author ? { id: author.id, email: author.email, firstName: author.firstName, lastName: author.lastName } : null,
      tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
    });
  } catch (error) {
    console.error("Error fetching support ticket:", error);
    return res.status(500).json({ error: "Failed to fetch support ticket" });
  }
});

supportRouter.post("/tickets/:id/replies", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = createReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const isOwner = ticket.userId === req.user.id;
    const isAdmin = isAdminRole(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { message, isInternal } = parsed.data;

    const reply = await storage.createSupportTicketReply({
      ticketId: ticket.id,
      userId: req.user.id,
      message,
      isInternal: isAdmin && isInternal ? true : false,
    });

    return res.status(201).json(reply);
  } catch (error) {
    console.error("Error creating ticket reply:", error);
    return res.status(500).json({ error: "Failed to create ticket reply" });
  }
});

supportRouter.patch("/tickets/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const updates: any = { ...parsed.data };

    if (updates.status === "resolved") {
      updates.resolvedAt = new Date();
      updates.resolvedBy = req.user.id;
    }

    const updated = await storage.updateSupportTicket(ticket.id, updates);
    return res.json(updated);
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return res.status(500).json({ error: "Failed to update support ticket" });
  }
});

let cachedUserGuide: string | null = null;

function getUserGuideContent(): string {
  if (cachedUserGuide) return cachedUserGuide;
  try {
    const guidePath = path.resolve(process.cwd(), "USER_GUIDE.md");
    const content = fs.readFileSync(guidePath, "utf-8");
    cachedUserGuide = content.substring(0, 30000);
    return cachedUserGuide;
  } catch {
    return "No user guide available.";
  }
}

const helpChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

supportRouter.post("/help/chat/stream", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = helpChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    const { messages } = parsed.data;
    const userGuide = getUserGuideContent();

    const systemPrompt = `You are the Vega Help Assistant, a friendly and knowledgeable support chatbot for the Vega platform (Company OS by Synozur Alliance). Your role is to help users understand how to use the platform, troubleshoot issues, and answer questions.

## Your Knowledge Base (User Guide)
${userGuide}

## Guidelines
- Be concise, friendly, and helpful
- Reference specific features and navigation paths when explaining how to do something
- If a user's question is about something not covered in the user guide, let them know you may not have the answer and suggest they submit a support ticket for further assistance
- Never make up features or capabilities that aren't in the guide
- When describing navigation, use clear step-by-step instructions
- If the user seems frustrated or has a complex issue you can't resolve, suggest they open a support ticket for personalized assistance from the Vega team
- Do not discuss pricing, billing, or account-specific details
- Format responses with markdown for readability`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const fullMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      messages: fullMessages,
      max_completion_tokens: 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Help chat error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream help response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});
