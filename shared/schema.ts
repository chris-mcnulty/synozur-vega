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
  authProvider: text("auth_provider").default("local"),
  azureObjectId: text("azure_object_id"),
  azureTenantId: text("azure_tenant_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type DefaultTimePeriod = {
  mode: 'current' | 'specific';
  year?: number;
  quarter?: number;
};

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color"),
  logoUrl: text("logo_url"),
  allowedDomains: jsonb("allowed_domains").$type<string[]>(),
  defaultTimePeriod: jsonb("default_time_period").$type<DefaultTimePeriod>(),
  azureTenantId: text("azure_tenant_id"),
  enforceSso: boolean("enforce_sso").default(false),
  allowLocalAuth: boolean("allow_local_auth").default(true),
  // M365 Connector Configuration
  connectorOneDrive: boolean("connector_onedrive").default(false),
  connectorSharePoint: boolean("connector_sharepoint").default(false),
  connectorOutlook: boolean("connector_outlook").default(false),
  connectorExcel: boolean("connector_excel").default(false),
  connectorPlanner: boolean("connector_planner").default(false),
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
  progress: doublePrecision("progress"),
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

// Meeting template type for Focus Rhythm
export type MeetingTemplate = {
  id: string;
  name: string;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  defaultDuration: number; // minutes
  defaultAgenda: string[];
  suggestedAttendees: string[];
  description: string;
};

// Predefined meeting templates
export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'weekly-standup',
    name: 'Weekly Standup',
    cadence: 'weekly',
    defaultDuration: 30,
    defaultAgenda: [
      'Big Rock check-ins: Status updates on major initiatives',
      'Review related Key Results and metrics',
      'Identify blockers and dependencies',
      'Commitments for this week',
      'Quick wins and celebrations',
    ],
    suggestedAttendees: ['Team Lead', 'Team Members'],
    description: 'Project-focused check-in: Big Rocks progress and related measures',
  },
  {
    id: 'monthly-review',
    name: 'Monthly Business Review',
    cadence: 'monthly',
    defaultDuration: 60,
    defaultAgenda: [
      'Review Objectives and outcome progress',
      'Analyze Key Results against success measures',
      'Assess strategic alignment: Are OKRs moving us toward our goals?',
      'Discuss at-risk objectives and remediation',
      'Decisions and next steps',
    ],
    suggestedAttendees: ['Leadership Team', 'Department Heads'],
    description: 'Outcome-focused review: OKRs and strategic alignment',
  },
  {
    id: 'quarterly-planning',
    name: 'Quarterly Planning',
    cadence: 'quarterly',
    defaultDuration: 180,
    defaultAgenda: [
      '--- STRATEGY REVIEW ---',
      'Review OKR performance against linked goals',
      'Assess strategic progress and course corrections',
      'Lessons learned from this quarter',
      '--- BIG ROCK PLANNING ---',
      'Validate Big Rocks for next quarter',
      'Identify additions and subtractions',
      'Assign ownership and resources',
      '--- VALUES ALIGNMENT ---',
      'Reflect on how initiatives aligned with our values',
      'Celebrate values-driven wins',
      'Identify areas for values improvement',
    ],
    suggestedAttendees: ['Executive Team', 'Department Heads', 'Key Stakeholders'],
    description: 'Strategic review, Big Rock planning, and values alignment',
  },
  {
    id: 'annual-strategy',
    name: 'Annual Strategy Session',
    cadence: 'annual',
    defaultDuration: 480,
    defaultAgenda: [
      'Year in review - achievements and learnings',
      'Mission, vision, and values alignment check',
      'Market and competitive landscape analysis',
      'Strategic priorities for next year',
      'Annual goals definition',
      'Resource and budget planning',
      'Key initiatives and Big Rocks roadmap',
      'Success metrics and milestones',
    ],
    suggestedAttendees: ['Board', 'Executive Team', 'Strategic Advisors'],
    description: 'Comprehensive annual planning to set organizational direction',
  },
];

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
  
  // Focus Rhythm enhancements
  templateId: text("template_id"), // Reference to MeetingTemplate.id
  facilitator: text("facilitator"),
  agenda: jsonb("agenda").$type<string[]>(), // Meeting agenda items
  risks: jsonb("risks").$type<string[]>(), // Risks identified in meeting
  
  // OKR linkage for Focus Rhythm
  linkedObjectiveIds: jsonb("linked_objective_ids").$type<string[]>(),
  linkedKeyResultIds: jsonb("linked_key_result_ids").$type<string[]>(),
  linkedBigRockIds: jsonb("linked_big_rock_ids").$type<string[]>(),
  
  // Imported meeting notes from Outlook/Copilot/Teams
  meetingNotes: text("meeting_notes"),
  
  // Microsoft 365 Outlook sync fields
  outlookEventId: text("outlook_event_id"), // Outlook calendar event ID
  outlookCalendarId: text("outlook_calendar_id"), // Which Outlook calendar it's synced to
  syncedAt: timestamp("synced_at"), // Last sync timestamp
  syncStatus: text("sync_status"), // 'synced', 'pending', 'error', 'not_synced'
  syncError: text("sync_error"), // Error message if sync failed
  summaryEmailStatus: text("summary_email_status"), // 'not_sent', 'sent', 'failed'
  summaryEmailSentAt: timestamp("summary_email_sent_at"),
  
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
  agenda: z.array(z.string()).nullable().optional(),
  risks: z.array(z.string()).nullable().optional(),
  linkedObjectiveIds: z.array(z.string()).nullable().optional(),
  linkedKeyResultIds: z.array(z.string()).nullable().optional(),
  linkedBigRockIds: z.array(z.string()).nullable().optional(),
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
  parentId: varchar("parent_id").references(() => objectives.id, { onDelete: 'set null' }),
  level: text("level").notNull(), // 'organization', 'team', 'individual'
  
  // Ownership and alignment
  ownerId: varchar("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  teamId: varchar("team_id"),
  coOwnerIds: jsonb("co_owner_ids").$type<string[]>(),
  checkInOwnerId: varchar("check_in_owner_id").references(() => users.id),
  
  // Progress tracking
  progress: doublePrecision("progress").default(0),
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
  progress: doublePrecision("progress").default(0),
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
  
  // Excel data source binding
  excelSourceType: text("excel_source_type"), // 'onedrive' | 'sharepoint' | null
  excelFileId: text("excel_file_id"), // OneDrive/SharePoint item ID
  excelDriveId: text("excel_drive_id"), // Drive ID for SharePoint files (required for proper API calls)
  excelFileName: text("excel_file_name"), // Display name
  excelFilePath: text("excel_file_path"), // Full path for display
  excelSheetName: text("excel_sheet_name"), // Worksheet name
  excelCellReference: text("excel_cell_reference"), // e.g., "B5" or "Sheet1!B5"
  excelLastSyncAt: timestamp("excel_last_sync_at"),
  excelLastSyncValue: doublePrecision("excel_last_sync_value"),
  excelSyncError: text("excel_sync_error"),
  excelAutoSync: boolean("excel_auto_sync").default(false), // Auto-sync on page load
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
  
  // Status and progress (matching OKR statuses: not_started, on_track, behind, at_risk, postponed, completed, closed)
  status: text("status").default('not_started'),
  completionPercentage: integer("completion_percentage").default(0),
  
  // Ownership (who is doing the work)
  ownerId: varchar("owner_id").references(() => users.id),
  ownerEmail: text("owner_email"),
  teamId: varchar("team_id"),
  
  // Accountability (who is responsible for outcomes)
  accountableId: varchar("accountable_id").references(() => users.id),
  accountableEmail: text("accountable_email"),
  
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
  
  // Check-in tracking (synced from last check-in)
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
}, (table) => ({
  uniqueTenantBigRock: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // What is being checked in
  entityType: text("entity_type").notNull(), // 'objective', 'key_result', 'big_rock'
  entityId: varchar("entity_id").notNull(),
  
  // Progress update (using doublePrecision for large values and decimals)
  previousValue: doublePrecision("previous_value"),
  newValue: doublePrecision("new_value"),
  previousProgress: doublePrecision("previous_progress"),
  newProgress: doublePrecision("new_progress"),
  
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

// Objective-BigRock many-to-many junction table
export const objectiveBigRocks = pgTable("objective_big_rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  bigRockId: varchar("big_rock_id").notNull().references(() => bigRocks.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueObjectiveBigRock: unique().on(table.objectiveId, table.bigRockId),
}));

export const insertObjectiveBigRockSchema = createInsertSchema(objectiveBigRocks).omit({
  id: true,
  createdAt: true,
});

export type InsertObjectiveBigRock = z.infer<typeof insertObjectiveBigRockSchema>;
export type ObjectiveBigRock = typeof objectiveBigRocks.$inferSelect;

// KeyResult-BigRock many-to-many junction table
export const keyResultBigRocks = pgTable("key_result_big_rocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyResultId: varchar("key_result_id").notNull().references(() => keyResults.id, { onDelete: 'cascade' }),
  bigRockId: varchar("big_rock_id").notNull().references(() => bigRocks.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueKeyResultBigRock: unique().on(table.keyResultId, table.bigRockId),
}));

export const insertKeyResultBigRockSchema = createInsertSchema(keyResultBigRocks).omit({
  id: true,
  createdAt: true,
});

export type InsertKeyResultBigRock = z.infer<typeof insertKeyResultBigRockSchema>;
export type KeyResultBigRock = typeof keyResultBigRocks.$inferSelect;

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

// Grounding documents for AI context (supports both global/master and tenant-specific)
export const groundingDocuments = pgTable("grounding_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Tenant association (null = global/master document, value = tenant-specific)
  tenantId: varchar("tenant_id").references(() => tenants.id),
  
  // Document metadata
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'company_os', 'methodology', 'best_practices', 'terminology', 'examples'
  
  // Document content
  content: text("content").notNull(),
  
  // Priority for context injection (higher = included first)
  priority: integer("priority").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGroundingDocumentSchema = createInsertSchema(groundingDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGroundingDocument = z.infer<typeof insertGroundingDocumentSchema>;
export type GroundingDocument = typeof groundingDocuments.$inferSelect;

// Microsoft Graph tokens for per-user API access (Planner, etc.)
export const graphTokens = pgTable("graph_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Token storage (encrypted in practice)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  
  // Scopes granted
  scopes: jsonb("scopes").$type<string[]>(),
  
  // Sync metadata
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserToken: unique().on(table.userId),
}));

export const insertGraphTokenSchema = createInsertSchema(graphTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGraphToken = z.infer<typeof insertGraphTokenSchema>;
export type GraphToken = typeof graphTokens.$inferSelect;

// Microsoft Planner Plans
export const plannerPlans = pgTable("planner_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Microsoft Graph IDs
  graphPlanId: text("graph_plan_id").notNull(),
  graphGroupId: text("graph_group_id"),
  
  // Plan details
  title: text("title").notNull(),
  owner: text("owner"),
  
  // Sync metadata
  lastSyncedAt: timestamp("last_synced_at"),
  syncedBy: varchar("synced_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantPlan: unique().on(table.tenantId, table.graphPlanId),
}));

export const insertPlannerPlanSchema = createInsertSchema(plannerPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlannerPlan = z.infer<typeof insertPlannerPlanSchema>;
export type PlannerPlan = typeof plannerPlans.$inferSelect;

// Microsoft Planner Buckets
export const plannerBuckets = pgTable("planner_buckets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => plannerPlans.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Microsoft Graph IDs
  graphBucketId: text("graph_bucket_id").notNull(),
  
  // Bucket details
  name: text("name").notNull(),
  orderHint: text("order_hint"),
  
  // Sync metadata
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePlanBucket: unique().on(table.planId, table.graphBucketId),
}));

export const insertPlannerBucketSchema = createInsertSchema(plannerBuckets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlannerBucket = z.infer<typeof insertPlannerBucketSchema>;
export type PlannerBucket = typeof plannerBuckets.$inferSelect;

// Microsoft Planner Tasks
export const plannerTasks = pgTable("planner_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => plannerPlans.id, { onDelete: 'cascade' }),
  bucketId: varchar("bucket_id").references(() => plannerBuckets.id, { onDelete: 'set null' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Microsoft Graph IDs
  graphTaskId: text("graph_task_id").notNull(),
  
  // Task details
  title: text("title").notNull(),
  percentComplete: integer("percent_complete").default(0),
  priority: integer("priority"),
  
  // Dates
  startDateTime: timestamp("start_date_time"),
  dueDateTime: timestamp("due_date_time"),
  completedDateTime: timestamp("completed_date_time"),
  
  // Assignments (user IDs from Graph)
  assignments: jsonb("assignments").$type<Record<string, { assignedBy: string; assignedDateTime: string }>>(),
  
  // Additional details
  description: text("description"),
  checklist: jsonb("checklist").$type<Record<string, { title: string; isChecked: boolean }>>(),
  references: jsonb("references").$type<Record<string, { alias: string; type: string }>>(),
  
  // Sync metadata
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePlanTask: unique().on(table.planId, table.graphTaskId),
}));

export const insertPlannerTaskSchema = createInsertSchema(plannerTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlannerTask = z.infer<typeof insertPlannerTaskSchema>;
export type PlannerTask = typeof plannerTasks.$inferSelect;

// Junction: Link Planner tasks to Objectives
export const objectivePlannerTasks = pgTable("objective_planner_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  plannerTaskId: varchar("planner_task_id").notNull().references(() => plannerTasks.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  uniqueObjectivePlannerTask: unique().on(table.objectiveId, table.plannerTaskId),
}));

export type ObjectivePlannerTask = typeof objectivePlannerTasks.$inferSelect;

// Junction: Link Planner tasks to Big Rocks
export const bigRockPlannerTasks = pgTable("big_rock_planner_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bigRockId: varchar("big_rock_id").notNull().references(() => bigRocks.id, { onDelete: 'cascade' }),
  plannerTaskId: varchar("planner_task_id").notNull().references(() => plannerTasks.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => ({
  uniqueBigRockPlannerTask: unique().on(table.bigRockId, table.plannerTaskId),
}));

export type BigRockPlannerTask = typeof bigRockPlannerTasks.$inferSelect;
