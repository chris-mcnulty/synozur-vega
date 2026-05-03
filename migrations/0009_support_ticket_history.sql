-- Support Ticket Audit Trail
-- Tracks status / priority / assignment / category changes on support tickets
-- so admins can see a per-ticket history timeline.

CREATE TABLE IF NOT EXISTS "support_ticket_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" varchar NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "field" text NOT NULL,
  "from_value" text,
  "to_value" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_support_ticket_history_ticket_id"
  ON "support_ticket_history" ("ticket_id");

CREATE INDEX IF NOT EXISTS "idx_support_ticket_history_created_at"
  ON "support_ticket_history" ("created_at");
