-- Migration 0013: Embeddable card tokens and access logs (Task #64)
-- Creates embed_tokens and embed_access_logs tables with all supporting indexes.
-- These are guarded by IF NOT EXISTS so the migration is fully idempotent;
-- the runtime backstop in server/init.ts continues to serve as a safety net.

CREATE TABLE IF NOT EXISTS embed_tokens (
  id              varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       varchar     NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     text        NOT NULL,
  entity_id       varchar,
  label           text        NOT NULL,
  token_hash      text        NOT NULL UNIQUE,
  token_prefix    text        NOT NULL,
  expires_at      timestamp,
  last_used_at    timestamp,
  access_count    integer     NOT NULL DEFAULT 0,
  created_by_user_id varchar  REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamp   NOT NULL DEFAULT now(),
  revoked_at      timestamp,
  revoked_by_user_id varchar  REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_embed_tokens_tenant
  ON embed_tokens(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embed_tokens_entity
  ON embed_tokens(tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS embed_access_logs (
  id           varchar    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    varchar    REFERENCES tenants(id) ON DELETE CASCADE,
  token_id     varchar    REFERENCES embed_tokens(id) ON DELETE SET NULL,
  entity_type  text,
  entity_id    varchar,
  status_code  integer    NOT NULL,
  duration_ms  integer,
  ip_address   text,
  user_agent   text,
  referer      text,
  format       text,
  error_message text,
  created_at   timestamp  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embed_access_logs_tenant_time
  ON embed_access_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embed_access_logs_token_time
  ON embed_access_logs(token_id, created_at DESC);
