import { Router, type RequestHandler, type Request, type Response } from "express";
import { storage } from "./storage";
import { SAVED_VIEW_PAGES, insertSavedViewSchema, type SavedViewPage } from "@shared/schema";

const ADMIN_ROLES = ["tenant_admin", "admin", "vega_admin", "global_admin"];

/**
 * Factory that builds the saved-views router. Extracted from routes.ts so the
 * production app can mount it behind `authWithTenant`, and tests can mount it
 * behind a stub auth middleware that sets `req.user` and `req.effectiveTenantId`.
 *
 * Permission rules enforced here:
 *   - Tenant scoping: a saved view from another tenant returns 404.
 *   - Private views: only the owner can edit/delete.
 *   - Shared views: owner OR a tenant admin can edit/delete; everyone else 403.
 */
export function createSavedViewsRouter(authMiddleware: RequestHandler[]): Router {
  const router = Router();

  router.get("/", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const pageParam = String(req.query.page ?? "");
      if (!(SAVED_VIEW_PAGES as readonly string[]).includes(pageParam)) {
        return res.status(400).json({ error: "Invalid or missing page parameter" });
      }
      const tenantId = req.effectiveTenantId!;
      const userId = req.user!.id;
      const views = await storage.getSavedViews(tenantId, userId, pageParam as SavedViewPage);
      res.json(views);
    } catch (e: any) {
      console.error("[saved-views] list error:", e);
      res.status(500).json({ error: "Failed to list saved views" });
    }
  });

  router.post("/", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const tenantId = req.effectiveTenantId!;
      const userId = req.user!.id;
      const parsed = insertSavedViewSchema.parse({
        ...req.body,
        tenantId,
        ownerUserId: userId,
      });
      const created = await storage.createSavedView(parsed);
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Validation failed", issues: e.issues });
      console.error("[saved-views] create error:", e);
      res.status(500).json({ error: "Failed to create saved view" });
    }
  });

  router.patch("/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getSavedViewById(req.params.id);
      if (!existing || existing.deletedAt) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      if (existing.tenantId !== req.effectiveTenantId) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      const userRole = req.user!.role as string;
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const isOwner = existing.ownerUserId === req.user!.id;
      if (existing.visibility === "private" && !isOwner) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      if (existing.visibility === "shared" && !isOwner && !isAdmin) {
        return res.status(403).json({ error: "Only the creator or an admin can edit a shared view" });
      }
      const updateSchema = insertSavedViewSchema
        .partial()
        .omit({ tenantId: true, ownerUserId: true, page: true });
      const partial = updateSchema.parse(req.body);
      const updated = await storage.updateSavedView(req.params.id, partial);
      res.json(updated);
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: "Validation failed", issues: e.issues });
      console.error("[saved-views] update error:", e);
      res.status(500).json({ error: "Failed to update saved view" });
    }
  });

  router.delete("/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getSavedViewById(req.params.id);
      if (!existing || existing.deletedAt) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      if (existing.tenantId !== req.effectiveTenantId) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      const userRole = req.user!.role as string;
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const isOwner = existing.ownerUserId === req.user!.id;
      if (existing.visibility === "private" && !isOwner) {
        return res.status(404).json({ error: "Saved view not found" });
      }
      if (existing.visibility === "shared" && !isOwner && !isAdmin) {
        return res.status(403).json({ error: "Only the creator or an admin can delete a shared view" });
      }
      await storage.softDeleteSavedView(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      console.error("[saved-views] delete error:", e);
      res.status(500).json({ error: "Failed to delete saved view" });
    }
  });

  return router;
}
