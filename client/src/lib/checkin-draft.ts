const DRAFT_PREFIX = "vega.checkin-draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface CheckInDraftForm {
  newValue?: number;
  newProgress: number;
  newStatus: string;
  note: string;
  achievements?: string[];
  challenges?: string[];
  nextSteps?: string[];
  asOfDate: string;
}

export interface CheckInDraft {
  form: CheckInDraftForm;
  valueInputDraft?: string;
  pendingTaskUpdates?: Record<string, string>;
  savedAt: number;
  tenantId?: string;
  entityTitle?: string;
}

export interface CheckInDraftSummary {
  userId: string;
  entityType: string;
  entityId: string;
  tenantId?: string;
  entityTitle?: string;
  savedAt: number;
  storageKey: string;
}

export interface SaveDraftMeta {
  tenantId?: string;
  entityTitle?: string;
}

export function getDraftKey(
  userId: string,
  entityType: string,
  entityId: string,
): string {
  return `${DRAFT_PREFIX}.${userId}.${entityType}.${entityId}`;
}

export function saveDraft(
  userId: string,
  entityType: string,
  entityId: string,
  draft: Omit<CheckInDraft, "savedAt" | "tenantId" | "entityTitle">,
  meta?: SaveDraftMeta,
): number | null {
  if (!userId || !entityType || !entityId) return null;
  try {
    const savedAt = Date.now();
    const key = getDraftKey(userId, entityType, entityId);
    const payload: CheckInDraft = {
      ...draft,
      savedAt,
      ...(meta?.tenantId ? { tenantId: meta.tenantId } : {}),
      ...(meta?.entityTitle ? { entityTitle: meta.entityTitle } : {}),
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return savedAt;
  } catch {
    return null;
  }
}

export function loadDraft(
  userId: string,
  entityType: string,
  entityId: string,
): CheckInDraft | null {
  if (!userId || !entityType || !entityId) return null;
  try {
    const key = getDraftKey(userId, entityType, entityId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CheckInDraft;
    if (
      !draft ||
      typeof draft.savedAt !== "number" ||
      typeof draft.form !== "object" ||
      draft.form === null
    ) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(
  userId: string,
  entityType: string,
  entityId: string,
): void {
  if (!userId || !entityType || !entityId) return;
  try {
    localStorage.removeItem(getDraftKey(userId, entityType, entityId));
  } catch {
    // ignore
  }
}

export function hasDraft(
  userId: string,
  entityType: string,
  entityId: string,
): boolean {
  return loadDraft(userId, entityType, entityId) !== null;
}

function parseDraftKey(
  key: string,
): { userId: string; entityType: string; entityId: string } | null {
  if (!key.startsWith(`${DRAFT_PREFIX}.`)) return null;
  const rest = key.slice(DRAFT_PREFIX.length + 1);
  // Format: {userId}.{entityType}.{entityId}
  // userId and entityId may contain dashes/UUIDs, entityType is a known token
  // Split into 3 parts from the end: take last segment as entityId,
  // second-to-last as entityType, the rest as userId.
  const parts = rest.split(".");
  if (parts.length < 3) return null;
  const entityId = parts[parts.length - 1];
  const entityType = parts[parts.length - 2];
  const userId = parts.slice(0, parts.length - 2).join(".");
  if (!userId || !entityType || !entityId) return null;
  return { userId, entityType, entityId };
}

export function listDrafts(
  userId: string,
  tenantId?: string,
): CheckInDraftSummary[] {
  if (!userId) return [];
  const out: CheckInDraftSummary[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${DRAFT_PREFIX}.`)) keys.push(k);
    }
    for (const key of keys) {
      const parsed = parseDraftKey(key);
      if (!parsed) continue;
      if (parsed.userId !== userId) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let draft: CheckInDraft | null = null;
      try {
        draft = JSON.parse(raw) as CheckInDraft;
      } catch {
        localStorage.removeItem(key);
        continue;
      }
      if (
        !draft ||
        typeof draft.savedAt !== "number" ||
        typeof draft.form !== "object" ||
        draft.form === null
      ) {
        localStorage.removeItem(key);
        continue;
      }
      if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(key);
        continue;
      }
      // If a tenant filter is requested, only include drafts that have a
      // matching tenantId. Drafts without a tenantId are legacy and are
      // treated as not belonging to any specific tenant.
      if (tenantId && draft.tenantId !== tenantId) continue;
      out.push({
        userId: parsed.userId,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        tenantId: draft.tenantId,
        entityTitle: draft.entityTitle,
        savedAt: draft.savedAt,
        storageKey: key,
      });
    }
  } catch {
    // ignore
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
}

export function clearAllDrafts(userId: string, tenantId?: string): number {
  if (!userId) return 0;
  const drafts = listDrafts(userId, tenantId);
  let count = 0;
  for (const d of drafts) {
    try {
      localStorage.removeItem(d.storageKey);
      count++;
    } catch {
      // ignore
    }
  }
  return count;
}
