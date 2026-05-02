-- In-App Notifications Migration
-- Adds notifications and notification_preferences tables for the in-app
-- Notification Center (assignment, behind-pace, support replies, ticket
-- status, check-in due, mention, plan expiration, system).

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "entity_type" text,
  "entity_id" varchar,
  "link_url" text,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_idx"
  ON "notifications" ("user_id", "is_read", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_type_idx"
  ON "notifications" ("user_id", "type", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "notification_pref_user_event_unique" UNIQUE ("user_id", "event_type")
);
