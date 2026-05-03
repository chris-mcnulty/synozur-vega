import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { loadCurrentUser, requireTenantAccess } from "./middleware/rbac";
import { ROLES } from "../shared/rbac";
import { COMMENT_ENTITY_TYPES, type CommentEntityType } from "@shared/schema";
import { createNotification, isEmailEnabled } from "./services/notification-service";
import { sendCommentMentionEmail } from "./email";

export const commentsRouter = Router();

commentsRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
});

commentsRouter.use(loadCurrentUser);
commentsRouter.use(requireTenantAccess);

const EDIT_WINDOW_MS = 15 * 60 * 1000;

function entityFrontendUrl(entityType: CommentEntityType, entityId: string, commentId: string): string {
  // Best-effort deep link. Most surfaces in this app are interactive panes;
  // the planning page can pick up ?focusComment=&entityId=&entityType=
  const base = `/planning?entityType=${entityType}&entityId=${entityId}&focusComment=${commentId}`;
  return base;
}

async function resolveEntityTitle(entityType: CommentEntityType, entityId: string): Promise<string> {
  try {
    if (entityType === "objective") {
      const o = await storage.getObjectiveById(entityId);
      return o?.title || "an objective";
    }
    if (entityType === "key_result") {
      const k = await storage.getKeyResultById(entityId);
      return k?.title || "a key result";
    }
    if (entityType === "big_rock") {
      const b = await storage.getBigRockById(entityId);
      return b?.title || "a big rock";
    }
    if (entityType === "check_in") {
      const c = await storage.getCheckInById(entityId);
      return c?.note?.slice(0, 60) || "a check-in";
    }
  } catch {}
  return "an item";
}

async function resolveEntityTenantId(entityType: CommentEntityType, entityId: string): Promise<string | null> {
  try {
    if (entityType === "objective") return (await storage.getObjectiveById(entityId))?.tenantId ?? null;
    if (entityType === "key_result") {
      const kr = await storage.getKeyResultById(entityId);
      if (!kr) return null;
      const obj = await storage.getObjectiveById(kr.objectiveId);
      return obj?.tenantId ?? null;
    }
    if (entityType === "big_rock") return (await storage.getBigRockById(entityId))?.tenantId ?? null;
    if (entityType === "check_in") return (await storage.getCheckInById(entityId))?.tenantId ?? null;
  } catch {}
  return null;
}

const listSchema = z.object({
  entityType: z.enum(COMMENT_ENTITY_TYPES),
  entityId: z.string().min(1),
});

commentsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.errors });
    }
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(400).json({ error: "Tenant required" });

    const entityTenantId = await resolveEntityTenantId(parsed.data.entityType, parsed.data.entityId);
    if (entityTenantId && entityTenantId !== tenantId) {
      return res.status(404).json({ error: "Entity not found" });
    }

    const comments = await storage.getCommentsByEntity(tenantId, parsed.data.entityType, parsed.data.entityId);

    const authorIds = Array.from(new Set(comments.map(c => c.authorUserId)));
    const mentionIds = Array.from(new Set(comments.flatMap(c => c.mentionedUserIds || [])));
    const allUserIds = Array.from(new Set([...authorIds, ...mentionIds]));
    const users = allUserIds.length > 0
      ? await Promise.all(allUserIds.map(id => storage.getUser(id).catch(() => undefined)))
      : [];
    const userMap = new Map<string, { id: string; name: string; email: string }>();
    for (const u of users) {
      if (u) userMap.set(u.id, { id: u.id, name: u.name || u.email, email: u.email });
    }

    const enriched = comments.map(c => ({
      ...c,
      // Hide body of soft-deleted comments
      body: c.deletedAt ? "" : c.body,
      author: userMap.get(c.authorUserId) || null,
      mentions: (c.mentionedUserIds || []).map(id => userMap.get(id)).filter(Boolean),
    }));

    return res.json(enriched);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

const countsSchema = z.object({
  entityType: z.enum(COMMENT_ENTITY_TYPES),
  entityIds: z.array(z.string()).max(500),
});

commentsRouter.post("/counts", async (req: Request, res: Response) => {
  try {
    const parsed = countsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.errors });
    }
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(400).json({ error: "Tenant required" });
    const counts = await storage.getCommentCountsByEntities(tenantId, parsed.data.entityType, parsed.data.entityIds);
    const result: Record<string, number> = {};
    for (const id of parsed.data.entityIds) result[id] = counts.get(id) ?? 0;
    return res.json(result);
  } catch (error) {
    console.error("Error fetching comment counts:", error);
    return res.status(500).json({ error: "Failed to fetch counts" });
  }
});

const createSchema = z.object({
  entityType: z.enum(COMMENT_ENTITY_TYPES),
  entityId: z.string().min(1),
  body: z.string().min(1).max(10000),
  parentCommentId: z.string().nullish(),
});

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-fA-F\-]{8,})\)/g;

function parseMentionIdsFromBody(body: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) {
    ids.push(m[2]);
  }
  return Array.from(new Set(ids));
}

async function validateMentionsAgainstTenant(ids: string[], tenantId: string): Promise<string[]> {
  if (ids.length === 0) return [];
  const fetched = await Promise.all(ids.map(id => storage.getUser(id).catch(() => undefined)));
  return fetched
    .filter((u): u is NonNullable<typeof u> => !!u && u.tenantId === tenantId)
    .map(u => u.id);
}

commentsRouter.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(400).json({ error: "Tenant required" });

    const entityTenantId = await resolveEntityTenantId(parsed.data.entityType, parsed.data.entityId);
    if (!entityTenantId || entityTenantId !== tenantId) {
      return res.status(404).json({ error: "Entity not found" });
    }

    // Parse mention tokens from the body server-side; never trust client input.
    const parsedMentionIds = parseMentionIdsFromBody(parsed.data.body);
    const validatedMentions = await validateMentionsAgainstTenant(parsedMentionIds, tenantId);

    const created = await storage.createComment({
      tenantId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      parentCommentId: parsed.data.parentCommentId ?? null,
      authorUserId: req.user.id,
      body: parsed.data.body,
      mentionedUserIds: validatedMentions,
    });

    // Fan out mention notifications (skip self-mentions).
    const recipients = validatedMentions.filter(id => id !== req.user!.id);
    if (recipients.length > 0) {
      const entityTitle = await resolveEntityTitle(parsed.data.entityType, parsed.data.entityId);
      const linkUrl = entityFrontendUrl(parsed.data.entityType, parsed.data.entityId, created.id);
      const author = req.user;
      const snippet = parsed.data.body.length > 140
        ? parsed.data.body.slice(0, 140) + "…"
        : parsed.data.body;

      await Promise.all(recipients.map(async (userId) => {
        await createNotification({
          tenantId,
          userId,
          type: "mention",
          title: `${author.name || author.email} mentioned you`,
          body: snippet,
          entityType: parsed.data.entityType,
          entityId: parsed.data.entityId,
          linkUrl,
        });
        try {
          if (await isEmailEnabled(userId, "mention")) {
            const recipient = await storage.getUser(userId);
            if (recipient?.email) {
              await sendCommentMentionEmail(
                recipient.email,
                recipient.name || recipient.email,
                author.name || author.email,
                entityTitle,
                snippet,
                linkUrl,
              );
            }
          }
        } catch (e) {
          console.error("[comments] mention email failed", e);
        }
      }));
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error("Error creating comment:", error);
    return res.status(500).json({ error: "Failed to create comment" });
  }
});

const updateSchema = z.object({
  body: z.string().min(1).max(10000),
});

commentsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const tenantId = req.effectiveTenantId;
    const existing = await storage.getCommentById(req.params.id);
    if (!existing || existing.tenantId !== tenantId || existing.deletedAt) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (existing.authorUserId !== req.user.id) {
      return res.status(403).json({ error: "Only the author can edit this comment" });
    }
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs > EDIT_WINDOW_MS) {
      return res.status(403).json({ error: "Edit window has expired (15 minutes)" });
    }

    const parsedMentionIds = parseMentionIdsFromBody(parsed.data.body);
    const validatedMentions = await validateMentionsAgainstTenant(parsedMentionIds, tenantId!);

    const updated = await storage.updateComment(req.params.id, parsed.data.body, validatedMentions);
    return res.json(updated);
  } catch (error) {
    console.error("Error updating comment:", error);
    return res.status(500).json({ error: "Failed to update comment" });
  }
});

commentsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const tenantId = req.effectiveTenantId;
    const existing = await storage.getCommentById(req.params.id);
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: "Comment not found" });
    }
    const role = req.user.role;
    const adminRoles: readonly string[] = [ROLES.TENANT_ADMIN, ROLES.ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN];
    const isAdmin = role !== null && role !== undefined && adminRoles.includes(role);
    if (existing.authorUserId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: "Not allowed to delete this comment" });
    }
    const deleted = await storage.softDeleteComment(req.params.id);
    return res.json(deleted);
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
});
