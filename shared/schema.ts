import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color"),
  logoUrl: text("logo_url"),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
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
