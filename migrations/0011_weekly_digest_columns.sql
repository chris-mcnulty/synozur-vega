-- Weekly AI Digest feature columns and table
-- tenants.weekly_digest_enabled: per-tenant kill switch (default off)
-- tenants.weekly_digest_timezone: IANA timezone for Monday send window
-- users.notif_pref_weekly_digest: per-user opt-out (default on)
-- weekly_digest_sends: idempotency log (unique per user+period)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "weekly_digest_timezone" text NOT NULL DEFAULT 'America/Los_Angeles';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notif_pref_weekly_digest" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "weekly_digest_sends" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "period_start" text NOT NULL,
  "status" text NOT NULL DEFAULT 'sent',
  "send_at" timestamp NOT NULL DEFAULT now(),
  "ai_used" boolean NOT NULL DEFAULT false,
  "error_message" text,
  UNIQUE ("user_id", "period_start")
);
