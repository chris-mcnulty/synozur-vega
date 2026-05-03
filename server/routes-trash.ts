import { Router, type RequestHandler, type Request, type Response } from "express";
import { storage } from "./storage";
import { ROLES } from "../shared/rbac";
import type { Objective, KeyResult, BigRock, Strategy, Ambition } from "@shared/schema";

/**
 * Factory that builds the trash/restore router. Extracted from routes.ts so it
 * can be mounted in the main app behind the standard `adminOnly` middleware
 * stack AND remounted in tests behind a stub auth middleware.
 *
 * The middleware stack passed in is responsible for setting `req.user` and
 * (for non-platform-admins) `req.effectiveTenantId`. Platform admins may pass
 * an `x-tenant-id` header instead.
 */
export function createTrashRouter(adminMiddleware: RequestHandler[]): Router {
  const router = Router();

  // List soft-deleted items for the current tenant
  router.get("/", ...adminMiddleware, async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role as string;
      const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = req.effectiveTenantId
        || (isPlatformAdmin ? (req.headers['x-tenant-id'] as string | undefined) : undefined);

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      const items = await storage.getTrashItemsByTenantId(tenantId);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching trash:", error);
      res.status(500).json({ error: "Failed to fetch trash items" });
    }
  });

  // Restore a soft-deleted item by type and id
  router.post("/:type/:id/restore", ...adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const userRole = req.user?.role as string;
      const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = req.effectiveTenantId
        || (isPlatformAdmin ? (req.headers['x-tenant-id'] as string | undefined) : undefined);

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      // All restore methods are tenant-scoped: they fetch and authorize the row
      // BEFORE any mutation. They return undefined if the item doesn't exist or
      // belongs to a different tenant — preventing cross-tenant data modification.
      let restored: Objective | KeyResult | BigRock | Strategy | Ambition | undefined;

      if (type === 'objective') {
        restored = await storage.restoreObjective(id, tenantId);
      } else if (type === 'keyResult' || type === 'key-result') {
        restored = await storage.restoreKeyResult(id, tenantId);
      } else if (type === 'bigRock' || type === 'big-rock') {
        restored = await storage.restoreBigRock(id, tenantId);
      } else if (type === 'strategy') {
        restored = await storage.restoreStrategy(id, tenantId);
      } else if (type === 'ambition') {
        restored = await storage.restoreAmbition(tenantId, id);
      } else {
        return res.status(400).json({ error: "Unknown trash item type" });
      }

      if (!restored) {
        // Could be: not in trash, not found, or belongs to a different tenant.
        // We don't disclose which to avoid leaking existence of cross-tenant rows.
        return res.status(404).json({ error: "Item not found in trash" });
      }

      res.json({ success: true, item: restored });
    } catch (error: any) {
      console.error("Error restoring trash item:", error);
      res.status(500).json({ error: "Failed to restore item" });
    }
  });

  // Permanently delete a soft-deleted item (Delete Forever from Trash)
  router.delete("/:type/:id", ...adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { type, id } = req.params;
      const userRole = req.user?.role as string;
      const isPlatformAdmin = [ROLES.VEGA_ADMIN, ROLES.GLOBAL_ADMIN].includes(userRole as any);
      const tenantId = req.effectiveTenantId
        || (isPlatformAdmin ? (req.headers['x-tenant-id'] as string | undefined) : undefined);

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant context required" });
      }

      // All hard-delete methods are tenant-scoped and only proceed when the row
      // is currently in trash (deletedAt set). They return false when the item
      // doesn't exist, isn't in trash, or belongs to a different tenant — so
      // cross-tenant attempts surface as 404 without leaking existence.
      let success = false;
      if (type === 'objective') {
        success = await storage.hardDeleteTrashedObjective(id, tenantId);
      } else if (type === 'keyResult' || type === 'key-result') {
        success = await storage.hardDeleteTrashedKeyResult(id, tenantId);
      } else if (type === 'bigRock' || type === 'big-rock') {
        success = await storage.hardDeleteTrashedBigRock(id, tenantId);
      } else if (type === 'strategy') {
        success = await storage.hardDeleteTrashedStrategy(id, tenantId);
      } else if (type === 'ambition') {
        success = await storage.hardDeleteTrashedAmbition(tenantId, id);
      } else {
        return res.status(400).json({ error: "Unknown trash item type" });
      }

      if (!success) {
        return res.status(404).json({ error: "Item not found in trash" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error permanently deleting trash item:", error);
      res.status(500).json({ error: "Failed to permanently delete item" });
    }
  });

  return router;
}
