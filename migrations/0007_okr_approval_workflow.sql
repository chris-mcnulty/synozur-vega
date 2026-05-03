-- Task #59: OKR approval workflow
-- Tenant opt-in flag (default off)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "okr_approvals_enabled" boolean DEFAULT false;

-- Objective approval state + audit columns
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "state" text DEFAULT 'active';
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "submitted_for_approval_at" timestamp;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "submitted_for_approval_by" varchar;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "approved_by" varchar;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "rejected_by" varchar;
ALTER TABLE "objectives" ADD COLUMN IF NOT EXISTS "last_rejection_note" text;

DO $$ BEGIN
  ALTER TABLE "objectives" ADD CONSTRAINT "objectives_submitted_for_approval_by_users_id_fk"
    FOREIGN KEY ("submitted_for_approval_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "objectives" ADD CONSTRAINT "objectives_approved_by_users_id_fk"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "objectives" ADD CONSTRAINT "objectives_rejected_by_users_id_fk"
    FOREIGN KEY ("rejected_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "objectives_tenant_state_idx" ON "objectives" ("tenant_id", "state");

-- Audit history table
CREATE TABLE IF NOT EXISTS "okr_approval_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "objective_id" varchar NOT NULL REFERENCES "objectives"("id") ON DELETE CASCADE,
  "from_state" text,
  "to_state" text NOT NULL,
  "actor_user_id" varchar REFERENCES "users"("id"),
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "okr_approval_history_objective_idx"
  ON "okr_approval_history" ("objective_id", "created_at");
CREATE INDEX IF NOT EXISTS "okr_approval_history_tenant_idx"
  ON "okr_approval_history" ("tenant_id", "created_at");
