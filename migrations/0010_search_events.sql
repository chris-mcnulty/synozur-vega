-- Search Analytics Migration
-- Stores user search activity (queries, no-results, result clicks) per tenant
-- so tenant admins can see what their team searches for.

CREATE TABLE IF NOT EXISTS "search_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL,
  "user_id" varchar,
  "event" text NOT NULL,
  "query" text NOT NULL DEFAULT '',
  "result_type" text,
  "total_results" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_search_events_tenant_created"
  ON "search_events" ("tenant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_search_events_tenant_event"
  ON "search_events" ("tenant_id", "event");

CREATE INDEX IF NOT EXISTS "idx_search_events_tenant_query"
  ON "search_events" ("tenant_id", "query");
