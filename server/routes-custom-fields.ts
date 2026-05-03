import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import {
  insertCustomFieldDefSchema,
  CUSTOM_FIELD_ENTITY_TYPES,
  type CustomFieldEntityType,
  validateCustomFieldValues,
  hydrateCustomFieldValues,
  type CustomFieldDef,
} from "@shared/schema";
import { z } from "zod";
import { requireTenantAdmin } from "./middleware/rbac";

export const customFieldsRouter = Router();

const entityTypeSchema = z.enum(CUSTOM_FIELD_ENTITY_TYPES);

// List custom field definitions for the current tenant.
// Read access: any authenticated user in the tenant (needed to render dialogs/tables).
customFieldsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const entityTypeRaw = req.query.entityType as string | undefined;
    const includeArchived = req.query.includeArchived === "true";
    const entityType = entityTypeRaw ? entityTypeSchema.parse(entityTypeRaw) : undefined;
    const defs = await storage.getCustomFieldDefs(tenantId, entityType, includeArchived);
    res.json(defs);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// Admin-only: Create a custom field definition
customFieldsRouter.post("/", requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const data = insertCustomFieldDefSchema.parse({ ...req.body, tenantId });
    // For non-select types, options must be empty
    if (data.fieldType !== "single_select" && data.fieldType !== "multi_select") {
      data.optionsJson = null;
    } else if (!data.optionsJson || !data.optionsJson.options?.length) {
      return res.status(400).json({ error: "Select-type fields require at least one option" });
    } else {
      // Ensure unique option values
      const seen = new Set<string>();
      for (const opt of data.optionsJson.options) {
        if (seen.has(opt.value)) {
          return res.status(400).json({ error: `Duplicate option value "${opt.value}"` });
        }
        seen.add(opt.value);
      }
    }
    const created = await storage.createCustomFieldDef(data);
    res.json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

// Admin-only: Update a custom field definition (label, description, options[add only], required, sortOrder)
customFieldsRouter.patch("/:id", requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const def = await storage.getCustomFieldDefById(req.params.id);
    if (!def || def.tenantId !== tenantId) {
      return res.status(404).json({ error: "Custom field not found" });
    }

    const updateSchema = z.object({
      label: z.string().min(1).max(120).optional(),
      description: z.string().nullable().optional(),
      required: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      optionsJson: z.object({
        options: z.array(z.object({
          value: z.string().min(1).max(64),
          label: z.string().min(1).max(120),
        })).min(1).max(50),
      }).nullable().optional(),
    });
    const updates = updateSchema.parse(req.body);

    // Option safety: cannot remove existing option values that are in use; can rename labels and add new options.
    if (updates.optionsJson !== undefined) {
      if (def.fieldType !== "single_select" && def.fieldType !== "multi_select") {
        return res.status(400).json({ error: "Cannot set options on non-select field" });
      }
      const existingValues = (def.optionsJson?.options || []).map(o => o.value);
      const newValues = (updates.optionsJson?.options || []).map(o => o.value);
      const removed = existingValues.filter(v => !newValues.includes(v));
      if (removed.length > 0) {
        return res.status(400).json({
          error: `Cannot remove existing options: ${removed.join(", ")}. Existing values may be in use. Rename labels instead.`,
        });
      }
      // Ensure unique
      const seen = new Set<string>();
      for (const opt of updates.optionsJson!.options) {
        if (seen.has(opt.value)) {
          return res.status(400).json({ error: `Duplicate option value "${opt.value}"` });
        }
        seen.add(opt.value);
      }
    }

    const updated = await storage.updateCustomFieldDef(req.params.id, updates as any);
    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

// Admin-only: Archive (soft-delete) a custom field. Values are preserved.
customFieldsRouter.post("/:id/archive", requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const def = await storage.getCustomFieldDefById(req.params.id);
    if (!def || def.tenantId !== tenantId) {
      return res.status(404).json({ error: "Custom field not found" });
    }
    const updated = await storage.archiveCustomFieldDef(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin-only: Restore an archived custom field
customFieldsRouter.post("/:id/restore", requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const def = await storage.getCustomFieldDefById(req.params.id);
    if (!def || def.tenantId !== tenantId) {
      return res.status(404).json({ error: "Custom field not found" });
    }
    const updated = await storage.restoreCustomFieldDef(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin-only: Reorder custom fields within an entity type
customFieldsRouter.post("/reorder", requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId;
    if (!tenantId) return res.status(403).json({ error: "No tenant context" });
    const schema = z.object({
      entityType: entityTypeSchema,
      orderedIds: z.array(z.string()).min(1),
    });
    const { entityType, orderedIds } = schema.parse(req.body);
    await storage.reorderCustomFieldDefs(tenantId, entityType, orderedIds);
    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

/**
 * Helper used by entity create/update routes:
 * Validates a `customFields` map against the tenant's active definitions and
 * persists the values. Returns nothing on success; throws on validation error.
 */
export async function applyCustomFields(
  tenantId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
  rawValues: Record<string, any> | undefined,
): Promise<void> {
  if (rawValues === undefined) return; // No-op if not provided
  const defs = await storage.getCustomFieldDefs(tenantId, entityType, false);
  const normalized = validateCustomFieldValues(defs, rawValues);
  if (normalized.length > 0) {
    await storage.setCustomFieldValues(tenantId, entityType, entityId, normalized);
  }
}

/**
 * Hydrate a list of entities with a `customFields` map keyed by definition `key`.
 * Mutates entities in place (returning a typed copy is awkward across many entity shapes).
 */
export async function hydrateEntitiesWithCustomFields<T extends { id: string }>(
  tenantId: string,
  entityType: CustomFieldEntityType,
  entities: T[],
): Promise<(T & { customFields: Record<string, any> })[]> {
  if (entities.length === 0) return entities as any;
  const defs = await storage.getCustomFieldDefs(tenantId, entityType, true); // include archived for display
  const grouped = await storage.getCustomFieldValuesByEntityIds(
    tenantId,
    entityType,
    entities.map(e => e.id),
  );
  return entities.map(e => ({
    ...e,
    customFields: hydrateCustomFieldValues(defs, grouped[e.id] || []),
  }));
}
