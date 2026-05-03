import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { loadCurrentUser, requireTenantAccess } from "./middleware/rbac";
import { hasPermission, PERMISSIONS, Role } from "@shared/rbac";
import { z } from "zod";
import { sendSupportTicketAcknowledgement, sendSupportTicketInternalNotification, sendSupportTicketReplyNotification } from "./email";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, type SupportTicket, type SupportTicketHistory } from "@shared/schema";
import { createNotification, isEmailEnabled } from "./services/notification-service";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

type HistoryUserSummary = { id: string; firstName: string | null; lastName: string | null; email: string };
type HistoryWithUser = SupportTicketHistory & { user: HistoryUserSummary | null };
type TicketUpdates = Partial<Pick<SupportTicket, "status" | "priority" | "assignedTo" | "category" | "resolvedAt" | "resolvedBy">>;
type TrackedField = "status" | "priority" | "assignedTo" | "category";

async function buildHistoryWithUsers(history: SupportTicketHistory[]): Promise<HistoryWithUser[]> {
  if (history.length === 0) return [];
  const userIds = Array.from(new Set(history.map((h) => h.userId).filter((u): u is string => !!u)));
  const userMap = new Map<string, HistoryUserSummary>();
  for (const uid of userIds) {
    const u = await storage.getUser(uid);
    if (u) userMap.set(uid, { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email });
  }
  return history.map((h) => ({ ...h, user: h.userId ? userMap.get(h.userId) || null : null }));
}

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

const bulkUpdateSchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedTo: z.string().nullable().optional(),
}).refine((d) => d.status !== undefined || d.priority !== undefined || d.assignedTo !== undefined, {
  message: "At least one of status, priority, or assignedTo must be provided",
});

supportRouter.get("/staff", async (req: Request, res: Response) => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const staffUsers = await storage.getVegaAdminUsers();
    return res.json(staffUsers.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    })));
  } catch (error) {
    console.error("Error fetching staff users:", error);
    return res.status(500).json({ error: "Failed to fetch staff users" });
  }
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
          const emailOk = await isEmailEnabled(admin.id, 'support_reply');
          if (emailOk) {
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
          }
        } catch (e) { /* individual email failure ok */ }
        await createNotification({
          tenantId: admin.tenantId || ticket.tenantId,
          userId: admin.id,
          type: 'support_reply',
          title: `New support ticket #${ticket.ticketNumber}`,
          body: `${tenant?.name || 'Tenant'} — ${ticket.subject}`,
          entityType: 'support_ticket',
          entityId: ticket.id,
          linkUrl: `/support?ticketId=${ticket.id}`,
        });
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
      const { status, priority, category, tenantId, assignedTo, q } = req.query as Record<string, string | undefined>;
      const search = (q || "").trim();

      if (status === "pending") {
        const openTickets = await storage.searchAdminSupportTickets({
          q: search || undefined,
          status: "open",
          priority: priority || undefined,
          category: category || undefined,
          tenantId: tenantId || undefined,
          assignedTo: assignedTo || undefined,
        });
        const inProgressTickets = await storage.searchAdminSupportTickets({
          q: search || undefined,
          status: "in_progress",
          priority: priority || undefined,
          category: category || undefined,
          tenantId: tenantId || undefined,
          assignedTo: assignedTo || undefined,
        });
        const combined = [...openTickets, ...inProgressTickets].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return res.json(combined);
      }

      const tickets = await storage.searchAdminSupportTickets({
        q: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        tenantId: tenantId || undefined,
        assignedTo: assignedTo || undefined,
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
    const history = isAdmin ? await storage.getSupportTicketHistory(ticket.id) : [];
    const historyWithUsers = await buildHistoryWithUsers(history);

    return res.json({
      ...ticket,
      replies,
      history: historyWithUsers,
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

    const replierName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const isInternalNote = isAdmin && isInternal;

    if (!isInternalNote) {
      try {
        if (isAdmin) {
          const ticketAuthor = await storage.getUser(ticket.userId);
          if (ticketAuthor) {
            const emailOk = await isEmailEnabled(ticketAuthor.id, 'support_reply');
            if (emailOk) {
              await sendSupportTicketReplyNotification(
                ticketAuthor.email,
                ticketAuthor.firstName || ticketAuthor.email,
                ticket.ticketNumber,
                ticket.subject,
                replierName,
                message,
                'staff_to_user'
              );
            }
            await createNotification({
              tenantId: ticket.tenantId,
              userId: ticketAuthor.id,
              type: 'support_reply',
              title: `New reply on ticket #${ticket.ticketNumber}`,
              body: `${replierName}: ${message.slice(0, 160)}${message.length > 160 ? '…' : ''}`,
              entityType: 'support_ticket',
              entityId: ticket.id,
              linkUrl: `/support?ticketId=${ticket.id}`,
            });
          }
        } else {
          const staffUsers = await storage.getVegaAdminUsers();
          const recipients: { id: string; tenantId: string; email: string; name: string }[] = [];
          if (ticket.assignedTo) {
            const assignee = staffUsers.find(u => u.id === ticket.assignedTo);
            if (assignee) {
              recipients.push({ id: assignee.id, tenantId: assignee.tenantId || ticket.tenantId, email: assignee.email, name: assignee.name || assignee.email });
            }
          }
          if (recipients.length === 0) {
            for (const admin of staffUsers) {
              recipients.push({ id: admin.id, tenantId: admin.tenantId || ticket.tenantId, email: admin.email, name: admin.name || admin.email });
            }
          }
          for (const r of recipients) {
            try {
              const emailOk = await isEmailEnabled(r.id, 'support_reply');
              if (emailOk) {
                await sendSupportTicketReplyNotification(
                  r.email,
                  r.name,
                  ticket.ticketNumber,
                  ticket.subject,
                  replierName,
                  message,
                  'user_to_staff'
                );
              }
            } catch (e) { /* individual email failure ok */ }
            await createNotification({
              tenantId: r.tenantId,
              userId: r.id,
              type: 'support_reply',
              title: `User replied on ticket #${ticket.ticketNumber}`,
              body: `${replierName}: ${message.slice(0, 160)}${message.length > 160 ? '…' : ''}`,
              entityType: 'support_ticket',
              entityId: ticket.id,
              linkUrl: `/support?ticketId=${ticket.id}`,
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send reply notification email:", emailErr);
      }
    }

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

    const updates: TicketUpdates = { ...parsed.data };

    if (updates.assignedTo === "") {
      updates.assignedTo = null;
    }

    if (updates.status === "resolved") {
      updates.resolvedAt = new Date();
      updates.resolvedBy = req.user.id;
    }

    const updated = await storage.updateSupportTicket(ticket.id, updates);

    try {
      const trackedFields: TrackedField[] = ["status", "priority", "assignedTo", "category"];
      for (const field of trackedFields) {
        if (field in updates) {
          const fromVal: string | null = ticket[field] ?? null;
          const toVal = updates[field] ?? null;
          if (fromVal !== toVal) {
            await storage.createSupportTicketHistory({
              ticketId: ticket.id,
              userId: req.user.id,
              field,
              fromValue: fromVal,
              toValue: toVal == null ? null : String(toVal),
            });
          }
        }
      }
    } catch (histErr) {
      console.error("Failed to record ticket history:", histErr);
    }

    try {
      if (updates.status && updates.status !== ticket.status) {
        await createNotification({
          tenantId: ticket.tenantId,
          userId: ticket.userId,
          type: 'ticket_status',
          title: `Ticket #${ticket.ticketNumber} ${updates.status === 'in_progress' ? 'in progress' : updates.status}`,
          body: ticket.subject,
          entityType: 'support_ticket',
          entityId: ticket.id,
          linkUrl: `/support?ticketId=${ticket.id}`,
        });
      }
      if (updates.assignedTo && updates.assignedTo !== ticket.assignedTo) {
        const assignee = await storage.getUser(updates.assignedTo);
        if (assignee) {
          await createNotification({
            tenantId: assignee.tenantId || ticket.tenantId,
            userId: assignee.id,
            type: 'assigned',
            title: `Assigned ticket #${ticket.ticketNumber}`,
            body: ticket.subject,
            entityType: 'support_ticket',
            entityId: ticket.id,
            linkUrl: `/support?ticketId=${ticket.id}`,
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to create ticket update notifications:', notifErr);
    }

    return res.json(updated);
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return res.status(500).json({ error: "Failed to update support ticket" });
  }
});

supportRouter.get("/tickets/:id/history", async (req: Request, res: Response) => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const ticket = await storage.getSupportTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const history = await storage.getSupportTicketHistory(ticket.id);
    return res.json(await buildHistoryWithUsers(history));
  } catch (error) {
    console.error("Error fetching ticket history:", error);
    return res.status(500).json({ error: "Failed to fetch ticket history" });
  }
});

supportRouter.post("/tickets/bulk", async (req: Request, res: Response) => {
  try {
    if (!req.user || !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const parsed = bulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const { ticketIds, status, priority, assignedTo } = parsed.data;

    const updatedIds: string[] = [];
    const failedIds: string[] = [];

    for (const id of ticketIds) {
      try {
        const ticket = await storage.getSupportTicketById(id);
        if (!ticket) { failedIds.push(id); continue; }

        const updates: TicketUpdates = {};
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (assignedTo !== undefined) updates.assignedTo = assignedTo === "" ? null : assignedTo;

        if (updates.status === "resolved" && ticket.status !== "resolved") {
          updates.resolvedAt = new Date();
          updates.resolvedBy = req.user.id;
        }

        await storage.updateSupportTicket(id, updates);
        updatedIds.push(id);

        const trackedFields: TrackedField[] = ["status", "priority", "assignedTo"];
        for (const field of trackedFields) {
          if (field in updates) {
            const fromVal: string | null = ticket[field] ?? null;
            const toVal = updates[field] ?? null;
            if (fromVal !== toVal) {
              try {
                await storage.createSupportTicketHistory({
                  ticketId: id,
                  userId: req.user.id,
                  field,
                  fromValue: fromVal,
                  toValue: toVal == null ? null : String(toVal),
                });
              } catch (histErr) {
                console.error(`Failed to record bulk ticket history for ${id}:`, histErr);
              }
            }
          }
        }

        try {
          if (status && status !== ticket.status) {
            await createNotification({
              tenantId: ticket.tenantId,
              userId: ticket.userId,
              type: 'ticket_status',
              title: `Ticket #${ticket.ticketNumber} ${status === 'in_progress' ? 'in progress' : status}`,
              body: ticket.subject,
              entityType: 'support_ticket',
              entityId: ticket.id,
              linkUrl: `/support?ticketId=${ticket.id}`,
            });
          }
          if (assignedTo && assignedTo !== ticket.assignedTo) {
            const assignee = await storage.getUser(assignedTo);
            if (assignee) {
              await createNotification({
                tenantId: assignee.tenantId || ticket.tenantId,
                userId: assignee.id,
                type: 'assigned',
                title: `Assigned ticket #${ticket.ticketNumber}`,
                body: ticket.subject,
                entityType: 'support_ticket',
                entityId: ticket.id,
                linkUrl: `/support?ticketId=${ticket.id}`,
              });
            }
          }
        } catch (notifErr) {
          console.error("Bulk notification failure:", notifErr);
        }
      } catch (e) {
        failedIds.push(id);
      }
    }

    return res.json({ updated: updatedIds.length, updatedIds, failed: failedIds.length, failedIds });
  } catch (error) {
    console.error("Error in bulk ticket update:", error);
    return res.status(500).json({ error: "Failed to perform bulk update" });
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
