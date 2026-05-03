import { storage } from "../storage";
import type { NotificationType, Notification } from "@shared/schema";
import { emitNotificationCreated } from "./notification-events";

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  linkUrl?: string | null;
}

/**
 * Create an in-app notification for a user, respecting their notification preferences.
 * Returns the created notification or null if the user has disabled in-app for this type.
 */
export async function createNotification(input: CreateNotificationInput): Promise<Notification | null> {
  try {
    const pref = await storage.getNotificationPreference(input.userId, input.type);
    if (pref && pref.inAppEnabled === false) {
      return null;
    }
    const created = await storage.createNotification({
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      linkUrl: input.linkUrl ?? null,
    });
    if (created) {
      try {
        emitNotificationCreated(input.userId, created);
      } catch (e) {
        console.error('[notification-service] Failed to emit SSE event:', e);
      }
    }
    return created;
  } catch (err) {
    console.error('[notification-service] Failed to create notification:', err);
    return null;
  }
}

/**
 * Check if a user has email notifications enabled for a specific event type.
 * Returns true by default (preferences default to enabled).
 */
export async function isEmailEnabled(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const pref = await storage.getNotificationPreference(userId, type);
    if (!pref) return true;
    return pref.emailEnabled !== false;
  } catch {
    return true;
  }
}

export async function notifyMany(
  inputs: CreateNotificationInput[]
): Promise<void> {
  await Promise.all(inputs.map((i) => createNotification(i)));
}
