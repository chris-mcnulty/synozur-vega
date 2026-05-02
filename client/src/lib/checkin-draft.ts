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
  draft: Omit<CheckInDraft, "savedAt">,
): number | null {
  if (!userId || !entityType || !entityId) return null;
  try {
    const savedAt = Date.now();
    const key = getDraftKey(userId, entityType, entityId);
    const payload: CheckInDraft = { ...draft, savedAt };
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
