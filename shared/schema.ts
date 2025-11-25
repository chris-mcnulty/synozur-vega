import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, unique, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color"),
  logoUrl: text("logo_url"),
  allowedDomains: jsonb("allowed_domains").$type<string[]>(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
}).extend({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color (e.g., #3B82F6)").optional().nullable(),
  logoUrl: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : val,
    z.string().url("Logo URL must be a valid URL").nullable()
  ).optional(),
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export type CompanyValue = {
  title: string;
  description: string;
};

export const foundations = pgTable("foundations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mission: text("mission"),
  vision: text("vision"),
  values: jsonb("values").$type<CompanyValue[]>(),
  annualGoals: jsonb("annual_goals").$type<string[]>(),
  fiscalYearStartMonth: integer("fiscal_year_start_month"),
  tagline: text("tagline"),
  companySummary: text("company_summary"),
  messagingStatement: text("messaging_statement"),
  cultureStatement: text("culture_statement"),
  brandVoice: text("brand_voice"),
  effectiveDate: timestamp("effective_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantFoundation: unique().on(table.tenantId),
}));

export const insertFoundationSchema = createInsertSchema(foundations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFoundation = z.infer<typeof insertFoundationSchema>;
export type Foundation = typeof foundations.$inferSelect;

export const strategies = pgTable("strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority"),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  status: text("status"),
  owner: text("owner"),
  timeline: text("timeline"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantStrategy: unique().on(table.tenantId, table.title),
}));

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  updatedAt: true,
});

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategies.$inferSelect;

export const okrs = pgTable("okrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  objective: text("objective").notNull(),
  progress: integer("progress"),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  keyResults: jsonb("key_results").$type<string[]>(),
  department: text("department"),
  assignedTo: text("assigned_to"),
  quarter: integer("quarter"),
  year: integer("year"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantOkr: unique().on(table.tenantId, table.objective, table.quarter, table.year),
}));

export const insertOkrSchema = createInsertSchema(okrs).omit({
  id: true,
  updatedAt: true,
});

export type InsertOkr = z.infer<typeof insertOkrSchema>;
export type Okr = typeof okrs.$inferSelect;

export const kpis = pgTable("kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  label: text("label").notNull(),
  value: integer("value"),
  change: integer("change"),
  target: integer("target"),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  quarter: integer("quarter"),
  year: integer("year"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantKpi: unique().on(table.tenantId, table.label, table.quarter, table.year),
}));

export const insertKpiSchema = createInsertSchema(kpis).omit({
  id: true,
  updatedAt: true,
});

export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpis.$inferSelect;

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  meetingType: text("meeting_type"),
  title: text("title").notNull(),
  date: timestamp("date"),
  attendees: jsonb("attendees").$type<string[]>(),
  summary: text("summary"),
  decisions: jsonb("decisions").$type<string[]>(),
  actionItems: jsonb("action_items").$type<string[]>(),
  nextMeetingDate: timestamp("next_meeting_date"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantMeeting: unique().on(table.tenantId, table.title, table.date),
}));

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  updatedAt: true,
}).extend({
  date: z.string().datetime().or(z.date()).nullable().optional(),
  nextMeetingDate: z.string().datetime().or(z.date()).nullable().optional(),
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Enhanced OKRs tables
export const objectives = pgTable("objectives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  
  // Hierarchical fields
  parentId: varchar("parent_id"),
  level: text("level").notNull(), // 'organization', 'team', 'individual'
  
  // Ownership and alignment
  ownerId: varchar("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  teamId: varchar("team_id"),
  coOwnerIds: jsonb("co_owner_ids").$type<string[]>(),
  checkInOwnerId: varchar("check_in_owner_id").references(() => users.id),
  
  // Progress tracking
  progress: integer("progress").default(0),
  progressMode: text("progress_mode").default('rollup'), // 'rollup' or 'manual'
  status: text("status").default('not_started'),
  statusOverride: varchar("status_override").default('false'),
  
  // Time period
  quarter: integer("quarter"),
  year: integer("year"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Alignment and linking
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  linkedValues: jsonb("linked_values").$type<string[]>(),
  
  // Goal type and phased targets (Viva Goals compatibility)
  goalType: text("goal_type").default('committed'), // 'aspirational' or 'committed'
  phasedTargets: jsonb("phased_targets").$type<{
    interval: 'monthly' | 'quarterly' | 'custom';
    targets: Array<{
      targetValue: number;
      targetDate: string;
    }>;
  }>(),
  
  // Email reminder tracking
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderFrequency: text("reminder_frequency").default('weekly'), // 'daily', 'weekly', 'biweekly', 'monthly'
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
}, (table) => ({
  uniqueTenantObjective: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

export const keyResults = pgTable("key_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Metric tracking
  metricType: text("metric_type").notNull(), // 'increase', 'decrease', 'maintain', 'complete'
  currentValue: doublePrecision("current_value").default(0),
  targetValue: doublePrecision("target_value").notNull(),
  initialValue: doublePrecision("initial_value").default(0),
  unit: text("unit"),
  
  // Progress and weight
  progress: integer("progress").default(0),
  weight: integer("weight").default(25),
  isWeightLocked: boolean("is_weight_locked").default(false),
  
  // KPI Promotion
  isPromotedToKpi: varchar("is_promoted_to_kpi").default('false'),
  promotedKpiId: varchar("promoted_kpi_id"),
  promotedAt: timestamp("promoted_at"),
  promotedBy: varchar("promoted_by").references(() => users.id),
  
  // Status
  status: text("status").default('not_started'),
  
  // Ownership
  ownerId: varchar("owner_id").references(() => users.id),
  
  // Phased targets for long-term KRs
  phasedTargets: jsonb("phased_targets").$type<{
    interval: 'monthly' | 'quarterly' | 'custom';
    targets: Array<{
      targetValue: number;
      targetDate: string;
    }>;
  }>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
});

export const bigRocks = pgTable("big_rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Link to objectives or key results
  objectiveId: varchar("objective_id").references(() => objectives.id),
  keyResultId: varchar("key_result_id").references(() => keyResults.id),
  
  // Link to strategies (can map to multiple)
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  
  // Status and progress
  status: text("status").default('not_started'),
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
  priority: text("priority"),
  blockedBy: jsonb("blocked_by").$type<string[]>(),
  
  // Tasks breakdown
  tasks: jsonb("tasks").$type<{id: string, title: string, completed: boolean}[]>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantBigRock: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // What is being checked in
  entityType: text("entity_type").notNull(), // 'objective', 'key_result', 'big_rock'
  entityId: varchar("entity_id").notNull(),
  
  // Progress update
  previousValue: integer("previous_value"),
  newValue: integer("new_value"),
  previousProgress: integer("previous_progress"),
  newProgress: integer("new_progress"),
  
  // Status update
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  statusManuallySet: varchar("status_manually_set").default('false'),
  
  // Context
  note: text("note"),
  achievements: jsonb("achievements").$type<string[]>(),
  challenges: jsonb("challenges").$type<string[]>(),
  nextSteps: jsonb("next_steps").$type<string[]>(),
  
  // Integration source
  source: text("source").default('manual'),
  integrationId: varchar("integration_id"),
  
  // User tracking
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: text("user_email"),
  
  // Timestamp
  asOfDate: timestamp("as_of_date").defaultNow(), // When the check-in data is from (user-changeable)
  createdAt: timestamp("created_at").defaultNow(), // When the check-in was recorded
});

// Export insert schemas and types for new tables
export const insertObjectiveSchema = createInsertSchema(objectives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertObjective = z.infer<typeof insertObjectiveSchema>;
export type Objective = typeof objectives.$inferSelect;

export const insertKeyResultSchema = createInsertSchema(keyResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeyResult = z.infer<typeof insertKeyResultSchema>;
export type KeyResult = typeof keyResults.$inferSelect;

export const insertBigRockSchema = createInsertSchema(bigRocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBigRock = z.infer<typeof insertBigRockSchema>;
export type BigRock = typeof bigRocks.$inferSelect;

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
}).extend({
  asOfDate: z.string().datetime().or(z.date()).optional(),
});

export const updateCheckInSchema = z.object({
  newValue: z.number().optional(),
  newProgress: z.number().min(0).max(100),
  newStatus: z.string().optional(),
  note: z.string().optional(),
  achievements: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  asOfDate: z.string().datetime().or(z.date()).optional(),
});

export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type UpdateCheckIn = z.infer<typeof updateCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;

// Value tagging junction tables
export const objectiveValues = pgTable("objective_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  valueTitle: text("value_title").notNull(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueObjectiveValue: unique().on(table.objectiveId, table.valueTitle),
}));

export const strategyValues = pgTable("strategy_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  valueTitle: text("value_title").notNull(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueStrategyValue: unique().on(table.strategyId, table.valueTitle),
}));

export type ObjectiveValue = typeof objectiveValues.$inferSelect;
export type StrategyValue = typeof strategyValues.$inferSelect;

// Teams table for divisional/departmental OKR organization
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  
  // Hierarchical structure (self-referencing)
  parentTeamId: varchar("parent_team_id"),
  level: integer("level").default(0), // 0 = organization, 1 = division, 2 = department, etc.
  
  // Leadership
  leaderId: varchar("leader_id").references(() => users.id),
  leaderEmail: text("leader_email"),
  memberIds: jsonb("member_ids").$type<string[]>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantTeam: unique().on(table.tenantId, table.name),
}));

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Review snapshots for Focus Rhythm point-in-time analysis
export const reviewSnapshots = pgTable("review_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Review metadata
  title: text("title").notNull(),
  description: text("description"),
  reviewType: text("review_type").notNull(), // 'quarterly', 'annual', 'mid-year', 'custom'
  
  // Time period covered
  quarter: integer("quarter"),
  year: integer("year").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  snapshotDate: timestamp("snapshot_date").notNull(), // When snapshot was taken
  
  // Review content
  executiveSummary: text("executive_summary"),
  keyAchievements: jsonb("key_achievements").$type<string[]>(),
  challenges: jsonb("challenges").$type<string[]>(),
  lessonsLearned: jsonb("lessons_learned").$type<string[]>(),
  nextQuarterPriorities: jsonb("next_quarter_priorities").$type<string[]>(),
  
  // Snapshot data (frozen state of objectives/KRs at review time)
  objectivesSnapshot: jsonb("objectives_snapshot").$type<any[]>(),
  keyResultsSnapshot: jsonb("key_results_snapshot").$type<any[]>(),
  bigRocksSnapshot: jsonb("big_rocks_snapshot").$type<any[]>(),
  
  // Metrics and scores
  overallProgress: integer("overall_progress"),
  objectivesCompleted: integer("objectives_completed"),
  objectivesTotal: integer("objectives_total"),
  keyResultsCompleted: integer("key_results_completed"),
  keyResultsTotal: integer("key_results_total"),
  
  // Participants and reviewers
  presenterId: varchar("presenter_id").references(() => users.id),
  attendeeIds: jsonb("attendee_ids").$type<string[]>(),
  
  // Status
  status: text("status").default('draft'), // 'draft', 'published', 'archived'
  publishedAt: timestamp("published_at"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReviewSnapshotSchema = createInsertSchema(reviewSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReviewSnapshot = z.infer<typeof insertReviewSnapshotSchema>;
export type ReviewSnapshot = typeof reviewSnapshots.$inferSelect;

// Import tracking to prevent duplicate Viva Goals imports
export const importHistory = pgTable("import_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Import details
  importType: text("import_type").notNull(), // 'viva_goals', 'csv', 'json'
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  
  // Import results
  status: text("status").notNull(), // 'success', 'partial', 'failed'
  objectivesCreated: integer("objectives_created").default(0),
  keyResultsCreated: integer("key_results_created").default(0),
  bigRocksCreated: integer("big_rocks_created").default(0),
  checkInsCreated: integer("check_ins_created").default(0),
  teamsCreated: integer("teams_created").default(0),
  
  // Warnings and errors
  warnings: jsonb("warnings").$type<string[]>(),
  errors: jsonb("errors").$type<string[]>(),
  skippedItems: jsonb("skipped_items").$type<any[]>(),
  
  // Import options used
  duplicateStrategy: text("duplicate_strategy"), // 'skip', 'merge', 'create'
  fiscalYearStartMonth: integer("fiscal_year_start_month"),
  
  // Metadata
  importedBy: varchar("imported_by").notNull().references(() => users.id),
  importedAt: timestamp("imported_at").defaultNow(),
});

export const insertImportHistorySchema = createInsertSchema(importHistory).omit({
  id: true,
  importedAt: true,
});

export type InsertImportHistory = z.infer<typeof insertImportHistorySchema>;
export type ImportHistory = typeof importHistory.$inferSelect;
