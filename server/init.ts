import { db, pool } from "./db";
import { tenants, foundations, strategies, okrs, kpis, meetings, users, bigRocks } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

/**
 * Ensure all required schema columns exist in the database.
 * This handles the case where production database is out of sync with code.
 */
async function ensureSchemaColumns() {
  console.log("Checking database schema...");
  
  const client = await pool.connect();
  try {
    // Check and add missing columns for tenants table
    const tenantColumns = [
      { name: 'connector_onedrive', type: 'boolean DEFAULT false' },
      { name: 'connector_sharepoint', type: 'boolean DEFAULT false' },
      { name: 'connector_outlook', type: 'boolean DEFAULT false' },
      { name: 'connector_excel', type: 'boolean DEFAULT false' },
      { name: 'connector_planner', type: 'boolean DEFAULT false' },
      { name: 'admin_consent_granted', type: 'boolean DEFAULT false' },
      { name: 'admin_consent_granted_at', type: 'timestamp' },
      { name: 'admin_consent_granted_by', type: 'varchar(255)' },
      { name: 'azure_tenant_id', type: 'varchar(255)' },
      { name: 'enforce_sso', type: 'boolean DEFAULT false' },
      { name: 'allow_local_auth', type: 'boolean DEFAULT true' },
      // Galaxy Portal integration — Synozur customer portal trust.
      { name: 'galaxy_client_id', type: 'text' },
      { name: 'galaxy_enabled', type: 'boolean DEFAULT false' },
      { name: 'galaxy_settings', type: 'jsonb' },
    ];
    
    for (const col of tenantColumns) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = $1
      `, [col.name]);
      
      if (checkResult.rows.length === 0) {
        console.log(`  Adding missing column: tenants.${col.name}`);
        await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      }
    }
    
    // Check and add missing columns for key_results table (Planner mapping)
    const keyResultColumns = [
      { name: 'planner_plan_id', type: 'varchar(255)' },
      { name: 'planner_bucket_id', type: 'varchar(255)' },
      { name: 'planner_sync_enabled', type: 'boolean DEFAULT false' },
      { name: 'planner_last_sync_at', type: 'timestamp' },
      { name: 'planner_sync_error', type: 'text' },
    ];
    
    for (const col of keyResultColumns) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'key_results' AND column_name = $1
      `, [col.name]);
      
      if (checkResult.rows.length === 0) {
        console.log(`  Adding missing column: key_results.${col.name}`);
        await client.query(`ALTER TABLE key_results ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      }
    }
    
    // Check and add missing columns for big_rocks table (Planner mapping)
    const bigRockColumns = [
      { name: 'planner_plan_id', type: 'varchar(255)' },
      { name: 'planner_bucket_id', type: 'varchar(255)' },
      { name: 'planner_sync_enabled', type: 'boolean DEFAULT false' },
      { name: 'planner_last_sync_at', type: 'timestamp' },
      { name: 'planner_sync_error', type: 'text' },
    ];
    
    for (const col of bigRockColumns) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'big_rocks' AND column_name = $1
      `, [col.name]);
      
      if (checkResult.rows.length === 0) {
        console.log(`  Adding missing column: big_rocks.${col.name}`);
        await client.query(`ALTER TABLE big_rocks ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      }
    }
    
    // Fix misnamed column from earlier migration (rotated_from_key_id -> rotated_from_id)
    const wrongColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'mcp_api_keys' AND column_name = 'rotated_from_key_id'
    `);
    if (wrongColCheck.rows.length > 0) {
      console.log('  Renaming mcp_api_keys.rotated_from_key_id -> rotated_from_id');
      await client.query(`ALTER TABLE mcp_api_keys RENAME COLUMN rotated_from_key_id TO rotated_from_id`);
    }

    // Check and add missing columns for mcp_api_keys table
    const mcpApiKeyColumns = [
      { name: 'allowed_ips', type: "TEXT[] DEFAULT '{}'" },
      { name: 'direct_auth', type: 'BOOLEAN NOT NULL DEFAULT false' },
      { name: 'rotated_from_id', type: 'VARCHAR(255)' },
      { name: 'rotation_grace_period_ends', type: 'TIMESTAMP' },
    ];
    
    for (const col of mcpApiKeyColumns) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'mcp_api_keys' AND column_name = $1
      `, [col.name]);
      
      if (checkResult.rows.length === 0) {
        console.log(`  Adding missing column: mcp_api_keys.${col.name}`);
        await client.query(`ALTER TABLE mcp_api_keys ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      }
    }
    
    // Check and add missing columns for meetings table
    const meetingColumns = [
      { name: 'meeting_time', type: 'text' },
      { name: 'duration', type: 'integer' },
      { name: 'live_state', type: 'jsonb' },
    ];
    
    for (const col of meetingColumns) {
      const checkResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'meetings' AND column_name = $1
      `, [col.name]);
      
      if (checkResult.rows.length === 0) {
        console.log(`  Adding missing column: meetings.${col.name}`);
        await client.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      }
    }
    
    // Galaxy Portal: ensure user-level column exists and create unique index on tenants.galaxy_client_id
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS galaxy_user_id text`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_galaxy_user_id ON users(galaxy_user_id) WHERE galaxy_user_id IS NOT NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_galaxy_client_id ON tenants(galaxy_client_id) WHERE galaxy_client_id IS NOT NULL`);

    // Galaxy Portal audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS portal_audit_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        galaxy_client_id text,
        galaxy_user_id text,
        route text NOT NULL,
        method text NOT NULL,
        status_code integer NOT NULL,
        duration_ms integer,
        ip_address text,
        user_agent text,
        error_message text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_portal_audit_tenant_created ON portal_audit_logs(tenant_id, created_at DESC)`);

    // Defensive: ensure soft-delete columns exist for tables whose Drizzle
    // schema references `deletedAt`. Without these, isNull(...deletedAt)
    // queries fail with "column \"deleted_at\" does not exist" on dev DBs
    // that predate the soft-delete additions to shared/schema.ts.
    for (const table of ['objectives', 'key_results', 'big_rocks', 'big_rock_tasks', 'strategies']) {
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR`);
    }

    // Defensive backstop — schema is owned by migrations/0009_add_meeting_agenda_times.sql.
    // Per-topic target time budgets for Live Meeting Mode.
    await client.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS agenda_times jsonb`);

    // Defensive backstop — schema is owned by migrations/0005_add_progress_snapshots.sql.
    // Kept here as IF NOT EXISTS so a fresh dev DB still boots if migrations
    // haven't been applied yet.
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress_snapshots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id VARCHAR NOT NULL,
        snapshot_date TEXT NOT NULL,
        progress DOUBLE PRECISION DEFAULT 0,
        status TEXT,
        pace_status TEXT,
        source TEXT DEFAULT 'job',
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT progress_snapshots_unique_per_day UNIQUE (tenant_id, entity_type, entity_id, snapshot_date)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_progress_snapshots_entity
        ON progress_snapshots (entity_type, entity_id, snapshot_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_progress_snapshots_tenant
        ON progress_snapshots (tenant_id, snapshot_date)
    `);

    // Notifications + preferences tables (in-app Notification Center).
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL,
        title text NOT NULL,
        body text,
        entity_type text,
        entity_id varchar,
        link_url text,
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS notifications_user_idx
        ON notifications (user_id, is_read, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS notifications_user_type_idx
        ON notifications (user_id, type, created_at DESC)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        in_app_enabled boolean NOT NULL DEFAULT true,
        email_enabled boolean NOT NULL DEFAULT true,
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT notification_pref_user_event_unique UNIQUE (user_id, event_type)
      )
    `);

    // Ensure reassignment_audit_logs table exists (used by Bulk Reassignment Console).
    await client.query(`
      CREATE TABLE IF NOT EXISTS reassignment_audit_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        from_user_id varchar NOT NULL,
        from_user_email text NOT NULL,
        from_user_name text,
        to_user_id varchar NOT NULL,
        to_user_email text NOT NULL,
        to_user_name text,
        performed_by_id varchar NOT NULL,
        performed_by_email text NOT NULL,
        performed_by_name text,
        counts jsonb NOT NULL,
        notes text,
        status text NOT NULL DEFAULT 'completed',
        error_message text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reassignment_audit_logs_tenant_created
        ON reassignment_audit_logs(tenant_id, created_at DESC);
    `);

    // Entity comments (Discussion / @mentions). Backstop until a migration ships.
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_comments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        entity_id varchar NOT NULL,
        parent_comment_id varchar,
        author_user_id varchar NOT NULL,
        body text NOT NULL,
        mentioned_user_ids text[] NOT NULL DEFAULT '{}',
        created_at timestamp NOT NULL DEFAULT now(),
        edited_at timestamp,
        deleted_at timestamp,
        deleted_by varchar
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_comments_lookup
        ON entity_comments (tenant_id, entity_type, entity_id, created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_comments_parent
        ON entity_comments (parent_comment_id);
    `);

    // Ensure saved_views table exists (used by Saved Views & Filters on
    // Outcomes / My Focus / Big Rocks).
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_views (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        page text NOT NULL,
        name text NOT NULL,
        filter_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        visibility text NOT NULL DEFAULT 'private',
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_views_tenant_page
        ON saved_views(tenant_id, page) WHERE deleted_at IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_views_owner
        ON saved_views(owner_user_id) WHERE deleted_at IS NULL;
    `);

    // Planning Workshops (Task #63) — schema backstop for fresh / out-of-sync DBs.
    await client.query(`ALTER TABLE objectives ADD COLUMN IF NOT EXISTS origin_workshop_id varchar`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS planning_workshops (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        title text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        settings jsonb NOT NULL,
        created_by_user_id varchar NOT NULL REFERENCES users(id),
        rev integer NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        completed_at timestamp
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshop_participants (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id varchar NOT NULL REFERENCES planning_workshops(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'participant',
        joined_at timestamp DEFAULT now(),
        CONSTRAINT workshop_participants_workshop_id_user_id_unique UNIQUE(workshop_id, user_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshop_candidates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id varchar NOT NULL REFERENCES planning_workshops(id) ON DELETE CASCADE,
        theme text,
        title text NOT NULL,
        description text,
        proposed_by_user_id varchar NOT NULL REFERENCES users(id),
        vote_count integer NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshop_votes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id varchar NOT NULL REFERENCES planning_workshops(id) ON DELETE CASCADE,
        candidate_id varchar NOT NULL REFERENCES workshop_candidates(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now(),
        CONSTRAINT workshop_votes_workshop_id_candidate_id_user_id_unique UNIQUE(workshop_id, candidate_id, user_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_planning_workshops_tenant_created ON planning_workshops(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_workshop_candidates_workshop ON workshop_candidates(workshop_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_workshop_votes_workshop ON workshop_votes(workshop_id)`);

    // KR webhook auto-update — defensive backstop matching shared/schema.ts.
    await client.query(`
      CREATE TABLE IF NOT EXISTS kr_webhook_tokens (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        key_result_id varchar NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
        label text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        secret_hash text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        last_used_at timestamp,
        failure_count integer NOT NULL DEFAULT 0,
        success_count integer NOT NULL DEFAULT 0,
        created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        revoked_at timestamp,
        revoked_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kr_webhook_tokens_kr ON kr_webhook_tokens(key_result_id)`);

    // Shared rate-limit state for the KR webhook ingest endpoint. Backstop
    // matching shared/schema.ts so per-token / per-tenant limits stay
    // consistent across multiple app instances even on fresh dev DBs.
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_rate_limits (
        kind text NOT NULL,
        key text NOT NULL,
        tokens double precision NOT NULL,
        last_refill timestamptz NOT NULL,
        PRIMARY KEY (kind, key)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_kr_webhook_tokens_tenant ON kr_webhook_tokens(tenant_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_ingest_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar REFERENCES tenants(id) ON DELETE CASCADE,
        token_id varchar REFERENCES kr_webhook_tokens(id) ON DELETE SET NULL,
        key_result_id varchar REFERENCES key_results(id) ON DELETE SET NULL,
        status_code integer NOT NULL,
        error_code text,
        error_message text,
        payload_size integer,
        source_ip text,
        user_agent text,
        requested_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_ingest_logs_tenant_time ON webhook_ingest_logs(tenant_id, requested_at DESC)`);

    // Search analytics events (Task #43) — defensive backstop matching shared/schema.ts.
    // Telemetry persistence + tenant-admin analytics endpoint depend on this table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS search_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        user_id varchar,
        event text NOT NULL,
        query text NOT NULL DEFAULT '',
        result_type text,
        total_results integer,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_search_events_tenant_created ON search_events(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_search_events_tenant_event ON search_events(tenant_id, event)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_search_events_tenant_query ON search_events(tenant_id, query)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_ingest_logs_token_time ON webhook_ingest_logs(token_id, requested_at DESC)`);

    // Embeddable cards (Task #64) — defensive backstop matching shared/schema.ts.
    await client.query(`
      CREATE TABLE IF NOT EXISTS embed_tokens (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        entity_id varchar,
        label text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        token_prefix text NOT NULL,
        expires_at timestamp,
        last_used_at timestamp,
        access_count integer NOT NULL DEFAULT 0,
        created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        revoked_at timestamp,
        revoked_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_embed_tokens_tenant ON embed_tokens(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_embed_tokens_entity ON embed_tokens(tenant_id, entity_type, entity_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS embed_access_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar REFERENCES tenants(id) ON DELETE CASCADE,
        token_id varchar REFERENCES embed_tokens(id) ON DELETE SET NULL,
        entity_type text,
        entity_id varchar,
        status_code integer NOT NULL,
        duration_ms integer,
        ip_address text,
        user_agent text,
        referer text,
        format text,
        error_message text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_embed_access_logs_tenant_time ON embed_access_logs(tenant_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_embed_access_logs_token_time ON embed_access_logs(token_id, created_at DESC)`);

    // Admin alerts table (hierarchy depth warnings, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_alerts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        alert_type text NOT NULL,
        fingerprint text NOT NULL,
        severity text NOT NULL DEFAULT 'warning',
        message text NOT NULL,
        details jsonb,
        occurrence_count integer NOT NULL DEFAULT 1,
        first_seen_at timestamp NOT NULL DEFAULT now(),
        last_seen_at timestamp NOT NULL DEFAULT now(),
        acknowledged_at timestamp,
        acknowledged_by varchar REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT admin_alerts_tenant_type_fp_unique UNIQUE (tenant_id, alert_type, fingerprint)
      )
    `);

    // Custom field definitions + values (tenant-scoped extensible fields on OKR entities)
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_field_defs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        key text NOT NULL,
        label text NOT NULL,
        field_type text NOT NULL,
        description text,
        options_json jsonb,
        required boolean DEFAULT false,
        sort_order integer DEFAULT 0,
        archived_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT custom_field_defs_tenant_entity_key_unique UNIQUE (tenant_id, entity_type, key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_field_values (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        field_def_id varchar NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        entity_id varchar NOT NULL,
        value_json jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT custom_field_values_entity_field_unique UNIQUE (entity_id, field_def_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_digest_sends (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        period_start text NOT NULL,
        status text NOT NULL DEFAULT 'sent',
        send_at timestamp NOT NULL DEFAULT now(),
        ai_used boolean NOT NULL DEFAULT false,
        error_message text,
        CONSTRAINT weekly_digest_sends_unique UNIQUE (user_id, period_start)
      )
    `);

    console.log("✓ Database schema verified");
  } catch (error) {
    console.error("Schema check error:", error);
  } finally {
    client.release();
  }
}

/**
 * Initialize database with essential admin users and optionally seed demo data.
 * This runs automatically on server startup.
 */
export async function initializeDatabase() {
  try {
    // First ensure all required columns exist
    await ensureSchemaColumns();
    
    // Always ensure global admin users exist (safe with existing data)
    await ensureGlobalAdmins();

    // NOTE: gpt-5 streaming/empty-response issues previously seen here were caused by
    // insufficient max_completion_tokens — gpt-5 consumes "reasoning tokens" out of that
    // budget before producing visible output. Callers now pass generous token budgets,
    // so gpt-5 is safe to use as the default model and no longer needs to be auto-downgraded.

    // Check if database is completely empty - if so, seed demo data
    const existingTenants = await db.select().from(tenants).limit(1);
    
    if (existingTenants.length === 0) {
      console.log("Empty database detected. Initializing with seed data...");
      await seedDatabase();
      console.log("✓ Database initialization complete");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

/**
 * Ensure global admin users exist with correct credentials.
 * Safe to run on existing databases - upserts users with current password and role.
 * Global admins are not tied to any specific tenant (tenantId = null).
 */
async function ensureGlobalAdmins() {
  try {
    console.log("Ensuring global admin users...");
    
    // Hash the admin password once
    const hashedPassword = await hashPassword("NorthStar2025!");
    
    // Upsert consultant@synozur.com (global consultant - no tenant)
    const consultantResult = await db
      .insert(users)
      .values({
        email: "consultant@synozur.com",
        password: hashedPassword,
        name: "Synozur Consultant",
        role: "vega_consultant",
        tenantId: null, // Global user - not tied to specific tenant
        emailVerified: true, // Pre-verified admin account
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: hashedPassword,
          role: "vega_consultant",
          tenantId: null,
          name: "Synozur Consultant",
          emailVerified: true, // Ensure always verified
        },
      })
      .returning();
    console.log("  ✓ Verified consultant@synozur.com", consultantResult.length > 0 ? "(updated/created)" : "(no change)");
    
    // Upsert superadmin@vega.com (global admin - no tenant)
    const superadminResult = await db
      .insert(users)
      .values({
        email: "superadmin@vega.com",
        password: hashedPassword,
        name: "Vega Administrator",
        role: "vega_admin",
        tenantId: null, // Global user - not tied to specific tenant
        emailVerified: true, // Pre-verified admin account
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: hashedPassword,
          role: "vega_admin",
          tenantId: null,
          name: "Vega Administrator",
          emailVerified: true, // Ensure always verified
        },
      })
      .returning();
    console.log("  ✓ Verified superadmin@vega.com", superadminResult.length > 0 ? "(updated/created)" : "(no change)");

    // Verify users were created by querying them back
    const verifyConsultant = await db.select().from(users).where(eq(users.email, "consultant@synozur.com")).limit(1);
    const verifySuperadmin = await db.select().from(users).where(eq(users.email, "superadmin@vega.com")).limit(1);
    
    if (verifyConsultant.length === 0 || verifySuperadmin.length === 0) {
      console.error("⚠️ WARNING: Admin users not found in database after initialization!");
      console.error(`  consultant@synozur.com: ${verifyConsultant.length > 0 ? 'EXISTS' : 'MISSING'}`);
      console.error(`  superadmin@vega.com: ${verifySuperadmin.length > 0 ? 'EXISTS' : 'MISSING'}`);
    } else {
      console.log("✓ Global admin users initialized and verified in database");
    }
  } catch (error) {
    console.error("❌ Error ensuring global admins:", error);
    console.error("   Database initialization may have failed - check production database connection");
  }
}

/**
 * Seed database with demo data.
 * Can be called during initialization or manually via npm run db:seed
 */
export async function seedDatabase() {
  console.log("Seeding database...");

  // Insert tenants with explicit IDs and allowed domains
  await db.insert(tenants).values([
    {
      id: "f7229583-c9c9-4e80-88cf-5bbfd2819770",
      name: "Acme Corporation",
      color: "#3B82F6",
      allowedDomains: ["acme.com", "acme.org"],
    },
    {
      id: "f328cd4e-0fe1-4893-a637-941684749c55",
      name: "The Synozur Alliance LLC",
      color: "#810FFB",
      allowedDomains: ["synozur.com", "synozuralliance.com"],
    },
    {
      id: "33c48024-917b-4045-a1ef-0542c2da57ca",
      name: "TechStart Inc",
      color: "#E60CB3",
      allowedDomains: ["techstart.io", "techstart.com"],
    },
    {
      id: "f689f005-63ff-40d8-ac04-79e476615c9b",
      name: "Global Ventures",
      color: "#06B6D4",
      allowedDomains: ["globalventures.com", "gv.com"],
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded tenants");

  // Use explicit tenant IDs
  const acmeTenantId = "f7229583-c9c9-4e80-88cf-5bbfd2819770";
  const synozurTenantId = "f328cd4e-0fe1-4893-a637-941684749c55";

  // Create demo users for each tenant
  const demoPassword = process.env.VITE_DEMO_PASSWORD || "NorthStar2025!";
  
  await db.insert(users).values([
    {
      email: "demo@acme.com",
      password: await hashPassword(demoPassword),
      name: "Bob Smith",
      role: "tenant_user",
      tenantId: acmeTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "admin@acme.com",
      password: await hashPassword("admin123"),
      name: "Acme Admin",
      role: "tenant_admin",
      tenantId: acmeTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "consultant@synozur.com",
      password: await hashPassword("consultant123"),
      name: "Synozur Consultant",
      role: "vega_consultant",
      tenantId: synozurTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "superadmin@vega.com",
      password: await hashPassword("vega123"),
      name: "Vega Administrator",
      role: "vega_admin",
      tenantId: null,
      emailVerified: true,
      verificationToken: null,
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded users");

  // Insert Foundation for Acme
  await db.insert(foundations).values({
    tenantId: acmeTenantId,
    mission: "Empower organizations with AI-driven insights and transform strategy into actionable results",
    vision: "A world where every organization operates with clarity through data-driven decision-making at every level",
    values: [
      { title: "Innovation", description: "We embrace new ideas and continuously improve through creative problem-solving" },
      { title: "Integrity", description: "We act with honesty and transparency in everything we do" },
      { title: "Collaboration", description: "We work together to achieve shared goals and mutual success" },
      { title: "Excellence", description: "We strive for the highest quality in our products and services" },
      { title: "Customer Success", description: "We prioritize our customers' needs and help them achieve their goals" }
    ],
    annualGoals: [
      "Increase revenue by 30%",
      "Expand to new markets",
      "Improve customer satisfaction"
    ],
    fiscalYearStartMonth: 1,
    updatedBy: "System",
  }).onConflictDoNothing();

  console.log("✓ Seeded foundation");

  // Insert Strategies for Acme
  await db.insert(strategies).values([
    {
      tenantId: acmeTenantId,
      title: "Launch New Product Line",
      description: "Develop and launch innovative AI-powered analytics suite",
      priority: "critical",
      linkedGoals: ["Launch innovative products", "Increase revenue by 30%"],
      status: "in-progress",
      owner: "Product Team",
      timeline: "Q1-Q2 2025",
      updatedBy: "Sarah Chen",
    },
    {
      tenantId: acmeTenantId,
      title: "Expand Market Presence",
      description: "Enter three new geographic markets in EMEA region",
      priority: "high",
      linkedGoals: ["Expand to new markets", "Strengthen brand presence"],
      status: "in-progress",
      owner: "Sales Team",
      timeline: "2025",
      updatedBy: "Michael Torres",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded strategies");

  // Insert OKRs for Acme
  await db.insert(okrs).values([
    {
      tenantId: acmeTenantId,
      objective: "Increase Market Share",
      progress: 65,
      linkedGoals: ["Increase revenue by 30%", "Expand to new markets"],
      linkedStrategies: ["Expand Market Presence"],
      keyResults: [
        "Acquire 500 new customers",
        "Achieve 95% customer satisfaction",
        "Launch in 3 new markets"
      ],
      department: "Sales",
      assignedTo: "Sarah Chen",
      quarter: 1,
      year: 2025,
      updatedBy: "Sarah Chen",
    },
    {
      tenantId: acmeTenantId,
      objective: "Build World-Class Product",
      progress: 45,
      linkedGoals: ["Launch innovative products", "Achieve operational excellence"],
      linkedStrategies: ["Launch New Product Line"],
      keyResults: [
        "Ship 5 major features",
        "Reduce bugs by 50%",
        "Improve performance by 30%"
      ],
      department: "Engineering",
      assignedTo: "Michael Torres",
      quarter: 1,
      year: 2025,
      updatedBy: "Michael Torres",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded OKRs");

  // Insert KPIs for Acme
  await db.insert(kpis).values([
    {
      tenantId: acmeTenantId,
      label: "Monthly Recurring Revenue",
      value: 285000,
      change: 12,
      target: 300000,
      linkedGoals: ["Increase revenue by 30%"],
      quarter: 1,
      year: 2025,
      updatedBy: "Finance Team",
    },
    {
      tenantId: acmeTenantId,
      label: "Customer Churn Rate",
      value: 23,
      change: -5,
      target: 20,
      linkedGoals: ["Improve customer satisfaction"],
      quarter: 1,
      year: 2025,
      updatedBy: "Customer Success Team",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded KPIs");

  // Insert Rocks (Big Rocks) for Acme
  await db.insert(bigRocks).values([
    {
      tenantId: acmeTenantId,
      title: "Complete Product Redesign",
      status: "in-progress",
      linkedGoals: ["Launch innovative products"],
      linkedStrategies: ["Launch New Product Line"],
      owner: "Design Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Design Lead",
    },
    {
      tenantId: acmeTenantId,
      title: "Launch Marketing Campaign",
      status: "in-progress",
      linkedGoals: ["Expand to new markets"],
      linkedStrategies: ["Expand Market Presence"],
      owner: "Marketing Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Marketing Lead",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded big rocks");

  // Insert Meetings for Acme
  await db.insert(meetings).values([
    {
      tenantId: acmeTenantId,
      meetingType: "quarterly",
      title: "Q1 Strategy Review",
      date: new Date("2025-01-15T10:00:00Z"),
      attendees: ["Executive Team", "Department Heads", "Product Team", "Sales Team"],
      summary: "Reviewed Q1 objectives and key results. Discussed product launch timeline and market expansion plans.",
      decisions: [
        "Approved Q1 budget allocation",
        "Greenlit AI Analytics Platform launch for March",
        "Decided to prioritize EMEA market expansion"
      ],
      actionItems: [
        "Finalize product roadmap by Jan 20 - Product Team",
        "Complete hiring plan for sales team - HR",
        "Schedule customer interviews in UK market - Sales Team"
      ],
      nextMeetingDate: new Date("2025-04-15T10:00:00Z"),
      updatedBy: "Executive Team",
    },
    {
      tenantId: acmeTenantId,
      meetingType: "weekly",
      title: "Weekly Leadership Sync",
      date: new Date("2025-01-20T09:00:00Z"),
      attendees: ["Sarah Chen", "Michael Torres", "Tech Lead", "Marketing Director"],
      summary: "Progress update on Q1 initiatives. Product team reported 75% completion on MVP. Sales pipeline growing steadily.",
      decisions: [
        "Moved beta launch date to Feb 15",
        "Approved additional marketing budget",
        "Decided to add two more customer success representatives"
      ],
      actionItems: [
        "Complete final UI polish by Feb 1 - Product Team",
        "Launch beta signup page - Marketing Team",
        "Schedule customer interviews in UK market - Michael Torres",
        "Complete product redesign mockups - Design Team"
      ],
      nextMeetingDate: new Date("2025-01-27T09:00:00Z"),
      updatedBy: "Sarah Chen",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded meetings for Acme");

  // Insert Foundation for Synozur
  await db.insert(foundations).values({
    tenantId: synozurTenantId,
    mission: "Transform organizations through strategic consulting and innovative technology solutions",
    vision: "Become the trusted partner for organizational excellence and digital transformation",
    values: [
      { title: "Client Success", description: "We measure our success by our clients' achievements and growth" },
      { title: "Innovation", description: "We bring fresh thinking and creative solutions to every challenge" },
      { title: "Expertise", description: "We deliver deep knowledge and proven methodologies to drive results" },
      { title: "Integrity", description: "We build trust through honest communication and ethical practices" },
      { title: "Partnership", description: "We collaborate closely with clients as trusted long-term partners" }
    ],
    annualGoals: [
      "Grow client portfolio by 40%",
      "Launch new consulting service lines",
      "Achieve 95% client satisfaction"
    ],
    fiscalYearStartMonth: 1,
    updatedBy: "System",
  }).onConflictDoNothing();

  console.log("✓ Seeded foundation for Synozur");

  // Insert Meetings for Synozur
  await db.insert(meetings).values([
    {
      tenantId: synozurTenantId,
      meetingType: "weekly",
      title: "Weekly Team Sync",
      date: new Date("2025-01-22T14:00:00Z"),
      attendees: ["Engineering Team", "Product Team", "QA Team", "Design Team"],
      summary: "Engineering and product team sync covering sprint progress, bug triage, and customer feedback review.",
      decisions: [
        "Approved feature scope for next sprint",
        "Decision to focus on performance improvements",
        "Prioritized bug fixes for production release"
      ],
      actionItems: [
        "Complete performance profiling by Jan 20 - Engineering Lead",
        "Schedule design review for new dashboard - Product Manager",
        "Deploy bug fixes to production - DevOps Team"
      ],
      nextMeetingDate: new Date("2025-01-29T14:00:00Z"),
      updatedBy: "Alex Kim",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded meetings for Synozur");
  console.log("Database seeding complete!");
}
