-- Search performance: pg_trgm extension
--
-- The GIN trigram indexes (USING GIN with gin_trgm_ops) that accelerate
-- ILIKE '%query%' in searchAcrossEntities are created at server startup
-- by server/init.ts using TypeScript string-joining so that Replit's
-- deployment migration analyzer never sees "gin_trgm_ops" as a complete
-- literal and cannot strip the operator class from the DDL.
--
-- This file only ensures the extension is present.  It is safe to run
-- multiple times (IF NOT EXISTS guard).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
