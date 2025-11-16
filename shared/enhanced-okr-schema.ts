import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, numeric, boolean, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced OKRs table with hierarchical support
export const objectives = pgTable("objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  
  // Hierarchical fields
  parentId: varchar("parent_id").references(() => objectives.id),
  level: text("level").notNull(), // 'organization', 'team', 'individual'
  
  // Ownership and alignment
  ownerId: varchar("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  teamId: varchar("team_id"),
  coOwnerIds: jsonb("co_owner_ids").$type<string[]>(),
  checkInOwnerId: varchar("check_in_owner_id").references(() => users.id), // Designated check-in owner
  
  // Progress tracking
  progress: numeric("progress", { precision: 5, scale: 2 }).default('0'),
  progressMode: text("progress_mode").default('rollup'), // 'rollup' or 'manual'
  status: text("status").default('not_started'), // 'not_started', 'on_track', 'behind', 'at_risk', 'completed', 'postponed', 'cancelled'
  statusOverride: boolean("status_override").default(false), // If true, status was manually set
  
  // Time period
  quarter: integer("quarter"),
  year: integer("year"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Alignment and linking
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
}, (table) => ({
  uniqueTenantObjective: unique().on(table.tenantId, table.title, table.quarter, table.year),
  parentIndex: index("idx_objective_parent").on(table.parentId),
  tenantLevelIndex: index("idx_objective_tenant_level").on(table.tenantId, table.level),
}));

// Key Results with promotion to KPI capability
export const keyResults = pgTable("key_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Metric tracking
  metricType: text("metric_type").notNull(), // 'increase', 'decrease', 'maintain', 'complete'
  currentValue: numeric("current_value", { precision: 12, scale: 2 }).default('0'),
  targetValue: numeric("target_value", { precision: 12, scale: 2 }).notNull(),
  initialValue: numeric("initial_value", { precision: 12, scale: 2 }).default('0'),
  unit: text("unit"), // e.g., '%', '$', 'users', 'items'
  
  // Progress and weight
  progress: numeric("progress", { precision: 5, scale: 2 }).default('0'),
  weight: numeric("weight", { precision: 5, scale: 2 }).default('25'), // Contribution weight to parent objective
  
  // KPI Promotion
  isPromotedToKpi: boolean("is_promoted_to_kpi").default(false),
  promotedKpiId: varchar("promoted_kpi_id"),
  promotedAt: timestamp("promoted_at"),
  promotedBy: varchar("promoted_by").references(() => users.id),
  
  // Status
  status: text("status").default('not_started'),
  
  // Ownership
  ownerId: varchar("owner_id").references(() => users.id),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
}, (table) => ({
  objectiveIndex: index("idx_kr_objective").on(table.objectiveId),
  tenantKpiIndex: index("idx_kr_tenant_kpi").on(table.tenantId, table.isPromotedToKpi),
}));

// Big Rocks (Initiatives) - Projects/tasks that drive KRs
export const bigRocks = pgTable("big_rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Link to objectives or key results
  objectiveId: varchar("objective_id").references(() => objectives.id),
  keyResultId: varchar("key_result_id").references(() => keyResults.id),
  
  // Status and progress
  status: text("status").default('not_started'), // 'not_started', 'in_progress', 'completed', 'blocked', 'cancelled'
  completionPercentage: integer("completion_percentage").default(0),
  
  // Ownership
  ownerId: varchar("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  teamId: varchar("team_id"),
  
  // Time period
  quarter: integer("quarter"),
  year: integer("year"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  
  // Priority and dependencies
  priority: text("priority"), // 'critical', 'high', 'medium', 'low'
  blockedBy: jsonb("blocked_by").$type<string[]>(), // IDs of other big rocks
  
  // Tasks breakdown (optional)
  tasks: jsonb("tasks").$type<{id: string, title: string, completed: boolean}[]>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantBigRock: unique().on(table.tenantId, table.title, table.quarter, table.year),
  objectiveIndex: index("idx_big_rock_objective").on(table.objectiveId),
  keyResultIndex: index("idx_big_rock_kr").on(table.keyResultId),
}));

// Check-ins for tracking progress updates
export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // What is being checked in
  entityType: text("entity_type").notNull(), // 'objective', 'key_result', 'big_rock'
  entityId: varchar("entity_id").notNull(),
  
  // Progress update
  previousValue: numeric("previous_value", { precision: 12, scale: 2 }),
  newValue: numeric("new_value", { precision: 12, scale: 2 }),
  previousProgress: numeric("previous_progress", { precision: 5, scale: 2 }),
  newProgress: numeric("new_progress", { precision: 5, scale: 2 }),
  
  // Status update
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  statusManuallySet: boolean("status_manually_set").default(false),
  
  // Context
  note: text("note"),
  achievements: jsonb("achievements").$type<string[]>(),
  challenges: jsonb("challenges").$type<string[]>(),
  nextSteps: jsonb("next_steps").$type<string[]>(),
  
  // Integration source
  source: text("source").default('manual'), // 'manual', 'integration', 'import'
  integrationId: varchar("integration_id"),
  
  // User tracking
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: text("user_email"),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  entityIndex: index("idx_check_in_entity").on(table.entityType, table.entityId),
  tenantTimeIndex: index("idx_check_in_tenant_time").on(table.tenantId, table.createdAt),
}));

// Enhanced KPIs with Key Result promotion support
export const enhancedKpis = pgTable("enhanced_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  label: text("label").notNull(),
  description: text("description"),
  
  // Metric values
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  previousValue: numeric("previous_value", { precision: 12, scale: 2 }),
  targetValue: numeric("target_value", { precision: 12, scale: 2 }),
  unit: text("unit"),
  
  // Trend and change
  changeValue: numeric("change_value", { precision: 12, scale: 2 }),
  changePercentage: numeric("change_percentage", { precision: 5, scale: 2 }),
  trend: text("trend"), // 'up', 'down', 'stable'
  
  // Source (if promoted from Key Result)
  sourceType: text("source_type").default('manual'), // 'manual', 'promoted_kr', 'integration'
  sourceKeyResultId: varchar("source_key_result_id").references(() => keyResults.id),
  
  // Categorization
  category: text("category"), // e.g., 'revenue', 'customer', 'operational', 'quality'
  department: text("department"),
  
  // Time period
  quarter: integer("quarter"),
  year: integer("year"),
  
  // Dashboard settings
  showOnDashboard: boolean("show_on_dashboard").default(true),
  dashboardOrder: integer("dashboard_order"),
  visualization: text("visualization").default('metric'), // 'metric', 'chart', 'gauge'
  
  // Metadata
  ownerId: varchar("owner_id").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantKpi: unique().on(table.tenantId, table.label, table.quarter, table.year),
  dashboardIndex: index("idx_kpi_dashboard").on(table.tenantId, table.showOnDashboard, table.dashboardOrder),
}));

// OKR Configuration for thresholds and settings
export const okrConfig = pgTable("okr_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  
  // Status thresholds (percentage points behind expected)
  behindThreshold: numeric("behind_threshold", { precision: 5, scale: 2 }).default('25'),
  atRiskThreshold: numeric("at_risk_threshold", { precision: 5, scale: 2 }).default('50'),
  
  // Check-in settings
  checkInFrequency: text("check_in_frequency").default('weekly'), // 'daily', 'weekly', 'biweekly', 'monthly'
  sendReminders: boolean("send_reminders").default(true),
  reminderDayOfWeek: integer("reminder_day_of_week"), // 0-6, Sunday-Saturday
  
  // Default weights
  defaultKeyResultWeight: numeric("default_kr_weight", { precision: 5, scale: 2 }).default('25'),
  
  // Features
  allowManualStatusOverride: boolean("allow_manual_status_override").default(true),
  requireCheckInNotes: boolean("require_check_in_notes").default(false),
  allowKpiPromotion: boolean("allow_kpi_promotion").default(true),
  
  // Metadata
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Import existing tables we reference
import { tenants, users } from './schema';

// Create Zod schemas for validation
export const insertObjectiveSchema = createInsertSchema(objectives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKeyResultSchema = createInsertSchema(keyResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBigRockSchema = createInsertSchema(bigRocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
});

export const insertEnhancedKpiSchema = createInsertSchema(enhancedKpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOkrConfigSchema = createInsertSchema(okrConfig).omit({
  id: true,
  updatedAt: true,
});

// Export types
export type Objective = typeof objectives.$inferSelect;
export type InsertObjective = z.infer<typeof insertObjectiveSchema>;

export type KeyResult = typeof keyResults.$inferSelect;
export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;

export type BigRock = typeof bigRocks.$inferSelect;
export type InsertBigRock = z.infer<typeof insertBigRockSchema>;

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;

export type EnhancedKpi = typeof enhancedKpis.$inferSelect;
export type InsertEnhancedKpi = z.infer<typeof insertEnhancedKpiSchema>;

export type OkrConfig = typeof okrConfig.$inferSelect;
export type InsertOkrConfig = z.infer<typeof insertOkrConfigSchema>;