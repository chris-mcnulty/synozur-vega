import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { loadCurrentUser } from "./middleware/rbac";
import { NOTIFICATION_TYPES } from "@shared/schema";

export const notificationsRouter = Router();

notificationsRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
});

notificationsRouter.use(loadCurrentUser);

const listQuerySchema = z.object({
  unread: z.union([z.literal("true"), z.literal("false")]).optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.errors });
    }
    const items = await storage.getNotificationsByUserId(req.user.id, {
      unreadOnly: parsed.data.unread === "true",
      type: parsed.data.type,
      limit: parsed.data.limit ?? 30,
      offset: parsed.data.offset ?? 0,
    });
    return res.json(items);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

notificationsRouter.get("/unread-count", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const count = await storage.getUnreadNotificationCount(req.user.id);
    return res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const updated = await storage.markNotificationRead(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: "Notification not found" });
    return res.json(updated);
  } catch (error) {
    console.error("Error marking notification read:", error);
    return res.status(500).json({ error: "Failed to mark read" });
  }
});

notificationsRouter.post("/read-all", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const count = await storage.markAllNotificationsRead(req.user.id);
    return res.json({ count });
  } catch (error) {
    console.error("Error marking all read:", error);
    return res.status(500).json({ error: "Failed to mark all read" });
  }
});

notificationsRouter.get("/preferences", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const prefs = await storage.getNotificationPreferences(req.user.id);
    const byType = new Map(prefs.map((p) => [p.eventType, p]));
    const result = NOTIFICATION_TYPES.map((t) => {
      const p = byType.get(t);
      return {
        eventType: t,
        inAppEnabled: p?.inAppEnabled ?? true,
        emailEnabled: p?.emailEnabled ?? true,
      };
    });
    return res.json(result);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

const updatePrefsSchema = z.object({
  preferences: z.array(z.object({
    eventType: z.enum(NOTIFICATION_TYPES),
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
  })),
});

notificationsRouter.patch("/preferences", async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const parsed = updatePrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const results = [];
    for (const p of parsed.data.preferences) {
      const updated = await storage.upsertNotificationPreference({
        userId: req.user.id,
        eventType: p.eventType,
        inAppEnabled: p.inAppEnabled,
        emailEnabled: p.emailEnabled,
      });
      results.push(updated);
    }
    return res.json(results);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return res.status(500).json({ error: "Failed to update preferences" });
  }
});
