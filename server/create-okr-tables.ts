import { db } from "./db";
import { sql } from "drizzle-orm";

async function createEnhancedOKRTables() {
  console.log("Creating enhanced OKR tables...");

  try {
    // Create objectives table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS objectives (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
        title TEXT NOT NULL,
        description TEXT,
        parent_id VARCHAR REFERENCES objectives(id),
        level TEXT NOT NULL,
        owner_id VARCHAR REFERENCES users(id),
        owner_email TEXT,
        team_id VARCHAR,
        co_owner_ids JSONB,
        check_in_owner_id VARCHAR REFERENCES users(id),
        progress NUMERIC(5,2) DEFAULT 0,
        progress_mode TEXT DEFAULT 'rollup',
        status TEXT DEFAULT 'not_started',
        status_override BOOLEAN DEFAULT false,
        quarter INTEGER,
        year INTEGER,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        linked_strategies JSONB,
        linked_goals JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR,
        last_check_in_at TIMESTAMP,
        last_check_in_note TEXT,
        UNIQUE(tenant_id, title, quarter, year)
      )
    `);
    console.log("✅ Created objectives table");

    // Create keyResults table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS key_results (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
        objective_id VARCHAR NOT NULL REFERENCES objectives(id),
        title TEXT NOT NULL,
        description TEXT,
        metric_type TEXT DEFAULT 'numeric',
        current_value NUMERIC(10,2) DEFAULT 0,
        start_value NUMERIC(10,2) DEFAULT 0,
        target_value NUMERIC(10,2) NOT NULL,
        unit TEXT,
        progress NUMERIC(5,2) DEFAULT 0,
        weight NUMERIC(5,2) DEFAULT 25,
        status TEXT DEFAULT 'not_started',
        is_promoted_to_kpi VARCHAR DEFAULT 'false',
        promoted_kpi_id VARCHAR,
        promoted_at TIMESTAMP,
        promoted_by VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR,
        last_check_in_at TIMESTAMP,
        last_check_in_note TEXT,
        UNIQUE(objective_id, title)
      )
    `);
    console.log("✅ Created key_results table");

    // Create bigRocks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS big_rocks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
        objective_id VARCHAR REFERENCES objectives(id),
        key_result_id VARCHAR REFERENCES key_results(id),
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'not_started',
        quarter INTEGER NOT NULL,
        year INTEGER NOT NULL,
        start_date TIMESTAMP,
        due_date TIMESTAMP,
        completion_percentage NUMERIC(5,2) DEFAULT 0,
        owner_id VARCHAR REFERENCES users(id),
        owner_email TEXT,
        blocked_by JSONB,
        tasks JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR,
        UNIQUE(tenant_id, title, quarter, year)
      )
    `);
    console.log("✅ Created big_rocks table");

    // Create checkIns table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS check_ins (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id VARCHAR NOT NULL,
        previous_value NUMERIC(10,2),
        new_value NUMERIC(10,2),
        previous_progress NUMERIC(5,2) NOT NULL,
        new_progress NUMERIC(5,2) NOT NULL,
        previous_status TEXT,
        new_status TEXT,
        note TEXT,
        achievements JSONB,
        challenges JSONB,
        next_steps JSONB,
        created_by VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Created check_ins table");

    // Create indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_objectives_tenant_id ON objectives(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_objectives_parent_id ON objectives(parent_id);
      CREATE INDEX IF NOT EXISTS idx_key_results_objective_id ON key_results(objective_id);
      CREATE INDEX IF NOT EXISTS idx_big_rocks_tenant_id ON big_rocks(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_big_rocks_objective_id ON big_rocks(objective_id);
      CREATE INDEX IF NOT EXISTS idx_big_rocks_key_result_id ON big_rocks(key_result_id);
      CREATE INDEX IF NOT EXISTS idx_check_ins_entity ON check_ins(entity_type, entity_id);
    `);
    console.log("✅ Created indexes");

    console.log("\n✨ All enhanced OKR tables created successfully!");

  } catch (error) {
    console.error("❌ Error creating tables:", error);
    process.exit(1);
  }

  process.exit(0);
}

createEnhancedOKRTables();