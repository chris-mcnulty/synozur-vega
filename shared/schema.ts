import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
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

export const foundations = pgTable("foundations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  mission: text("mission"),
  vision: text("vision"),
  values: jsonb("values").$type<string[]>(),
  annualGoals: jsonb("annual_goals").$type<string[]>(),
  fiscalYearStartMonth: integer("fiscal_year_start_month"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantFoundation: unique().on(table.tenantId),
}));

export const insertFoundationSchema = createInsertSchema(foundations).omit({
  id: true,
  updatedAt: true,
});

export type InsertFoundation = z.infer<typeof insertFoundationSchema>;
export type Foundation = typeof foundations.$inferSelect;

export const strategies = pgTable("strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
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
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
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
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
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

export const rocks = pgTable("rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  status: text("status"),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  owner: text("owner"),
  quarter: integer("quarter"),
  year: integer("year"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantRock: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

export const insertRockSchema = createInsertSchema(rocks).omit({
  id: true,
  updatedAt: true,
});

export type InsertRock = z.infer<typeof insertRockSchema>;
export type Rock = typeof rocks.$inferSelect;

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
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
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
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
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Metric tracking
  metricType: text("metric_type").notNull(), // 'increase', 'decrease', 'maintain', 'complete'
  currentValue: integer("current_value").default(0),
  targetValue: integer("target_value").notNull(),
  initialValue: integer("initial_value").default(0),
  unit: text("unit"),
  
  // Progress and weight
  progress: integer("progress").default(0),
  weight: integer("weight").default(25),
  
  // KPI Promotion
  isPromotedToKpi: varchar("is_promoted_to_kpi").default('false'),
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
});

export const bigRocks = pgTable("big_rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Link to objectives or key results
  objectiveId: varchar("objective_id").references(() => objectives.id),
  keyResultId: varchar("key_result_id").references(() => keyResults.id),
  
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
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
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
});

export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type CheckIn = typeof checkIns.$inferSelect;
