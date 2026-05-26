import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, unique, boolean, doublePrecision, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// SERVICE PLANS - Licensing/Subscription Management
// ============================================

export const servicePlans = pgTable("service_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  maxReadWriteUsers: integer("max_read_write_users"), // null = unlimited
  maxReadOnlyUsers: integer("max_read_only_users"), // null = unlimited
  durationDays: integer("duration_days"), // null = never expires
  isDefault: boolean("is_default").default(false), // used for self-service signup
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServicePlanSchema = createInsertSchema(servicePlans).omit({
  id: true,
  createdAt: true,
});

export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;
export type ServicePlan = typeof servicePlans.$inferSelect;

// Blocked domains - prevents signup from specific domains
export const blockedDomains = pgTable("blocked_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  blockedBy: varchar("blocked_by"),
  blockedAt: timestamp("blocked_at").defaultNow(),
});

export const insertBlockedDomainSchema = createInsertSchema(blockedDomains).omit({
  id: true,
  blockedAt: true,
});

export type InsertBlockedDomain = z.infer<typeof insertBlockedDomainSchema>;
export type BlockedDomain = typeof blockedDomains.$inferSelect;

// Page visits - tracks traffic to public pages (homepage, signup, etc.)
export const pageVisits = pgTable("page_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  page: text("page").notNull(), // 'homepage', 'signup', 'login', etc.
  visitorId: text("visitor_id"), // anonymous session/cookie ID
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  ipAddress: text("ip_address"),
  country: text("country"),
  visitedAt: timestamp("visited_at").defaultNow(),
});

export const insertPageVisitSchema = createInsertSchema(pageVisits).omit({
  id: true,
  visitedAt: true,
});

export type InsertPageVisit = z.infer<typeof insertPageVisitSchema>;
export type PageVisit = typeof pageVisits.$inferSelect;

// Search events - records of user search activity for tenant analytics.
// Captures queries, no-result queries, and click-through events to help admins
// see what their team searches for and where there are content gaps.
export const SEARCH_EVENT = {
  QUERY: 'query',
  RESULT_CLICKED: 'result_clicked',
  NO_RESULTS: 'no_results',
} as const;

export type SearchEventType = typeof SEARCH_EVENT[keyof typeof SEARCH_EVENT];

export const searchEvents = pgTable("search_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id"),
  event: text("event").notNull(), // 'query' | 'result_clicked' | 'no_results'
  query: text("query").notNull().default(""),
  resultType: text("result_type"), // entity type for click-through events
  totalResults: integer("total_results"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSearchEventSchema = createInsertSchema(searchEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertSearchEvent = z.infer<typeof insertSearchEventSchema>;
export type SearchEvent = typeof searchEvents.$inferSelect;

// System banners - global announcements managed by Vega Admins
export const BANNER_STATUS = {
  OFF: 'off',
  ON: 'on',
  SCHEDULED: 'scheduled',
} as const;

export type BannerStatus = typeof BANNER_STATUS[keyof typeof BANNER_STATUS];

export const systemBanners = pgTable("system_banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(), // Rich text/HTML content
  linkUrl: text("link_url"), // Optional link URL
  linkText: text("link_text"), // Optional link text
  status: text("status").notNull().default("off"), // 'off', 'on', 'scheduled'
  scheduledStart: timestamp("scheduled_start"), // When to start showing (for scheduled)
  scheduledEnd: timestamp("scheduled_end"), // When to stop showing (for scheduled)
  backgroundColor: text("background_color").default("#0EA5E9"), // Banner background color
  textColor: text("text_color").default("#FFFFFF"), // Banner text color
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemBannerSchema = createInsertSchema(systemBanners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSystemBanner = z.infer<typeof insertSystemBannerSchema>;
export type SystemBanner = typeof systemBanners.$inferSelect;

// SEO Config - manages landing page SEO metadata
export const seoConfig = pgTable("seo_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull().default("Vega - The Synozur Alliance Company OS"),
  description: text("description").notNull().default("Vega delivers the ultimate Company Operating System experience with AI-powered foundations, strategy, planning, and focus rhythm modules for modern organizations. Designed by former Microsoft Viva product leadership."),
  ogDescription: text("og_description").notNull().default("Vega delivers the ultimate Company Operating System experience. Designed by former Microsoft Viva product leadership."),
  keywords: text("keywords").notNull().default("company operating system, OKR software, strategy execution, AI-powered OKRs, business alignment, leadership cadence, Synozur, Vega"),
  canonicalUrl: text("canonical_url").notNull().default("https://vega.synozur.com"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSeoConfigSchema = createInsertSchema(seoConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertSeoConfig = z.infer<typeof insertSeoConfigSchema>;
export type SeoConfig = typeof seoConfig.$inferSelect;

// Landing page settings - controls landing page hero media and other settings
export const HERO_MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type HeroMediaType = typeof HERO_MEDIA_TYPE[keyof typeof HERO_MEDIA_TYPE];

export const landingPageSettings = pgTable("landing_page_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  heroMediaType: text("hero_media_type").notNull().default("image"), // 'image' or 'video'
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLandingPageSettingsSchema = createInsertSchema(landingPageSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertLandingPageSettings = z.infer<typeof insertLandingPageSettingsSchema>;
export type LandingPageSettings = typeof landingPageSettings.$inferSelect;

// ============================================
// CAPABILITY SECTION (TABBED NAVIGATION)
// ============================================

export const capabilitySection = pgTable("capability_section", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  headline: text("headline").notNull().default("Explore Vega Capabilities"),
  subHeadline: text("sub_headline").default("Discover how Vega transforms strategy into weekly action"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCapabilitySectionSchema = createInsertSchema(capabilitySection).omit({
  id: true,
  updatedAt: true,
});

export type InsertCapabilitySection = z.infer<typeof insertCapabilitySectionSchema>;
export type CapabilitySection = typeof capabilitySection.$inferSelect;

export const capabilityTabs = pgTable("capability_tabs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tabLabel: text("tab_label").notNull(),
  heading: text("heading").notNull(),
  bodyCopy: text("body_copy").notNull(),
  primaryImageUrl: text("primary_image_url"),
  secondaryImageUrl: text("secondary_image_url"),
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCapabilityTabSchema = createInsertSchema(capabilityTabs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCapabilityTab = z.infer<typeof insertCapabilityTabSchema>;
export type CapabilityTab = typeof capabilityTabs.$inferSelect;

// ============================================
// USERS
// ============================================

// User types for RBAC distinction between consultant and client users
export const USER_TYPES = {
  CLIENT: 'client',       // Regular client organization user
  CONSULTANT: 'consultant', // External consultant (Vega/partner consultant)
  INTERNAL: 'internal',   // Vega internal staff
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

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
  // The `sub` claim from a Galaxy-issued JWT — stable per Galaxy user.
  // Set on JIT-provisioned portal users with role='portal_user' and
  // authProvider='galaxy'.
  galaxyUserId: text("galaxy_user_id"),
  // License type for service plan enforcement
  licenseType: text("license_type").default("read_write"), // 'read_write' or 'read_only'
  // User type distinguishes between client org users, consultants, and internal staff
  userType: text("user_type").default("client"), // 'client', 'consultant', or 'internal'
  // Timestamp for tracking when user was created
  createdAt: timestamp("created_at").defaultNow(),
  // What's New changelog tracking
  lastDismissedChangelogVersion: text("last_dismissed_changelog_version"),
  // Weekly AI digest opt-in (per-user)
  notifPrefWeeklyDigest: boolean("notif_pref_weekly_digest").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type DefaultTimePeriod = {
  mode: 'current' | 'specific';
  year?: number;
  quarter?: number;
};

// Vocabulary types for customizable terminology (must be before tenants table)
export type VocabularyTerm = {
  singular: string;
  plural: string;
};

export type VocabularyTerms = {
  goal: VocabularyTerm;
  strategy: VocabularyTerm;
  objective: VocabularyTerm;
  keyResult: VocabularyTerm;
  bigRock: VocabularyTerm;
  meeting: VocabularyTerm;
  focusRhythm: VocabularyTerm;
};

// Default vocabulary terms used when no overrides exist
export const defaultVocabulary: VocabularyTerms = {
  goal: { singular: "Goal", plural: "Goals" },
  strategy: { singular: "Strategy", plural: "Strategies" },
  objective: { singular: "Objective", plural: "Objectives" },
  keyResult: { singular: "Key Result", plural: "Key Results" },
  bigRock: { singular: "Big Rock", plural: "Big Rocks" },
  meeting: { singular: "Meeting", plural: "Meetings" },
  focusRhythm: { singular: "Focus Rhythm", plural: "Focus Rhythms" },
};

// Pre-defined vocabulary alternatives for dropdown selection
export const vocabularyAlternatives: Record<keyof VocabularyTerms, VocabularyTerm[]> = {
  goal: [
    { singular: "Goal", plural: "Goals" },
    { singular: "Annual Goal", plural: "Annual Goals" },
    { singular: "Priority", plural: "Priorities" },
    { singular: "Theme", plural: "Themes" },
    { singular: "Pillar", plural: "Pillars" },
    { singular: "North Star", plural: "North Stars" },
  ],
  strategy: [
    { singular: "Strategy", plural: "Strategies" },
    { singular: "Strategic Initiative", plural: "Strategic Initiatives" },
    { singular: "Strategic Bet", plural: "Strategic Bets" },
    { singular: "Focus Area", plural: "Focus Areas" },
    { singular: "Workstream", plural: "Workstreams" },
  ],
  objective: [
    { singular: "Objective", plural: "Objectives" },
    { singular: "OKR", plural: "OKRs" },
    { singular: "Goal", plural: "Goals" },
    { singular: "Target", plural: "Targets" },
    { singular: "Outcome", plural: "Outcomes" },
  ],
  keyResult: [
    { singular: "Key Result", plural: "Key Results" },
    { singular: "KR", plural: "KRs" },
    { singular: "Metric", plural: "Metrics" },
    { singular: "Measure", plural: "Measures" },
    { singular: "Success Metric", plural: "Success Metrics" },
    { singular: "KPI", plural: "KPIs" },
  ],
  bigRock: [
    { singular: "Big Rock", plural: "Big Rocks" },
    { singular: "Initiative", plural: "Initiatives" },
    { singular: "Project", plural: "Projects" },
    { singular: "Priority", plural: "Priorities" },
    { singular: "Epic", plural: "Epics" },
    { singular: "Milestone", plural: "Milestones" },
  ],
  meeting: [
    { singular: "Meeting", plural: "Meetings" },
    { singular: "Session", plural: "Sessions" },
    { singular: "Sync", plural: "Syncs" },
    { singular: "Huddle", plural: "Huddles" },
    { singular: "Check-in", plural: "Check-ins" },
  ],
  focusRhythm: [
    { singular: "Focus Rhythm", plural: "Focus Rhythms" },
    { singular: "Cadence", plural: "Cadences" },
    { singular: "Operating Rhythm", plural: "Operating Rhythms" },
    { singular: "Meeting Rhythm", plural: "Meeting Rhythms" },
    { singular: "Execution Rhythm", plural: "Execution Rhythms" },
  ],
};

// Branding configuration type for tenant customization
export type TenantBranding = {
  // Color scheme
  primaryColor?: string;      // Main brand color (hex)
  secondaryColor?: string;    // Secondary brand color (hex)
  accentColor?: string;       // Accent/highlight color (hex)
  
  // Typography
  fontFamily?: string;        // Primary font family
  headingFontFamily?: string; // Font for headings
  
  // Report branding
  reportHeaderText?: string;  // Custom header text for reports
  reportFooterText?: string;  // Custom footer text for reports
  tagline?: string;           // Company tagline
  
  // Email branding
  emailFromName?: string;     // Sender name for emails
  emailSignature?: string;    // Email signature HTML
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
  // Admin Consent for Multi-Tenant M365 Integration
  adminConsentGranted: boolean("admin_consent_granted").default(false),
  adminConsentGrantedAt: timestamp("admin_consent_granted_at"),
  adminConsentGrantedBy: varchar("admin_consent_granted_by"),
  // Vocabulary overrides for this tenant (partial - only overridden terms)
  vocabularyOverrides: jsonb("vocabulary_overrides").$type<Partial<VocabularyTerms>>(),
  
  // Branding configuration (NEW - Dec 17, 2025)
  branding: jsonb("branding").$type<TenantBranding>(),
  // Secondary/alternate logo for dark backgrounds
  logoUrlDark: text("logo_url_dark"),
  // Favicon URL
  faviconUrl: text("favicon_url"),
  // Custom subdomain (e.g., "acme" for acme.vega.synozur.com)
  customSubdomain: text("custom_subdomain"),
  
  // Service Plan / Licensing (NEW - Dec 22, 2025)
  servicePlanId: varchar("service_plan_id").references(() => servicePlans.id),
  planStartedAt: timestamp("plan_started_at"),
  planExpiresAt: timestamp("plan_expires_at"),
  planStatus: text("plan_status").default("active"), // 'active', 'expired', 'cancelled'
  planCancelledAt: timestamp("plan_cancelled_at"),
  planCancelledBy: varchar("plan_cancelled_by"),
  planCancelReason: text("plan_cancel_reason"),
  // Self-service signup metadata
  selfServiceSignup: boolean("self_service_signup").default(false),
  signupCompletedAt: timestamp("signup_completed_at"),
  // Invite-only mode: when true, new users cannot auto-join via domain matching
  // Used for tenants created by users with public email domains (Gmail, Yahoo, etc.)
  inviteOnly: boolean("invite_only").default(false),
  // What's New changelog modal - tenant admins can disable
  showChangelogOnLogin: boolean("show_changelog_on_login").default(true),
  // Organization classification fields (collected during signup)
  organizationSize: text("organization_size"), // '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
  industry: text("industry"), // e.g., 'Technology', 'Healthcare', 'Finance', etc.
  location: text("location"), // e.g., 'United States', 'United Kingdom', etc.
  // Galaxy Portal Integration (Task #50)
  // Galaxy is Synozur's central customer portal that issues OIDC tokens
  // mapping its end users into Vega tenants. The Galaxy `client_id` claim
  // identifies the Galaxy customer record and is used as the sole source
  // of tenant scoping for `/api/portal/*` requests.
  galaxyClientId: text("galaxy_client_id").unique(),
  galaxyEnabled: boolean("galaxy_enabled").default(false),
  // Optional per-tenant overrides of GALAXY_ISSUER/GALAXY_AUDIENCE/GALAXY_JWKS_URI
  galaxySettings: jsonb("galaxy_settings").$type<{
    issuer?: string;
    audience?: string;
    jwksUri?: string;
  }>(),
  // Weekly AI digest (Task #62) — opt-in per tenant; default off until enabled.
  weeklyDigestEnabled: boolean("weekly_digest_enabled").notNull().default(false),
  // IANA timezone used to anchor the Monday 6/7am send window. Defaults to Pacific.
  weeklyDigestTimezone: text("weekly_digest_timezone").notNull().default('America/Los_Angeles'),
  // OKR approval workflow (Task #59) – when true, new/edited objectives must be
  // approved before becoming active. Default false preserves existing behavior.
  okrApprovalsEnabled: boolean("okr_approvals_enabled").default(false),
});

// Base schema for tenant updates - keeps org classification optional for legacy compatibility
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
}).extend({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color (e.g., #3B82F6)").optional().nullable(),
  // Allow any string for logo URLs - supports both full URLs and relative paths from object storage
  logoUrl: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : val,
    z.string().nullable()
  ).optional(),
  logoUrlDark: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : val,
    z.string().nullable()
  ).optional(),
  faviconUrl: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : val,
    z.string().nullable()
  ).optional(),
});

// Schema for NEW tenant creation - requires org classification fields
export const createTenantSchema = insertTenantSchema.extend({
  organizationSize: z.string().min(1, "Organization size is required"),
  industry: z.string().min(1, "Industry is required"),
  location: z.string().min(1, "Location is required"),
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type CreateTenant = z.infer<typeof createTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// System-wide vocabulary defaults (managed by vega_admin/global_admin)
export const systemVocabulary = pgTable("system_vocabulary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terms: jsonb("terms").$type<VocabularyTerms>().notNull(),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemVocabularySchema = createInsertSchema(systemVocabulary).omit({
  id: true,
  updatedAt: true,
});

export type InsertSystemVocabulary = z.infer<typeof insertSystemVocabularySchema>;
export type SystemVocabulary = typeof systemVocabulary.$inferSelect;

export type CompanyValue = {
  title: string;
  description: string;
};

export type Ambition = {
  id: string;
  title: string;
  description?: string;
  targetYear: number;
  linkedValueTitles?: string[];
  ownerId?: string;
  status: 'active' | 'closed';
  closedAt?: string;
  closedNote?: string;
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type AnnualGoal = {
  title: string;
  year: number;
  description?: string;
  linkedAmbitionId?: string;
};

export const foundations = pgTable("foundations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  mission: text("mission"),
  vision: text("vision"),
  values: jsonb("values").$type<CompanyValue[]>(),
  ambitions: jsonb("ambitions").$type<Ambition[]>(),
  annualGoals: jsonb("annual_goals").$type<AnnualGoal[]>(),
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
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
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

// Predefined meeting templates with OKR check-in sections
// Agenda items prefixed with [OKR] indicate OKR-specific check-in items
// Section headers use --- SECTION NAME --- format
export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'okr-checkin',
    name: 'OKR Check-in',
    cadence: 'weekly',
    defaultDuration: 30,
    defaultAgenda: [
      '--- OKR PROGRESS REVIEW ---',
      '[OKR] Review linked Objectives - current progress vs target',
      '[OKR] Key Results status update - Red/Yellow/Green assessment',
      '[OKR] Confidence level check - Are we on track to hit targets?',
      '--- BLOCKERS & RISKS ---',
      'Surface any blockers preventing progress',
      'Identify dependencies on other teams',
      '--- ACTION ITEMS ---',
      'Agree on priority actions for the coming week',
      'Assign owners and due dates',
    ],
    suggestedAttendees: ['OKR Owner', 'Team Members', 'Stakeholders'],
    description: 'Focused OKR review: Link your objectives and track progress systematically',
  },
  {
    id: 'weekly-standup',
    name: 'Weekly Standup',
    cadence: 'weekly',
    defaultDuration: 30,
    defaultAgenda: [
      '--- BIG ROCK CHECK-IN ---',
      '[OKR] Big Rock status updates - what moved this week?',
      '[OKR] Key Results impacted by Big Rock progress',
      '--- TEAM SYNC ---',
      'Identify blockers and dependencies',
      'Commitments for this week',
      'Quick wins and celebrations',
    ],
    suggestedAttendees: ['Team Lead', 'Team Members'],
    description: 'Project-focused check-in with OKR alignment: Big Rocks and metrics',
  },
  {
    id: 'monthly-review',
    name: 'Monthly Business Review',
    cadence: 'monthly',
    defaultDuration: 60,
    defaultAgenda: [
      '--- OKR SCORECARD ---',
      '[OKR] Review all Objectives - progress summary by level',
      '[OKR] Key Results performance - identify at-risk metrics (below 40%)',
      '[OKR] Celebrate wins - highlight objectives exceeding targets',
      '--- STRATEGIC ALIGNMENT ---',
      'Assess: Are OKRs moving us toward annual goals?',
      'Discuss course corrections for underperforming objectives',
      'Resource reallocation decisions',
      '--- DECISIONS & ACTIONS ---',
      'Key decisions made',
      'Action items with owners',
    ],
    suggestedAttendees: ['Leadership Team', 'Department Heads'],
    description: 'Outcome-focused review with OKR scorecard and strategic alignment',
  },
  {
    id: 'quarterly-planning',
    name: 'Quarterly Planning',
    cadence: 'quarterly',
    defaultDuration: 180,
    defaultAgenda: [
      '--- QUARTER RETROSPECTIVE ---',
      '[OKR] Final OKR scores - grade each objective and key result',
      '[OKR] Analyze what drove success vs. what caused misses',
      'Lessons learned and best practices to carry forward',
      '--- STRATEGY ALIGNMENT ---',
      'Review annual goals progress',
      'Assess strategic priorities - any shifts needed?',
      '--- NEXT QUARTER OKRs ---',
      '[OKR] Draft new Objectives - org, department, team levels',
      '[OKR] Define Key Results - measurable success criteria',
      '[OKR] Map Big Rocks to new OKRs',
      '--- RESOURCE PLANNING ---',
      'Assign OKR owners and contributors',
      'Identify resource needs and dependencies',
    ],
    suggestedAttendees: ['Executive Team', 'Department Heads', 'Key Stakeholders'],
    description: 'Strategic OKR planning: Grade current quarter, set next quarter OKRs',
  },
  {
    id: 'annual-strategy',
    name: 'Annual Strategy Session',
    cadence: 'annual',
    defaultDuration: 480,
    defaultAgenda: [
      '--- YEAR IN REVIEW ---',
      '[OKR] Annual OKR performance summary - what we achieved',
      'Mission, vision, and values alignment check',
      'Celebrate major wins and milestones',
      '--- STRATEGY DEVELOPMENT ---',
      'Market and competitive landscape analysis',
      'Strategic priorities for next year',
      'Annual goals definition',
      '--- OKR FRAMEWORK ---',
      '[OKR] Set annual-level Objectives',
      '[OKR] Define organizational Key Results and targets',
      'Cascade framework to departments',
      '--- EXECUTION PLANNING ---',
      'Resource and budget planning',
      'Key initiatives and Big Rocks roadmap',
      'Quarterly milestone checkpoints',
    ],
    suggestedAttendees: ['Board', 'Executive Team', 'Strategic Advisors'],
    description: 'Comprehensive annual planning: Set direction and establish OKR framework',
  },
];

export type ActionItem = {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;         // ISO date string, e.g. "2026-04-15"
  priority?: 'high' | 'medium' | 'low';
  completed: boolean;
};

// Action items in older meetings were stored as plain strings; normalize them
// to the structured ActionItem shape for consistent rendering.
export function normalizeActionItems(
  raw: ReadonlyArray<string | ActionItem> | null | undefined,
): ActionItem[] {
  if (!raw) return [];
  return raw.map((item, i) =>
    typeof item === "string"
      ? { id: `legacy-${i}`, description: item, completed: false }
      : item,
  );
}

// Live Meeting Mode in-session presentation state, persisted on the meeting
// record so a refresh resumes the running session and the end snapshot is kept.
export const liveMeetingSummarySchema = z.object({
  totalElapsedSeconds: z.number(),
  topicsCovered: z.number(),
  decisionsCount: z.number(),
  risksCount: z.number(),
  actionItemsCount: z.number(),
  endedAt: z.string(),
});

export const liveMeetingStateSchema = z.object({
  startedAt: z.string(),
  currentTopicIndex: z.number().int(),
  topicChangedAt: z.string(),
  perTopicSeconds: z.record(z.string(), z.number()),
  paused: z.boolean(),
  pausedAt: z.string().nullable(),
  endedAt: z.string().nullable().optional(),
  summary: liveMeetingSummarySchema.nullable().optional(),
});

export type LiveMeetingState = z.infer<typeof liveMeetingStateSchema>;

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  meetingType: text("meeting_type"),
  title: text("title").notNull(),
  date: timestamp("date"),
  meetingTime: text("meeting_time"),          // HH:MM, e.g. "14:30"
  duration: integer("duration"),              // minutes, e.g. 60
  attendees: jsonb("attendees").$type<string[]>(),
  summary: text("summary"),
  decisions: jsonb("decisions").$type<string[]>(),
  // Stored as jsonb. Legacy rows hold string[]; new captures use ActionItem[].
  // Consumers should normalize via the helper in shared (`normalizeActionItems`).
  actionItems: jsonb("action_items").$type<Array<string | ActionItem>>(),
  nextMeetingDate: timestamp("next_meeting_date"),

  // Focus Rhythm enhancements
  templateId: text("template_id"), // Reference to MeetingTemplate.id
  facilitator: text("facilitator"),
  agenda: jsonb("agenda").$type<string[]>(), // Meeting agenda items
  // Per-topic target time budgets (minutes) keyed by agenda index as string
  // (e.g. { "0": 5, "2": 10 }). Optional — items without a key have no target.
  agendaTimes: jsonb("agenda_times").$type<Record<string, number>>(),
  risks: jsonb("risks").$type<string[]>(), // Risks identified in meeting

  // OKR linkage for Focus Rhythm
  linkedObjectiveIds: jsonb("linked_objective_ids").$type<string[]>(),
  linkedKeyResultIds: jsonb("linked_key_result_ids").$type<string[]>(),
  linkedBigRockIds: jsonb("linked_big_rock_ids").$type<string[]>(),
  
  // Imported meeting notes from Outlook/Copilot/Teams
  meetingNotes: text("meeting_notes"),

  // Live Meeting Mode state (persisted so refresh resumes a running meeting,
  // and so the post-meeting summary snapshot is preserved).
  liveState: jsonb("live_state").$type<LiveMeetingState>(),
  
  // Microsoft 365 Outlook sync fields
  outlookEventId: text("outlook_event_id"), // Outlook calendar event ID
  outlookCalendarId: text("outlook_calendar_id"), // Which Outlook calendar it's synced to
  syncedAt: timestamp("synced_at"), // Last sync timestamp
  syncStatus: text("sync_status"), // 'synced', 'pending', 'error', 'not_synced'
  syncError: text("sync_error"), // Error message if sync failed
  summaryEmailStatus: text("summary_email_status"), // 'not_sent', 'sent', 'failed'
  summaryEmailSentAt: timestamp("summary_email_sent_at"),
  
  // Recurring meeting series fields
  seriesId: varchar("series_id"), // Links instances of same recurring series
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'
  recurrenceEndDate: timestamp("recurrence_end_date"), // When the series ends
  recurrenceDay: integer("recurrence_day"), // Day of week (0-6) or day of month (1-31)
  
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantMeeting: unique().on(table.tenantId, table.title, table.date, table.meetingTime),
}));

const actionItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  completed: z.boolean(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  updatedAt: true,
}).extend({
  date: z.string().datetime().or(z.date()).nullable().optional(),
  nextMeetingDate: z.string().datetime().or(z.date()).nullable().optional(),
  meetingTime: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  actionItems: z.array(actionItemSchema).nullable().optional(),
  agenda: z.array(z.string()).nullable().optional(),
  agendaTimes: z.record(z.string(), z.number().int().nonnegative()).nullable().optional(),
  risks: z.array(z.string()).nullable().optional(),
  linkedObjectiveIds: z.array(z.string()).nullable().optional(),
  linkedKeyResultIds: z.array(z.string()).nullable().optional(),
  linkedBigRockIds: z.array(z.string()).nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.union([z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly']), z.literal('')]).transform(val => val === '' ? null : val).nullable().optional(),
  recurrenceEndDate: z.string().datetime().or(z.date()).nullable().optional(),
  recurrenceDay: z.number().nullable().optional(),
  liveState: liveMeetingStateSchema.nullable().optional(),
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
  parentId: varchar("parent_id").references((): AnyPgColumn => objectives.id, { onDelete: 'set null' }),
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
  closingNote: text("closing_note"), // Note captured when closing out an objective
  
  // Weight (for child objectives - included in parent's rollup alongside KRs)
  weight: integer("weight"), // Nullable - only set for child objectives participating in parent's weighted rollup
  isWeightLocked: boolean("is_weight_locked").default(false),
  
  // Time period
  quarter: integer("quarter"),
  year: integer("year"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Alignment and linking
  linkedStrategies: jsonb("linked_strategies").$type<string[]>(),
  linkedGoals: jsonb("linked_goals").$type<string[]>(),
  linkedValues: jsonb("linked_values").$type<string[]>(),
  alignedToObjectiveIds: jsonb("aligned_to_objective_ids").$type<string[]>(), // Many-to-many: objectives that this objective supports/ladders up to
  
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

  // Origin tracking - set when objective was created from a Quarterly Planning Workshop (#63)
  originWorkshopId: varchar("origin_workshop_id"),

  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckInAt: timestamp("last_check_in_at"),
  lastCheckInNote: text("last_check_in_note"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  // OKR approval workflow (Task #59). state is independent of `status` (which
  // tracks progress health). Allowed values: draft, pending_approval, active,
  // closed, archived. Default 'active' so existing rows are unaffected when
  // approvals are disabled (the default tenant setting).
  state: text("state").default('active'),
  submittedForApprovalAt: timestamp("submitted_for_approval_at"),
  submittedForApprovalBy: varchar("submitted_for_approval_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  lastRejectionNote: text("last_rejection_note"),
}, (table) => ({
  uniqueTenantObjective: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

// Audit trail for OKR approval state transitions (Task #59).
export const okrApprovalHistory = pgTable("okr_approval_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  objectiveId: varchar("objective_id").notNull().references(() => objectives.id, { onDelete: 'cascade' }),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOkrApprovalHistorySchema = createInsertSchema(okrApprovalHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertOkrApprovalHistory = z.infer<typeof insertOkrApprovalHistorySchema>;
export type OkrApprovalHistory = typeof okrApprovalHistory.$inferSelect;

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
  closingNote: text("closing_note"), // Note captured when closing out a key result
  
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
  
  // Planner progress mapping - derive progress from task completion in a plan/bucket
  plannerPlanId: varchar("planner_plan_id").references(() => plannerPlans.id),
  plannerBucketId: varchar("planner_bucket_id").references(() => plannerBuckets.id),
  plannerSyncEnabled: boolean("planner_sync_enabled").default(false),
  plannerLastSyncAt: timestamp("planner_last_sync_at"),
  plannerSyncError: text("planner_sync_error"),

  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
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
  
  // Time period (quarter=0 means Annual, 1-4 means Q1-Q4)
  quarter: integer("quarter").notNull(),
  year: integer("year").notNull(),
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
  
  // Planner progress mapping - derive progress from task completion in a plan/bucket
  plannerPlanId: varchar("planner_plan_id").references(() => plannerPlans.id),
  plannerBucketId: varchar("planner_bucket_id").references(() => plannerBuckets.id),
  plannerSyncEnabled: boolean("planner_sync_enabled").default(false),
  plannerLastSyncAt: timestamp("planner_last_sync_at"),
  plannerSyncError: text("planner_sync_error"),

  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
}, (table) => ({
  uniqueTenantBigRock: unique().on(table.tenantId, table.title, table.quarter, table.year),
}));

// Big Rock Tasks - individual tasks within a Big Rock
export const bigRockTaskStatusEnum = ['open', 'in_progress', 'completed'] as const;
export type BigRockTaskStatus = typeof bigRockTaskStatusEnum[number];

export const bigRockTasks = pgTable("big_rock_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  bigRockId: varchar("big_rock_id").notNull().references(() => bigRocks.id, { onDelete: 'cascade' }),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Status: open -> in_progress -> completed
  status: text("status").notNull().default('open'),
  
  // Assignment
  assigneeId: varchar("assignee_id").references(() => users.id),
  assigneeEmail: text("assignee_email"),
  
  // Timeline
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  
  // Ordering
  sortOrder: integer("sort_order").default(0),
  
  // Planner sync (for future integration)
  plannerTaskId: text("planner_task_id"),
  
  // Metadata
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // Soft delete
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
});

export const insertBigRockTaskSchema = createInsertSchema(bigRockTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export type InsertBigRockTask = z.infer<typeof insertBigRockTaskSchema>;
export type BigRockTask = typeof bigRockTasks.$inferSelect;

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

  // Owner-reported confidence in hitting the target (0.0–1.0, 0.1 steps).
  // Nullable: a check-in may omit confidence.
  confidence: doublePrecision("confidence"),

  // User tracking
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: text("user_email"),
  
  // Timestamp
  asOfDate: timestamp("as_of_date").defaultNow(), // When the check-in data is from (user-changeable)
  createdAt: timestamp("created_at").defaultNow(), // When the check-in was recorded
});

// Daily progress snapshots - immutable per-day record of an entity's progress + status.
// Captured once per day by a scheduled job so forecasts/velocity have stable history
// that is not affected when users edit or delete check-ins.
export const progressSnapshots = pgTable("progress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Entity reference (no FK — entity may be deleted; we keep history)
  entityType: text("entity_type").notNull(), // 'objective' | 'key_result'
  entityId: varchar("entity_id").notNull(),

  // The Pacific-Time calendar date this snapshot represents (YYYY-MM-DD)
  snapshotDate: text("snapshot_date").notNull(),

  // Captured progress + status values
  progress: doublePrecision("progress").default(0),
  status: text("status"),
  paceStatus: text("pace_status"), // computed pace status at time of capture

  // Owner-reported confidence (0.0-1.0) carried from the latest check-in
  // active on the snapshot day. Nullable when no check-in supplied confidence.
  confidence: doublePrecision("confidence"),

  // Optional source metadata (e.g. 'job', 'backfill', 'manual')
  source: text("source").default('job'),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueSnapshotPerDay: unique().on(table.tenantId, table.entityType, table.entityId, table.snapshotDate),
}));

export const insertProgressSnapshotSchema = createInsertSchema(progressSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertProgressSnapshot = z.infer<typeof insertProgressSnapshotSchema>;
export type ProgressSnapshot = typeof progressSnapshots.$inferSelect;

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

// Confidence is stored as a decimal in [0.0, 1.0] with 0.1 increments.
// Nullable + optional so a check-in may omit confidence entirely.
export const checkInConfidenceSchema = z
  .number()
  .min(0)
  .max(1)
  .refine(
    (v) => Number.isFinite(v) && Math.abs(Math.round(v * 10) - v * 10) < 1e-6,
    { message: "Confidence must be in 0.1 increments between 0.0 and 1.0" },
  )
  .nullable()
  .optional();

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
}).extend({
  asOfDate: z.string().datetime().or(z.date()).optional(),
  confidence: checkInConfidenceSchema,
});

export const updateCheckInSchema = z.object({
  newValue: z.number().optional(),
  newProgress: z.number().min(0), // No max - progress can exceed 100% when targets are exceeded
  newStatus: z.string().optional(),
  note: z.string().optional(),
  achievements: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  asOfDate: z.string().datetime().or(z.date()).optional(),
  confidence: checkInConfidenceSchema,
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

// Report template types
export const REPORT_TEMPLATE_TYPES = ['weekly_status', 'qbr', 'annual_review', 'custom'] as const;
export const REPORT_SECTION_TYPES = ['objectives_summary', 'key_results_table', 'big_rocks_status', 'progress_chart', 'achievements', 'challenges', 'next_priorities', 'custom_text'] as const;

// Report templates for generating branded reports
export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }), // null = global template
  
  // Template metadata
  name: text("name").notNull(),
  description: text("description"),
  templateType: text("template_type").notNull(), // 'weekly_status', 'qbr', 'annual_review', 'custom'
  isDefault: boolean("is_default").default(false),
  
  // Template configuration
  sections: jsonb("sections").$type<{
    id: string;
    type: string; // 'objectives_summary', 'key_results_table', 'big_rocks_status', 'progress_chart', 'achievements', 'challenges', 'next_priorities', 'custom_text'
    position: number;
    title?: string;
    config?: Record<string, any>;
  }[]>(),
  
  // Filters for data inclusion
  filters: jsonb("filters").$type<{
    objectiveLevels?: string[]; // 'organization', 'team', 'individual'
    includeCompleted?: boolean;
    minProgress?: number;
    maxProgress?: number;
    teamIds?: string[];
  }>(),
  
  // Branding overrides (uses tenant branding by default)
  brandingOverrides: jsonb("branding_overrides").$type<{
    logoUrl?: string;
    primaryColor?: string;
    headerText?: string;
    footerText?: string;
  }>(),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;

// Generated report instances
export const reportInstances = pgTable("report_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").references(() => reportTemplates.id),
  snapshotId: varchar("snapshot_id").references(() => reviewSnapshots.id),
  
  // Report metadata
  title: text("title").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // 'weekly_status', 'qbr', 'annual_review', 'custom'
  
  // Time period
  periodType: text("period_type").notNull(), // 'week', 'month', 'quarter', 'year'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  quarter: integer("quarter"),
  year: integer("year").notNull(),
  
  // Generation status
  status: text("status").notNull().default('pending'), // 'pending', 'generating', 'completed', 'failed'
  generatedAt: timestamp("generated_at"),
  generationError: text("generation_error"),
  
  // Output files
  pdfUrl: text("pdf_url"),
  pdfSize: integer("pdf_size"),
  
  // Report data snapshot (cached for fast viewing)
  reportData: jsonb("report_data").$type<{
    summary: {
      totalObjectives: number;
      completedObjectives: number;
      averageProgress: number;
      totalKeyResults: number;
      completedKeyResults: number;
      totalBigRocks: number;
      completedBigRocks: number;
      onTrackCount?: number;
      atRiskCount?: number;
      behindCount?: number;
      progressByLevel?: { level: string; avgProgress: number; count: number }[];
    };
    objectives?: any[];
    keyResults?: any[];
    bigRocks?: any[];
    teams?: any[];
    checkIns?: any[];
    achievements?: string[];
    challenges?: string[];
    aiSummary?: {
      headline: string;
      keyThemes: string[];
      guidance: string;
      generatedAt: string;
    };
  }>(),
  
  // Delivery tracking
  emailedTo: jsonb("emailed_to").$type<string[]>(),
  emailedAt: timestamp("emailed_at"),
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReportInstanceSchema = createInsertSchema(reportInstances).omit({
  id: true,
  createdAt: true,
  generatedAt: true,
  downloadCount: true,
  lastDownloadedAt: true,
});

export type InsertReportInstance = z.infer<typeof insertReportInstanceSchema>;
export type ReportInstance = typeof reportInstances.$inferSelect;

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
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Document metadata
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // INSTRUCTIONAL: 'methodology', 'best_practices', 'terminology', 'examples' | CONTEXTUAL: 'background_context', 'company_os'
  
  // Document content
  content: text("content").notNull(),
  
  // Priority for context injection (higher = included first)
  priority: integer("priority").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Tenant background context - when true, this document is automatically included
  // in AI context for all conversations within this tenant
  isTenantBackground: boolean("is_tenant_background").default(false),
  
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

// Microsoft Graph tokens for per-user API access (Planner, Outlook, etc.)
export const graphTokens = pgTable("graph_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Service identifier (planner, outlook) - allows multiple tokens per user
  service: varchar("service").notNull().default('planner'),
  
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
  uniqueUserServiceToken: unique().on(table.userId, table.service),
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
  groupDisplayName: text("group_display_name"),
  
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

// Consultant Tenant Access Grants
// Consultants can only access tenants they've been explicitly granted access to
export const consultantTenantAccess = pgTable("consultant_tenant_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantUserId: varchar("consultant_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
}, (table) => ({
  uniqueConsultantTenant: unique().on(table.consultantUserId, table.tenantId),
}));

export const insertConsultantTenantAccessSchema = createInsertSchema(consultantTenantAccess).omit({
  id: true,
  grantedAt: true,
});

export type InsertConsultantTenantAccess = z.infer<typeof insertConsultantTenantAccessSchema>;
export type ConsultantTenantAccess = typeof consultantTenantAccess.$inferSelect;

// ========== AI USAGE TRACKING ==========
// Track AI API calls for billing, monitoring, and optimization
// Designed to support provider switching (Replit AI → Azure OpenAI → Anthropic)

// AI Provider enum for tracking which service is used
export const AI_PROVIDERS = {
  REPLIT: 'replit_ai',           // Replit AI Integrations (OpenAI-compatible)
  AZURE_OPENAI: 'azure_openai',  // Azure OpenAI Service (your own deployment)
  OPENAI: 'openai',              // Direct OpenAI API
  ANTHROPIC: 'anthropic',        // Anthropic Claude
  OTHER: 'other',
} as const;

export type AIProvider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

// AI Features for tracking which feature used AI
export const AI_FEATURES = {
  CHAT: 'chat',                          // General AI chat
  OKR_SUGGESTION: 'okr_suggestion',      // OKR drafting suggestions
  BIG_ROCK_SUGGESTION: 'big_rock_suggestion',
  MEETING_RECAP: 'meeting_recap',        // Meeting recap parsing
  STRATEGY_DRAFT: 'strategy_draft',      // Strategy drafting
  FUNCTION_CALL: 'function_call',        // Tool/function calling
  EMBEDDING: 'embedding',                // Text embeddings (future)
  OKR_QUALITY_SCORING: 'okr_quality_scoring', // OKR quality scoring during creation
  CHECK_IN_REWRITE: 'check_in_rewrite',  // AI rewriting of check-in notes
  CHECK_IN_DRAFT: 'check_in_draft',      // AI drafting check-in summary from children
  MEETING_AGENDA: 'meeting_agenda',      // AI generating meeting agenda items
  OTHER: 'other',
} as const;

export type AIFeature = typeof AI_FEATURES[keyof typeof AI_FEATURES];

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  
  // Provider & Model identification - essential for tracking impact of model changes
  provider: text("provider").notNull(),                  // 'replit_ai', 'azure_openai', 'anthropic'
  model: text("model").notNull(),                        // 'gpt-4o', 'gpt-5', 'claude-3.5-sonnet', etc.
  modelVersion: text("model_version"),                   // Optional: specific version like '2024-08-06'
  deploymentName: text("deployment_name"),               // Azure OpenAI deployment name (if applicable)
  
  // Feature tracking
  feature: text("feature").notNull(),                    // Which Vega feature triggered this call
  
  // Token usage
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  
  // Cost tracking (in microdollars for precision, 1 cent = 10000 microdollars)
  estimatedCostMicrodollars: integer("estimated_cost_microdollars"),
  
  // Performance metrics
  latencyMs: integer("latency_ms"),
  wasStreaming: boolean("was_streaming").default(false),
  
  // Request metadata
  requestId: text("request_id"),                         // Provider's request ID for debugging
  errorCode: text("error_code"),                         // If request failed
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;

// AI Usage Summary - for quick tenant-level reporting (materialized/cached)
export const aiUsageSummaries = pgTable("ai_usage_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Period
  periodType: text("period_type").notNull(),             // 'daily', 'monthly'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Aggregated usage
  totalRequests: integer("total_requests").notNull().default(0),
  totalPromptTokens: integer("total_prompt_tokens").notNull().default(0),
  totalCompletionTokens: integer("total_completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalCostMicrodollars: integer("total_cost_microdollars").notNull().default(0),
  
  // Breakdown by model (JSON for flexibility as models change)
  usageByModel: jsonb("usage_by_model").$type<Record<string, {
    requests: number;
    tokens: number;
    costMicrodollars: number;
  }>>(),
  
  // Breakdown by feature
  usageByFeature: jsonb("usage_by_feature").$type<Record<string, {
    requests: number;
    tokens: number;
    costMicrodollars: number;
  }>>(),
  
  // Timestamps
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => ({
  uniqueTenantPeriod: unique().on(table.tenantId, table.periodType, table.periodStart),
}));

export const insertAiUsageSummarySchema = createInsertSchema(aiUsageSummaries).omit({
  id: true,
  calculatedAt: true,
});

export type InsertAiUsageSummary = z.infer<typeof insertAiUsageSummarySchema>;
export type AiUsageSummary = typeof aiUsageSummaries.$inferSelect;

// ========== AI CONFIGURATION ==========
// Platform-level AI provider configuration for admin-controlled model switching

export type AzureOpenAIConfig = {
  endpoint: string;           // e.g., https://your-resource.openai.azure.com
  deploymentName: string;     // Your model deployment name
  apiVersion: string;         // e.g., 2024-06-01
  authType: 'api_key' | 'azure_ad';
  // API key is stored as secret, not in this config
};

export type OpenAIConfig = {
  organizationId?: string;    // Optional org ID
  // API key is stored as secret, not in this config
};

export type AnthropicConfig = {
  // API key is stored as secret, not in this config
  // No additional config needed
};

export type AIProviderConfig = {
  azure_openai?: AzureOpenAIConfig;
  openai?: OpenAIConfig;
  anthropic?: AnthropicConfig;
};

// Available models per provider
export const AI_MODELS = {
  replit_ai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-opus-4', 'claude-opus-4-5'],
  azure_openai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'],
  openai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4', 'claude-opus-4', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
} as const;

// Model display names, pricing, and specifications
// Costs are in dollars per 1M tokens (e.g., 5.00 = $5 per million tokens)
export const AI_MODEL_INFO: Record<string, { 
  name: string; 
  description: string; 
  costTier: 'low' | 'medium' | 'high';
  providers: string[];  // List of providers that support this model
  contextWindow: number;
  costPer1kPrompt: number;  // dollars per 1K tokens
  costPer1kCompletion: number;  // dollars per 1K tokens
}> = {
  'gpt-5': { name: 'GPT-5', description: 'Most capable OpenAI model', costTier: 'high', providers: ['replit_ai', 'openai', 'azure_openai'], contextWindow: 128000, costPer1kPrompt: 0.005, costPer1kCompletion: 0.015 },
  'gpt-4o': { name: 'GPT-4o', description: 'Fast, multimodal model', costTier: 'medium', providers: ['replit_ai', 'openai', 'azure_openai'], contextWindow: 128000, costPer1kPrompt: 0.0025, costPer1kCompletion: 0.01 },
  'gpt-4o-mini': { name: 'GPT-4o Mini', description: 'Cost-effective for simple tasks', costTier: 'low', providers: ['replit_ai', 'openai', 'azure_openai'], contextWindow: 128000, costPer1kPrompt: 0.00015, costPer1kCompletion: 0.0006 },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', description: 'Enhanced GPT-4 with vision', costTier: 'medium', providers: ['openai', 'azure_openai'], contextWindow: 128000, costPer1kPrompt: 0.01, costPer1kCompletion: 0.03 },
  'gpt-4': { name: 'GPT-4', description: 'Original GPT-4 model', costTier: 'medium', providers: ['openai', 'azure_openai'], contextWindow: 8192, costPer1kPrompt: 0.03, costPer1kCompletion: 0.06 },
  'claude-sonnet-4': { name: 'Claude Sonnet 4', description: 'Fast, balanced Anthropic model', costTier: 'medium', providers: ['replit_ai', 'anthropic'], contextWindow: 200000, costPer1kPrompt: 0.003, costPer1kCompletion: 0.015 },
  'claude-opus-4': { name: 'Claude Opus 4', description: 'Most capable coding model', costTier: 'high', providers: ['replit_ai', 'anthropic'], contextWindow: 200000, costPer1kPrompt: 0.015, costPer1kCompletion: 0.075 },
  'claude-opus-4-5': { name: 'Claude Opus 4.5', description: 'Latest Anthropic model, best reasoning', costTier: 'high', providers: ['replit_ai', 'anthropic'], contextWindow: 200000, costPer1kPrompt: 0.005, costPer1kCompletion: 0.025 },
  'claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', description: 'Previous generation, balanced', costTier: 'medium', providers: ['anthropic'], contextWindow: 200000, costPer1kPrompt: 0.003, costPer1kCompletion: 0.015 },
  'claude-3.5-haiku': { name: 'Claude 3.5 Haiku', description: 'Fast and cost-effective', costTier: 'low', providers: ['anthropic'], contextWindow: 200000, costPer1kPrompt: 0.001, costPer1kCompletion: 0.005 },
  'claude-3-opus': { name: 'Claude 3 Opus', description: 'Previous generation, powerful', costTier: 'high', providers: ['anthropic'], contextWindow: 200000, costPer1kPrompt: 0.015, costPer1kCompletion: 0.075 },
  'claude-3-sonnet': { name: 'Claude 3 Sonnet', description: 'Previous generation, balanced', costTier: 'medium', providers: ['anthropic'], contextWindow: 200000, costPer1kPrompt: 0.003, costPer1kCompletion: 0.015 },
  'claude-3-haiku': { name: 'Claude 3 Haiku', description: 'Previous generation, fast', costTier: 'low', providers: ['anthropic'], contextWindow: 200000, costPer1kPrompt: 0.00025, costPer1kCompletion: 0.00125 },
};

export const aiConfiguration = pgTable("ai_configuration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Active provider and model
  activeProvider: text("active_provider").notNull().default('replit_ai'),
  activeModel: text("active_model").notNull().default('gpt-4o'),
  
  // Provider-specific configuration (non-secret settings)
  providerConfig: jsonb("provider_config").$type<AIProviderConfig>(),
  
  // Feature flags
  enableStreaming: boolean("enable_streaming").default(true),
  enableFunctionCalling: boolean("enable_function_calling").default(true),
  
  // Rate limiting / cost controls
  maxTokensPerRequest: integer("max_tokens_per_request").default(4000),
  monthlyTokenBudget: integer("monthly_token_budget"),  // null = unlimited
  
  // Audit trail
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiConfigurationSchema = createInsertSchema(aiConfiguration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;
export type AiConfiguration = typeof aiConfiguration.$inferSelect;

// Launchpad Sessions - AI-powered document-to-Company OS generator
export type LaunchpadProposal = {
  mission?: string | null;
  vision?: string | null;
  values?: Array<{ title: string; description: string }>;
  goals?: Array<{ title: string; description: string }>;
  strategies?: Array<{ title: string; description: string; linkedGoals?: string[] }>;
  objectives?: Array<{
    title: string;
    description: string;
    level: string;
    keyResults?: Array<{
      title: string;
      metricType: string;
      targetValue: number;
      unit?: string;
    }>;
    bigRocks?: Array<{
      title: string;
      description: string;
      priority: string;
    }>;
  }>;
  bigRocks?: Array<{
    title: string;
    description: string;
    priority: string;
    quarter?: number;
  }>;
  ambitions?: Array<{
    title: string;
    description?: string;
    targetYear: number;
  }>;
};

// Existing data reference for Launchpad review UI
export type LaunchpadExistingData = {
  mission: string | null;
  vision: string | null;
  values: Array<{ title: string; description: string }>;
  ambitions: Ambition[];
  annualGoals: AnnualGoal[];
  strategies: Array<{ id: string; title: string; description: string | null }>;
  objectives: Array<{ id: string; title: string; description: string | null }>;
};

export const launchpadSessions = pgTable("launchpad_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  sourceDocumentName: text("source_document_name"),
  sourceDocumentText: text("source_document_text"),
  
  aiProposal: jsonb("ai_proposal").$type<LaunchpadProposal>(),
  userEdits: jsonb("user_edits").$type<LaunchpadProposal>(),
  existingData: jsonb("existing_data").$type<LaunchpadExistingData>(),
  
  // Per-section approval toggles (default all to true for new sessions)
  approveMission: boolean("approve_mission").default(true),
  approveVision: boolean("approve_vision").default(true),
  approveValues: boolean("approve_values").default(true),
  approveGoals: boolean("approve_goals").default(true),
  approveStrategies: boolean("approve_strategies").default(true),
  approveObjectives: boolean("approve_objectives").default(true),
  approveBigRocks: boolean("approve_big_rocks").default(true),
  approveAmbitions: boolean("approve_ambitions").default(true),
  
  status: text("status").notNull().default("draft"),
  targetYear: integer("target_year").notNull(),
  targetQuarter: integer("target_quarter"),
  
  analysisProgress: integer("analysis_progress").default(0),
  analysisError: text("analysis_error"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const insertLaunchpadSessionSchema = createInsertSchema(launchpadSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export type InsertLaunchpadSession = z.infer<typeof insertLaunchpadSessionSchema>;
export type LaunchpadSession = typeof launchpadSessions.$inferSelect;

// ============================================
// MCP (Model Context Protocol) API Keys
// ============================================

export const MCP_KEY_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
} as const;

export type McpKeyStatus = typeof MCP_KEY_STATUS[keyof typeof MCP_KEY_STATUS];

export const MCP_SCOPES = {
  READ_OKRS: 'read:okrs',
  WRITE_OKRS: 'write:okrs',
  READ_BIG_ROCKS: 'read:big_rocks',
  WRITE_BIG_ROCKS: 'write:big_rocks',
  READ_STRATEGIES: 'read:strategies',
  READ_FOUNDATIONS: 'read:foundations',
  READ_TEAMS: 'read:teams',
  READ_MEETINGS: 'read:meetings',
} as const;

export type McpScope = typeof MCP_SCOPES[keyof typeof MCP_SCOPES];

export const mcpApiKeys = pgTable("mcp_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes").array().notNull(),
  status: text("status").notNull().default("active"),
  allowedIps: text("allowed_ips").array(), // Optional IP allowlist (CIDR notation supported)
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by"),
  rotatedFromId: varchar("rotated_from_id"), // For key rotation: links to the key this was rotated from
  rotationGracePeriodEnds: timestamp("rotation_grace_period_ends"), // When the old key stops working
  directAuth: boolean("direct_auth").default(false).notNull(), // When true, API key can be used directly without token exchange
});

export const insertMcpApiKeySchema = createInsertSchema(mcpApiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
  revokedBy: true,
});

export type InsertMcpApiKey = z.infer<typeof insertMcpApiKeySchema>;
export type McpApiKey = typeof mcpApiKeys.$inferSelect;

// MCP Audit Logs - tracks all MCP tool invocations
export const mcpAuditLogs = pgTable("mcp_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  apiKeyId: varchar("api_key_id").references(() => mcpApiKeys.id, { onDelete: 'set null' }),
  toolName: text("tool_name").notNull(),
  toolParams: jsonb("tool_params"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMcpAuditLogSchema = createInsertSchema(mcpAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertMcpAuditLog = z.infer<typeof insertMcpAuditLogSchema>;
export type McpAuditLog = typeof mcpAuditLogs.$inferSelect;

// ============================================
// Galaxy Portal Audit Logs
// Tracks every /api/portal/* request for security/observability.
// ============================================
export const portalAuditLogs = pgTable("portal_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  galaxyClientId: text("galaxy_client_id"),
  galaxyUserId: text("galaxy_user_id"),
  route: text("route").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull(),
  durationMs: integer("duration_ms"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortalAuditLogSchema = createInsertSchema(portalAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertPortalAuditLog = z.infer<typeof insertPortalAuditLogSchema>;
export type PortalAuditLog = typeof portalAuditLogs.$inferSelect;

// ============================================
// SCHEDULED JOBS - Background Job Management
// ============================================

export const JOB_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISABLED: 'disabled',
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

export const JOB_RUN_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  KILLED: 'killed',
} as const;

export type JobRunStatus = typeof JOB_RUN_STATUS[keyof typeof JOB_RUN_STATUS];

// Registered scheduled jobs
export const scheduledJobs = pgTable("scheduled_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // Unique identifier (e.g., 'expiration-reminders')
  displayName: text("display_name").notNull(), // Human-readable name
  description: text("description"), // What this job does
  category: text("category").notNull().default("system"), // 'system', 'sync', 'notification', 'maintenance'
  scheduleExpression: text("schedule_expression").notNull(), // e.g., "every 1 hour", "daily at midnight"
  intervalMs: integer("interval_ms"), // Interval in milliseconds (for setInterval-based jobs)
  status: text("status").notNull().default("active"), // 'active', 'paused', 'disabled'
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }), // null = global job
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  config: jsonb("config"), // Job-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobs.$inferSelect;

// Job execution history
export const jobRuns = pgTable("job_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => scheduledJobs.id, { onDelete: 'cascade' }),
  jobName: text("job_name").notNull(), // Denormalized for easier querying
  status: text("status").notNull(), // 'running', 'success', 'failed', 'skipped', 'killed'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  triggeredBy: text("triggered_by").notNull().default("schedule"), // 'schedule', 'manual', 'startup'
  triggeredByUserId: varchar("triggered_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  killedByUserId: varchar("killed_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  killedAt: timestamp("killed_at"),
  summary: text("summary"), // Brief summary of what was done (e.g., "Sent 3 expiration reminders")
  resultSummary: jsonb("result_summary"), // Structured result data (aligned with Constellation pattern)
  details: jsonb("details"), // Detailed execution data
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
});

export const insertJobRunSchema = createInsertSchema(jobRuns).omit({
  id: true,
  completedAt: true,
  durationMs: true,
});

export type InsertJobRun = z.infer<typeof insertJobRunSchema>;
export type JobRun = typeof jobRuns.$inferSelect;

// ============================================
// SUPPORT TICKETS
// ============================================

export const TICKET_CATEGORIES = ['bug', 'feature_request', 'question', 'feedback'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export type TicketCategory = typeof TICKET_CATEGORIES[number];
export type TicketPriority = typeof TICKET_PRIORITIES[number];
export type TicketStatus = typeof TICKET_STATUSES[number];

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: integer("ticket_number").notNull(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text("category").notNull(), // 'bug', 'feature_request', 'question', 'feedback'
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high'
  status: text("status").notNull().default("open"), // 'open', 'in_progress', 'resolved', 'closed'
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb("metadata"), // Browser info, current page, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: 'set null' }),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  resolvedBy: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export const supportTicketReplies = pgTable("support_ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal notes vs user-visible replies
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketReplySchema = createInsertSchema(supportTicketReplies).omit({
  id: true,
  createdAt: true,
});

export type InsertSupportTicketReply = z.infer<typeof insertSupportTicketReplySchema>;
export type SupportTicketReply = typeof supportTicketReplies.$inferSelect;

// Audit trail for ticket changes (status, assignment, priority)
export const supportTicketHistory = pgTable("support_ticket_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  field: text("field").notNull(), // 'status' | 'priority' | 'assignedTo' | 'category'
  fromValue: text("from_value"),
  toValue: text("to_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketHistorySchema = createInsertSchema(supportTicketHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertSupportTicketHistory = z.infer<typeof insertSupportTicketHistorySchema>;
export type SupportTicketHistory = typeof supportTicketHistory.$inferSelect;

// Predefined canned response templates available when admins reply to tickets
export const CANNED_RESPONSES: { id: string; title: string; body: string }[] = [
  {
    id: "acknowledge",
    title: "Acknowledge receipt",
    body: "Thanks for reaching out — we've received your ticket and a member of our team is looking into it now. We'll follow up here as soon as we have an update.",
  },
  {
    id: "need_more_info",
    title: "Request more information",
    body: "Thanks for the report. To help us reproduce this, could you share the steps you took, the page you were on, and (if possible) a screenshot of what you saw? Any browser/console errors would also help speed up the investigation.",
  },
  {
    id: "in_progress",
    title: "Work in progress",
    body: "Quick update — this is in progress on our side. We're testing a fix and will reply here once it has shipped to your environment.",
  },
  {
    id: "resolved_fixed",
    title: "Resolved (fix shipped)",
    body: "Good news — the fix for this has been deployed. Please refresh the page and let us know if you continue to see the issue. We're closing this ticket out, but feel free to reopen if anything changes.",
  },
  {
    id: "feature_logged",
    title: "Feature request logged",
    body: "Thanks for the suggestion! We've logged this in our product backlog for review. We can't promise a delivery date, but appreciate you taking the time to share the idea.",
  },
];

// ============================================
// IN-APP NOTIFICATIONS
// ============================================

export const NOTIFICATION_TYPES = [
  'assigned',
  'behind_pace',
  'support_reply',
  'ticket_status',
  'check_in_due',
  'mention',
  'plan_expiration',
  'system',
  'okr_approval_requested',
  'okr_approved',
  'okr_rejected',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  linkUrl: text("link_url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserEvent: unique("notification_pref_user_event_unique").on(table.userId, table.eventType),
}));

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export const oauthClients = pgTable("oauth_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clientId: varchar("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  scopes: text("scopes").array().notNull(),
  status: text("status").notNull().default("active"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOauthClientSchema = createInsertSchema(oauthClients).omit({
  id: true,
  createdAt: true,
});

export type InsertOauthClient = z.infer<typeof insertOauthClientSchema>;
export type OauthClient = typeof oauthClients.$inferSelect;

export const oauthAuthorizationCodes = pgTable("oauth_authorization_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  clientId: varchar("client_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  redirectUri: text("redirect_uri").notNull(),
  scopes: text("scopes").array().notNull(),
  codeChallenge: text("code_challenge"),
  codeChallengeMethod: text("code_challenge_method"),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OauthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;

export const oauthRefreshTokens = pgTable("oauth_refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  clientId: varchar("client_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OauthRefreshToken = typeof oauthRefreshTokens.$inferSelect;

// ============================================
// Global Search
// ============================================

export const SEARCH_ENTITY_TYPES = [
  'objective',
  'key_result',
  'big_rock',
  'strategy',
  'ambition',
  'team',
  'meeting',
  'ticket',
  'document',
] as const;
export type SearchEntityType = typeof SEARCH_ENTITY_TYPES[number];

export type SearchResult = {
  type: SearchEntityType;
  id: string;
  title: string;
  snippet?: string;
  parentContext?: string;
  url: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  total: number;
  results: SearchResult[];
};

// ============================================
// REASSIGNMENT AUDIT LOGS - Tracks bulk ownership transfers
// ============================================

export type ReassignmentCounts = {
  objectivesPrimary: number;
  objectivesCoOwner: number;
  objectivesCheckIn: number;
  keyResults: number;
  bigRocksOwner: number;
  bigRocksAccountable: number;
  ambitions: number;
  strategies: number;
  meetingsFacilitator: number;
  meetingsAttendee: number;
  supportTickets: number;
  total: number;
};

export const reassignmentAuditLogs = pgTable("reassignment_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  fromUserId: varchar("from_user_id").notNull(),
  fromUserEmail: text("from_user_email").notNull(),
  fromUserName: text("from_user_name"),
  toUserId: varchar("to_user_id").notNull(),
  toUserEmail: text("to_user_email").notNull(),
  toUserName: text("to_user_name"),
  performedById: varchar("performed_by_id").notNull(),
  performedByEmail: text("performed_by_email").notNull(),
  performedByName: text("performed_by_name"),
  counts: jsonb("counts").$type<ReassignmentCounts>().notNull(),
  notes: text("notes"),
  status: text("status").notNull().default('completed'),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReassignmentAuditLogSchema = createInsertSchema(reassignmentAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertReassignmentAuditLog = z.infer<typeof insertReassignmentAuditLogSchema>;
export type ReassignmentAuditLog = typeof reassignmentAuditLogs.$inferSelect;

// ============================================
// ADMIN ALERTS - Tenant-visible operational alerts (depth-cap, etc.)
// ============================================

export const ADMIN_ALERT_TYPE = {
  OBJECTIVE_DEPTH_CAP: 'objective_depth_cap',
} as const;

export type AdminAlertType = typeof ADMIN_ALERT_TYPE[keyof typeof ADMIN_ALERT_TYPE];

export const ADMIN_ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type AdminAlertSeverity = typeof ADMIN_ALERT_SEVERITY[keyof typeof ADMIN_ALERT_SEVERITY];

export const adminAlerts = pgTable("admin_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  alertType: text("alert_type").notNull(),
  fingerprint: text("fingerprint").notNull(),
  severity: text("severity").notNull().default("warning"),
  message: text("message").notNull(),
  details: jsonb("details"),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  uniqTenantTypeFingerprint: unique("admin_alerts_tenant_type_fp_unique").on(t.tenantId, t.alertType, t.fingerprint),
}));

export const insertAdminAlertSchema = createInsertSchema(adminAlerts).omit({
  id: true,
  occurrenceCount: true,
  firstSeenAt: true,
  lastSeenAt: true,
  acknowledgedAt: true,
  acknowledgedBy: true,
});

export type InsertAdminAlert = z.infer<typeof insertAdminAlertSchema>;
export type AdminAlert = typeof adminAlerts.$inferSelect;

// ============================================
// WEEKLY AI DIGEST (Task #62)
// ============================================
// Idempotency log for the weekly digest job. Unique on (userId, periodStart) so
// the job can re-run safely without re-emailing the same person twice for the
// same Monday.
export const WEEKLY_DIGEST_STATUS = {
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;

export type WeeklyDigestStatus = typeof WEEKLY_DIGEST_STATUS[keyof typeof WEEKLY_DIGEST_STATUS];

export const weeklyDigestSends = pgTable("weekly_digest_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The Monday (YYYY-MM-DD, in tenant local time) the digest covers — week start.
  periodStart: text("period_start").notNull(),
  status: text("status").notNull().default('sent'),
  sendAt: timestamp("send_at").defaultNow().notNull(),
  // Whether AI narrative was used (vs deterministic fallback)
  aiUsed: boolean("ai_used").notNull().default(false),
  errorMessage: text("error_message"),
}, (table) => ({
  uniqueUserPeriod: unique().on(table.userId, table.periodStart),
}));

export const insertWeeklyDigestSendSchema = createInsertSchema(weeklyDigestSends).omit({
  id: true,
  sendAt: true,
});

export type InsertWeeklyDigestSend = z.infer<typeof insertWeeklyDigestSendSchema>;
export type WeeklyDigestSend = typeof weeklyDigestSends.$inferSelect;

// ============================================
// CUSTOM FIELDS - Tenant-defined fields on OKR entities
// ============================================

export const CUSTOM_FIELD_ENTITY_TYPES = ['objective', 'key_result', 'big_rock'] as const;
export type CustomFieldEntityType = typeof CUSTOM_FIELD_ENTITY_TYPES[number];

export const CUSTOM_FIELD_TYPES = ['short_text', 'number', 'date', 'single_select', 'multi_select'] as const;
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number];

export const MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY = 10;

export const customFieldDefs = pgTable("custom_field_defs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // CustomFieldEntityType
  key: text("key").notNull(), // stable identifier within (tenantId, entityType)
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(), // CustomFieldType
  description: text("description"),
  // For single_select / multi_select: { options: [{ value: string, label: string }] }
  optionsJson: jsonb("options_json").$type<{ options: Array<{ value: string; label: string }> }>(),
  required: boolean("required").default(false),
  sortOrder: integer("sort_order").default(0),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueTenantEntityKey: unique("custom_field_defs_tenant_entity_key_unique").on(
    table.tenantId, table.entityType, table.key
  ),
}));

export const insertCustomFieldDefSchema = createInsertSchema(customFieldDefs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
}).extend({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase letters, digits, and underscores, starting with a letter"),
  label: z.string().min(1).max(120),
  optionsJson: z.object({
    options: z.array(z.object({
      value: z.string().min(1).max(64),
      label: z.string().min(1).max(120),
    })).min(1).max(50),
  }).nullable().optional(),
});

export type InsertCustomFieldDef = z.infer<typeof insertCustomFieldDefSchema>;
export type CustomFieldDef = typeof customFieldDefs.$inferSelect;

export const customFieldValues = pgTable("custom_field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  fieldDefId: varchar("field_def_id").notNull().references(() => customFieldDefs.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  // valueJson is one of: { text: string } | { number: number } | { date: string ISO } | { value: string } | { values: string[] }
  valueJson: jsonb("value_json").notNull().$type<any>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueEntityField: unique("custom_field_values_entity_field_unique").on(table.entityId, table.fieldDefId),
}));

export type CustomFieldValue = typeof customFieldValues.$inferSelect;

/**
 * Validate a custom-field value map against active definitions.
 * Returns the normalized {fieldDefId -> valueJson} payload, or throws ZodError-like error.
 */
export function validateCustomFieldValues(
  defs: CustomFieldDef[],
  rawValues: Record<string, any> | undefined | null,
): { fieldDefId: string; valueJson: any }[] {
  if (!rawValues) return [];
  const activeDefs = defs.filter(d => !d.archivedAt);
  const byKey = new Map(activeDefs.map(d => [d.key, d]));
  const out: { fieldDefId: string; valueJson: any }[] = [];

  for (const [key, value] of Object.entries(rawValues)) {
    const def = byKey.get(key);
    if (!def) continue; // ignore unknown keys (could be archived or stale clients)
    if (value === null || value === undefined || value === "") {
      // Allow clearing
      out.push({ fieldDefId: def.id, valueJson: null });
      continue;
    }
    let payload: any;
    switch (def.fieldType as CustomFieldType) {
      case 'short_text': {
        if (typeof value !== 'string') throw new Error(`Field ${def.label} expects text`);
        if (value.length > 500) throw new Error(`Field ${def.label} exceeds 500 chars`);
        payload = { text: value };
        break;
      }
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n)) throw new Error(`Field ${def.label} expects a number`);
        payload = { number: n };
        break;
      }
      case 'date': {
        const d = typeof value === 'string' ? value : (value instanceof Date ? value.toISOString() : null);
        if (!d || Number.isNaN(new Date(d).getTime())) throw new Error(`Field ${def.label} expects a date`);
        payload = { date: new Date(d).toISOString() };
        break;
      }
      case 'single_select': {
        if (typeof value !== 'string') throw new Error(`Field ${def.label} expects a single value`);
        const allowed = (def.optionsJson?.options || []).map(o => o.value);
        if (!allowed.includes(value)) throw new Error(`Field ${def.label}: "${value}" is not an allowed option`);
        payload = { value };
        break;
      }
      case 'multi_select': {
        if (!Array.isArray(value)) throw new Error(`Field ${def.label} expects an array`);
        const allowed = new Set((def.optionsJson?.options || []).map(o => o.value));
        for (const v of value) {
          if (typeof v !== 'string' || !allowed.has(v)) {
            throw new Error(`Field ${def.label}: "${v}" is not an allowed option`);
          }
        }
        payload = { values: value };
        break;
      }
      default:
        throw new Error(`Unknown field type for ${def.label}`);
    }
    out.push({ fieldDefId: def.id, valueJson: payload });
  }

  // Required check
  const providedDefIds = new Set(out.filter(o => o.valueJson !== null).map(o => o.fieldDefId));
  for (const def of activeDefs) {
    if (def.required && !providedDefIds.has(def.id)) {
      throw new Error(`Field "${def.label}" is required`);
    }
  }
  return out;
}

/**
 * Convert stored {fieldDefId, valueJson} rows into a {key -> primitive} map for client consumption.
 */
export function hydrateCustomFieldValues(
  defs: CustomFieldDef[],
  values: Pick<CustomFieldValue, 'fieldDefId' | 'valueJson'>[],
): Record<string, any> {
  const byId = new Map(defs.map(d => [d.id, d]));
  const out: Record<string, any> = {};
  for (const v of values) {
    const def = byId.get(v.fieldDefId);
    if (!def) continue;
    const j = v.valueJson;
    if (j == null) continue;
    if ('text' in j) out[def.key] = j.text;
    else if ('number' in j) out[def.key] = j.number;
    else if ('date' in j) out[def.key] = j.date;
    else if ('value' in j) out[def.key] = j.value;
    else if ('values' in j) out[def.key] = j.values;
  }
  return out;
}

// ============================================
// ENTITY COMMENTS (Discussion threads on OKRs, Big Rocks, Check-ins)
// ============================================

export const COMMENT_ENTITY_TYPES = [
  'objective',
  'key_result',
  'big_rock',
  'check_in',
] as const;

export type CommentEntityType = typeof COMMENT_ENTITY_TYPES[number];

export const entityComments = pgTable("entity_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  parentCommentId: varchar("parent_comment_id"),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text("body").notNull(),
  mentionedUserIds: text("mentioned_user_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
});

export const insertEntityCommentSchema = createInsertSchema(entityComments).omit({
  id: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
});

export type InsertEntityComment = z.infer<typeof insertEntityCommentSchema>;
export type EntityComment = typeof entityComments.$inferSelect;

// ============================================
// SAVED VIEWS - Per-page saved filter/sort/group snapshots
// ============================================

export const SAVED_VIEW_PAGES = ['outcomes', 'my_focus', 'big_rocks'] as const;
export type SavedViewPage = typeof SAVED_VIEW_PAGES[number];

export const SAVED_VIEW_VISIBILITY = ['private', 'shared'] as const;
export type SavedViewVisibility = typeof SAVED_VIEW_VISIBILITY[number];

// Generic page filter shape; each page picks the keys it cares about. New
// filters can be added without breaking older saved views.
export type PageFilterState = {
  filters?: Record<string, unknown>;
  sort?: { field: string; direction: 'asc' | 'desc' };
  groupBy?: string;
  search?: string;
  [key: string]: unknown;
};

export const savedViews = pgTable("saved_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  page: text("page").notNull(),
  name: text("name").notNull(),
  filterJson: jsonb("filter_json").$type<PageFilterState>().notNull().default(sql`'{}'::jsonb`),
  visibility: text("visibility").notNull().default('private'),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertSavedViewSchema = createInsertSchema(savedViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).extend({
  page: z.enum(SAVED_VIEW_PAGES),
  visibility: z.enum(SAVED_VIEW_VISIBILITY).default('private'),
  name: z.string().trim().min(1, "Name is required").max(80),
  filterJson: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
});

export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type SavedView = typeof savedViews.$inferSelect;

// ============================================
// PLANNING WORKSHOPS (Task #63 - Quarterly Planning Workshop Mode)
// ============================================

export const WORKSHOP_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  CANCELLED: 'cancelled',
} as const;

export type WorkshopStatus = typeof WORKSHOP_STATUS[keyof typeof WORKSHOP_STATUS];

export const WORKSHOP_PHASE = {
  BRAINSTORM: 'brainstorm',
  VOTE: 'vote',
  DRAFT: 'draft',
} as const;

export type WorkshopPhase = typeof WORKSHOP_PHASE[keyof typeof WORKSHOP_PHASE];

export type WorkshopSettings = {
  quarter: number; // 0 = annual, 1-4 = Q1..Q4
  year: number;
  durationMinutes?: number;
  votesPerParticipant?: number;
  topNForDraft?: number;
  startedAt?: string;
  endsAt?: string;
  phase?: WorkshopPhase;
  drafts?: Record<string, WorkshopDraftEntry>; // candidateId -> draft
};

export type WorkshopDraftEntry = {
  ownerId?: string;
  ownerEmail?: string;
  level?: 'organization' | 'team' | 'individual';
  teamId?: string;
  keyResults?: Array<{
    title: string;
    metricType?: 'increase' | 'decrease' | 'maintain' | 'complete';
    targetValue?: number;
    initialValue?: number;
    unit?: string;
  }>;
};

export const planningWorkshops = pgTable("planning_workshops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  status: text("status").notNull().default('draft'),
  settings: jsonb("settings").$type<WorkshopSettings>().notNull(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  rev: integer("rev").notNull().default(0), // revision counter for long-poll
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertPlanningWorkshopSchema = createInsertSchema(planningWorkshops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  rev: true,
});

export type InsertPlanningWorkshop = z.infer<typeof insertPlanningWorkshopSchema>;
export type PlanningWorkshop = typeof planningWorkshops.$inferSelect;

export const workshopParticipants = pgTable("workshop_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workshopId: varchar("workshop_id").notNull().references(() => planningWorkshops.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role").notNull().default('participant'), // 'facilitator' | 'participant'
  joinedAt: timestamp("joined_at").defaultNow(),
}, (t) => ({
  uniqueWorkshopUser: unique().on(t.workshopId, t.userId),
}));

export const insertWorkshopParticipantSchema = createInsertSchema(workshopParticipants).omit({
  id: true,
  joinedAt: true,
});

export type InsertWorkshopParticipant = z.infer<typeof insertWorkshopParticipantSchema>;
export type WorkshopParticipant = typeof workshopParticipants.$inferSelect;

export const workshopCandidates = pgTable("workshop_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workshopId: varchar("workshop_id").notNull().references(() => planningWorkshops.id, { onDelete: 'cascade' }),
  theme: text("theme"),
  title: text("title").notNull(),
  description: text("description"),
  proposedByUserId: varchar("proposed_by_user_id").notNull().references(() => users.id),
  voteCount: integer("vote_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkshopCandidateSchema = createInsertSchema(workshopCandidates).omit({
  id: true,
  createdAt: true,
  voteCount: true,
});

export type InsertWorkshopCandidate = z.infer<typeof insertWorkshopCandidateSchema>;
export type WorkshopCandidate = typeof workshopCandidates.$inferSelect;

export const workshopVotes = pgTable("workshop_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workshopId: varchar("workshop_id").notNull().references(() => planningWorkshops.id, { onDelete: 'cascade' }),
  candidateId: varchar("candidate_id").notNull().references(() => workshopCandidates.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueVote: unique().on(t.workshopId, t.candidateId, t.userId),
}));

export const insertWorkshopVoteSchema = createInsertSchema(workshopVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkshopVote = z.infer<typeof insertWorkshopVoteSchema>;
export type WorkshopVote = typeof workshopVotes.$inferSelect;

// ============================================
// KR Webhook Tokens (inbound auto-update)
// Allows external systems (Datadog, Snowflake, Zapier, cron jobs, etc.)
// to POST a value into a key result via a per-token URL secured with HMAC.
// ============================================
export const krWebhookTokens = pgTable("kr_webhook_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  keyResultId: varchar("key_result_id").notNull().references(() => keyResults.id, { onDelete: 'cascade' }),
  label: text("label").notNull(),
  // SHA-256 hash of the public token (the URL slug). Public token is shown once at creation.
  tokenHash: text("token_hash").notNull().unique(),
  // SHA-256 hash of the HMAC shared secret. Secret is shown once at creation.
  secretHash: text("secret_hash").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  failureCount: integer("failure_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedByUserId: varchar("revoked_by_user_id").references(() => users.id, { onDelete: 'set null' }),
});

export const insertKrWebhookTokenSchema = createInsertSchema(krWebhookTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  failureCount: true,
  successCount: true,
  revokedAt: true,
  revokedByUserId: true,
});

export type InsertKrWebhookToken = z.infer<typeof insertKrWebhookTokenSchema>;
export type KrWebhookToken = typeof krWebhookTokens.$inferSelect;

// Per-attempt audit log for forensics. Records every ingest hit including
// failures (signature mismatch, archived KR, disabled token, rate limit, etc.).
export const webhookIngestLogs = pgTable("webhook_ingest_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  tokenId: varchar("token_id").references(() => krWebhookTokens.id, { onDelete: 'set null' }),
  keyResultId: varchar("key_result_id"),
  statusCode: integer("status_code").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  payloadSize: integer("payload_size"),
  sourceIp: text("source_ip"),
  userAgent: text("user_agent"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
});

export const insertWebhookIngestLogSchema = createInsertSchema(webhookIngestLogs).omit({
  id: true,
  requestedAt: true,
});

export type InsertWebhookIngestLog = z.infer<typeof insertWebhookIngestLogSchema>;
export type WebhookIngestLog = typeof webhookIngestLogs.$inferSelect;

// ============================================
// Embeddable Cards (Task #64)
// Public, signed URLs that render a tenant-scoped card (objective, key
// result, big rock, executive dashboard) for embedding in SharePoint,
// the Galaxy portal, intranets, etc. The raw token is shown once at
// creation; only its SHA-256 hash is stored.
// ============================================
export const EMBED_ENTITY_TYPES = ['objective', 'key_result', 'big_rock', 'executive_dashboard'] as const;
export type EmbedEntityType = typeof EMBED_ENTITY_TYPES[number];

export const embedTokens = pgTable("embed_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // EmbedEntityType
  // Nullable for tenant-wide cards like 'executive_dashboard'.
  entityId: varchar("entity_id"),
  label: text("label").notNull(),
  // SHA-256 hash of the public token (URL slug). Raw token returned once at creation.
  tokenHash: text("token_hash").notNull().unique(),
  // First few chars of raw token, kept for UI display ("vega_emb_abc1…").
  tokenPrefix: text("token_prefix").notNull(),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  accessCount: integer("access_count").notNull().default(0),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedByUserId: varchar("revoked_by_user_id").references(() => users.id, { onDelete: 'set null' }),
});

export const insertEmbedTokenSchema = createInsertSchema(embedTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  accessCount: true,
  revokedAt: true,
  revokedByUserId: true,
});

export type InsertEmbedToken = z.infer<typeof insertEmbedTokenSchema>;
export type EmbedToken = typeof embedTokens.$inferSelect;

export const embedAccessLogs = pgTable("embed_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),
  tokenId: varchar("token_id").references(() => embedTokens.id, { onDelete: 'set null' }),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  statusCode: integer("status_code").notNull(),
  durationMs: integer("duration_ms"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referer: text("referer"),
  format: text("format"), // 'html' | 'json'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmbedAccessLogSchema = createInsertSchema(embedAccessLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertEmbedAccessLog = z.infer<typeof insertEmbedAccessLogSchema>;
export type EmbedAccessLog = typeof embedAccessLogs.$inferSelect;

// Shared, multi-instance rate limit state for the webhook ingest endpoint.
// Implements a token bucket per (kind, key) — e.g. ('token', <tokenId>) or
// ('tenant', <tenantId>). Bucket capacity equals the configured per-window
// limit; tokens refill linearly at limit/window. Updates run as a single
// atomic upsert so every app instance shares the same bucket state.
export const webhookRateLimits = pgTable("webhook_rate_limits", {
  kind: text("kind").notNull(),
  key: text("key").notNull(),
  tokens: doublePrecision("tokens").notNull(),
  lastRefill: timestamp("last_refill", { withTimezone: true }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.kind, t.key] }),
}));
