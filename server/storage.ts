import { 
  users, type User, type InsertUser,
  tenants, type Tenant, type InsertTenant,
  foundations, type Foundation, type InsertFoundation,
  strategies, type Strategy, type InsertStrategy,
  okrs, type Okr, type InsertOkr,
  kpis, type Kpi, type InsertKpi,
  meetings, type Meeting, type InsertMeeting,
  objectives, type Objective, type InsertObjective,
  keyResults, type KeyResult, type InsertKeyResult,
  bigRocks, type BigRock, type InsertBigRock,
  bigRockTasks, type BigRockTask, type InsertBigRockTask,
  checkIns, type CheckIn, type InsertCheckIn,
  progressSnapshots, type ProgressSnapshot, type InsertProgressSnapshot,
  teams, type Team, type InsertTeam,
  objectiveValues,
  strategyValues,
  objectiveBigRocks, type InsertObjectiveBigRock,
  keyResultBigRocks, type InsertKeyResultBigRock,
  groundingDocuments, type GroundingDocument, type InsertGroundingDocument,
  graphTokens, type GraphToken, type InsertGraphToken,
  plannerPlans, type PlannerPlan, type InsertPlannerPlan,
  plannerBuckets, type PlannerBucket, type InsertPlannerBucket,
  plannerTasks, type PlannerTask, type InsertPlannerTask,
  objectivePlannerTasks,
  bigRockPlannerTasks,
  consultantTenantAccess, type ConsultantTenantAccess, type InsertConsultantTenantAccess,
  systemVocabulary, type SystemVocabulary, type VocabularyTerms, defaultVocabulary,
  aiUsageLogs, type AiUsageLog, type InsertAiUsageLog,
  aiUsageSummaries, type AiUsageSummary,
  aiConfiguration, type AiConfiguration, type InsertAiConfiguration,
  reviewSnapshots, type ReviewSnapshot, type InsertReviewSnapshot,
  reportTemplates, type ReportTemplate, type InsertReportTemplate,
  reportInstances, type ReportInstance, type InsertReportInstance,
  launchpadSessions, type LaunchpadSession, type InsertLaunchpadSession, type LaunchpadProposal,
  servicePlans, type ServicePlan, type InsertServicePlan,
  blockedDomains, type BlockedDomain, type InsertBlockedDomain,
  pageVisits, type PageVisit, type InsertPageVisit,
  systemBanners, type SystemBanner, type InsertSystemBanner, BANNER_STATUS,
  seoConfig, type SeoConfig, type InsertSeoConfig,
  landingPageSettings, type LandingPageSettings, type InsertLandingPageSettings,
  capabilitySection, type CapabilitySection, type InsertCapabilitySection,
  capabilityTabs, type CapabilityTab, type InsertCapabilityTab,
  mcpApiKeys, type McpApiKey, type InsertMcpApiKey,
  mcpAuditLogs, type McpAuditLog, type InsertMcpAuditLog,
  scheduledJobs, type ScheduledJob, type InsertScheduledJob,
  jobRuns, type JobRun, type InsertJobRun, JOB_STATUS, JOB_RUN_STATUS,
  supportTickets, type SupportTicket, type InsertSupportTicket,
  supportTicketReplies, type SupportTicketReply, type InsertSupportTicketReply,
  oauthClients, type OauthClient, type InsertOauthClient,
  oauthAuthorizationCodes, type OauthAuthorizationCode,
  oauthRefreshTokens, type OauthRefreshToken,
  type Ambition,
  notifications, type Notification, type InsertNotification,
  okrApprovalHistory, type OkrApprovalHistory, type InsertOkrApprovalHistory,
  reassignmentAuditLogs, type ReassignmentAuditLog, type InsertReassignmentAuditLog,
  type ReassignmentCounts,
  portalAuditLogs, type PortalAuditLog, type InsertPortalAuditLog,
  adminAlerts, type AdminAlert, type InsertAdminAlert, ADMIN_ALERT_TYPE, ADMIN_ALERT_SEVERITY,
  weeklyDigestSends, type WeeklyDigestSend, type InsertWeeklyDigestSend,
  notificationPreferences, type NotificationPreference, type InsertNotificationPreference,
  customFieldDefs, type CustomFieldDef, type InsertCustomFieldDef,
  customFieldValues, type CustomFieldValue,
  type CustomFieldEntityType, MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY,
  entityComments, type EntityComment, type InsertEntityComment,
  savedViews, type SavedView, type InsertSavedView, type SavedViewPage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, isNull, isNotNull, inArray, gte, lte, count, ilike, asc, type SQL } from "drizzle-orm";
import { hashPassword } from "./auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAzureObjectId(azureObjectId: string, tenantId?: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(tenantId?: string): Promise<User[]>;
  searchUsers(tenantId: string, query: string, limit: number): Promise<Pick<User, "id" | "email" | "name" | "role">[]>;
  getUsersByEmails(tenantId: string, emails: string[]): Promise<Pick<User, "id" | "email" | "name" | "role">[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  updateUserPassword(id: string, newPassword: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  
  getAllTenants(): Promise<Tenant[]>;
  getTenantById(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;
  
  getFoundationByTenantId(tenantId: string): Promise<Foundation | undefined>;
  upsertFoundation(foundation: InsertFoundation): Promise<Foundation>;
  
  getStrategiesByTenantId(tenantId: string): Promise<Strategy[]>;
  getStrategyById(id: string): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: string, strategy: Partial<InsertStrategy>): Promise<Strategy>;
  deleteStrategy(id: string, userId?: string): Promise<void>;
  restoreStrategy(id: string, tenantId: string): Promise<Strategy | undefined>;
  
  getOkrsByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Okr[]>;
  getOkrById(id: string): Promise<Okr | undefined>;
  createOkr(okr: InsertOkr): Promise<Okr>;
  updateOkr(id: string, okr: Partial<InsertOkr>): Promise<Okr>;
  deleteOkr(id: string): Promise<void>;
  
  getKpisByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Kpi[]>;
  getKpiById(id: string): Promise<Kpi | undefined>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: string, kpi: Partial<InsertKpi>): Promise<Kpi>;
  deleteKpi(id: string): Promise<void>;
  
  getMeetingsByTenantId(tenantId: string): Promise<Meeting[]>;
  getMeetingById(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  
  // Enhanced OKR Methods
  getObjectivesByTenantId(tenantId: string, quarter?: number, year?: number, level?: string, teamId?: string, options?: { viewerUserId?: string | null; viewerEmail?: string | null; includeAllStates?: boolean }): Promise<Objective[]>;
  getTeamsByTenantId(tenantId: string): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  getTeamByName(tenantId: string, name: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  getObjectiveById(id: string): Promise<Objective | undefined>;
  getChildObjectives(parentId: string): Promise<Objective[]>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: string, objective: Partial<InsertObjective>): Promise<Objective>;
  deleteObjective(id: string, userId?: string): Promise<void>;
  // OKR approval workflow (Task #59)
  submitObjectiveForApproval(id: string, actorUserId: string | null): Promise<Objective>;
  approveObjective(id: string, actorUserId: string | null, note?: string | null): Promise<Objective>;
  rejectObjective(id: string, actorUserId: string | null, note: string): Promise<Objective>;
  getObjectiveApprovalHistory(objectiveId: string): Promise<OkrApprovalHistory[]>;
  getApprovalQueueByTenantId(tenantId: string): Promise<Objective[]>;
  getApproverUserIds(tenantId: string): Promise<string[]>;
  restoreObjective(id: string, tenantId: string): Promise<Objective | undefined>;
  cloneObjective(objectiveId: string, options: {
    targetQuarter: number | null;
    targetYear: number;
    keepOriginalOwner: boolean;
    newOwnerId?: string;
    cloneScope: 'objective_only' | 'immediate_children' | 'all_children';
  }): Promise<Objective>;
  
  getKeyResultsByObjectiveId(objectiveId: string): Promise<KeyResult[]>;
  getKeyResultsByTenantId(tenantId: string, quarter?: number, year?: number, teamId?: string): Promise<KeyResult[]>;
  getKeyResultById(id: string): Promise<KeyResult | undefined>;
  getAllKeyResults(): Promise<KeyResult[]>;
  createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: string, keyResult: Partial<InsertKeyResult>): Promise<KeyResult>;
  deleteKeyResult(id: string, userId?: string): Promise<void>;
  restoreKeyResult(id: string, tenantId: string): Promise<KeyResult | undefined>;
  promoteKeyResultToKpi(keyResultId: string, userId: string): Promise<Kpi>;
  unpromoteKeyResultFromKpi(keyResultId: string): Promise<KeyResult>;
  getAllObjectives(): Promise<Objective[]>;
  
  getBigRocksByTenantId(tenantId: string, quarter?: number, year?: number): Promise<BigRock[]>;
  getBigRockById(id: string): Promise<BigRock | undefined>;
  getBigRockByIdForTenant(id: string, tenantId: string): Promise<BigRock | undefined>;
  getBigRocksByObjectiveId(objectiveId: string): Promise<BigRock[]>;
  getBigRocksByKeyResultId(keyResultId: string): Promise<BigRock[]>;
  getBigRocksWithPlannerSync(): Promise<BigRock[]>;
  createBigRock(bigRock: InsertBigRock): Promise<BigRock>;
  updateBigRock(id: string, bigRock: Partial<InsertBigRock>): Promise<BigRock>;
  deleteBigRock(id: string, userId?: string): Promise<void>;
  restoreBigRock(id: string, tenantId: string): Promise<BigRock | undefined>;
  
  // Big Rock Task methods
  getBigRockTasksByBigRockId(bigRockId: string): Promise<BigRockTask[]>;
  getBigRockTaskById(id: string): Promise<BigRockTask | undefined>;
  createBigRockTask(task: InsertBigRockTask): Promise<BigRockTask>;
  updateBigRockTask(id: string, task: Partial<InsertBigRockTask>): Promise<BigRockTask>;
  deleteBigRockTask(id: string): Promise<void>;
  reorderBigRockTasks(bigRockId: string, taskIds: string[]): Promise<void>;
  getBigRockTaskCountsByBigRockIds(bigRockIds: string[]): Promise<Map<string, { total: number; completed: number }>>;
  
  // Objective-BigRock linking methods
  linkObjectiveToBigRock(objectiveId: string, bigRockId: string, tenantId: string): Promise<void>;
  unlinkObjectiveToBigRock(objectiveId: string, bigRockId: string): Promise<void>;
  getBigRocksLinkedToObjective(objectiveId: string): Promise<BigRock[]>;
  getLinkedObjectiveIdsForBigRocks(bigRockIds: string[]): Promise<Map<string, string[]>>;
  
  // KeyResult-BigRock linking methods
  linkKeyResultToBigRock(keyResultId: string, bigRockId: string, tenantId: string): Promise<void>;
  unlinkKeyResultToBigRock(keyResultId: string, bigRockId: string): Promise<void>;
  getBigRocksLinkedToKeyResult(keyResultId: string): Promise<BigRock[]>;
  
  // Hierarchy methods
  getObjectiveHierarchy(tenantId: string, quarter?: number, year?: number, level?: string, teamId?: string): Promise<Array<Objective & {
    keyResults: KeyResult[];
    childObjectives: Objective[];
    alignedObjectives: Objective[]; // Objectives that "ladder up" to this one (virtual children)
    linkedBigRocks: BigRock[];
    lastUpdated: Date | null;
  }>>;
  getObjectiveSubtree(rootId: string, tenantId: string): Promise<Array<Objective & {
    keyResults: KeyResult[];
    childObjectives: Objective[];
    alignedObjectives: Objective[];
    linkedBigRocks: BigRock[];
    lastUpdated: Date | null;
  }>>;
  
  getCheckInsByEntityId(entityType: string, entityId: string): Promise<CheckIn[]>;
  getCheckInsByEntityIds(entityType: string, entityIds: string[]): Promise<Map<string, CheckIn[]>>;
  getCheckInsByTenantId(tenantId: string): Promise<CheckIn[]>;
  getCheckInById(id: string): Promise<CheckIn | undefined>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  updateCheckIn(id: string, data: Partial<CheckIn>): Promise<CheckIn>;
  deleteCheckIn(id: string): Promise<void>;
  getLatestCheckIn(entityType: string, entityId: string): Promise<CheckIn | undefined>;

  // Progress snapshot methods (daily history protected from check-in edits/deletions)
  upsertProgressSnapshot(snapshot: InsertProgressSnapshot): Promise<ProgressSnapshot>;
  getProgressSnapshotsByEntity(entityType: string, entityId: string, fromDate?: string): Promise<ProgressSnapshot[]>;
  getProgressSnapshotsByEntityIds(entityType: string, entityIds: string[], fromDate?: string): Promise<Map<string, ProgressSnapshot[]>>;
  countProgressSnapshotsForTenant(tenantId: string): Promise<number>;
  
  // Value tagging methods
  addValueToObjective(objectiveId: string, valueTitle: string, tenantId: string): Promise<void>;
  removeValueFromObjective(objectiveId: string, valueTitle: string, tenantId: string): Promise<void>;
  getValuesByObjectiveId(objectiveId: string, tenantId: string): Promise<string[]>;
  
  addValueToStrategy(strategyId: string, valueTitle: string, tenantId: string): Promise<void>;
  removeValueFromStrategy(strategyId: string, valueTitle: string, tenantId: string): Promise<void>;
  getValuesByStrategyId(strategyId: string, tenantId: string): Promise<string[]>;
  
  getItemsTaggedWithValue(tenantId: string, valueTitle: string): Promise<{
    objectives: Objective[];
    strategies: Strategy[];
  }>;
  
  // Import history methods
  createImportHistory(data: any): Promise<any>;
  getImportHistory(tenantId: string): Promise<any[]>;
  
  // Grounding documents methods (for AI context)
  getAllGroundingDocuments(): Promise<GroundingDocument[]>;
  getGlobalGroundingDocuments(): Promise<GroundingDocument[]>;
  getTenantGroundingDocuments(tenantId: string): Promise<GroundingDocument[]>;
  getActiveGroundingDocuments(): Promise<GroundingDocument[]>;
  getActiveGroundingDocumentsForTenant(tenantId: string): Promise<GroundingDocument[]>;
  getGroundingDocumentById(id: string): Promise<GroundingDocument | undefined>;
  createGroundingDocument(document: InsertGroundingDocument): Promise<GroundingDocument>;
  updateGroundingDocument(id: string, document: Partial<InsertGroundingDocument>): Promise<GroundingDocument>;
  deleteGroundingDocument(id: string): Promise<void>;
  
  // Microsoft Graph token methods (service-scoped: 'planner' | 'outlook')
  getGraphToken(userId: string, service?: string): Promise<GraphToken | undefined>;
  upsertGraphToken(token: InsertGraphToken): Promise<GraphToken>;
  deleteGraphToken(userId: string, service?: string): Promise<void>;
  
  // Microsoft Planner methods
  getPlannerPlansByTenantId(tenantId: string): Promise<PlannerPlan[]>;
  getPlannerPlanById(id: string): Promise<PlannerPlan | undefined>;
  getPlannerPlanByGraphId(tenantId: string, graphPlanId: string): Promise<PlannerPlan | undefined>;
  upsertPlannerPlan(plan: InsertPlannerPlan): Promise<PlannerPlan>;
  deletePlannerPlan(id: string): Promise<void>;
  
  getPlannerBucketsByPlanId(planId: string): Promise<PlannerBucket[]>;
  getPlannerBucketById(id: string): Promise<PlannerBucket | undefined>;
  upsertPlannerBucket(bucket: InsertPlannerBucket): Promise<PlannerBucket>;
  deletePlannerBucket(id: string): Promise<void>;
  
  getPlannerTasksByPlanId(planId: string): Promise<PlannerTask[]>;
  getPlannerTasksByBucketId(bucketId: string): Promise<PlannerTask[]>;
  getPlannerTaskById(id: string): Promise<PlannerTask | undefined>;
  upsertPlannerTask(task: InsertPlannerTask): Promise<PlannerTask>;
  deletePlannerTask(id: string): Promise<void>;
  
  // Planner task linking
  linkPlannerTaskToObjective(plannerTaskId: string, objectiveId: string, tenantId: string, userId?: string): Promise<void>;
  unlinkPlannerTaskFromObjective(plannerTaskId: string, objectiveId: string): Promise<void>;
  getPlannerTasksLinkedToObjective(objectiveId: string): Promise<PlannerTask[]>;
  
  linkPlannerTaskToBigRock(plannerTaskId: string, bigRockId: string, tenantId: string, userId?: string): Promise<void>;
  unlinkPlannerTaskFromBigRock(plannerTaskId: string, bigRockId: string): Promise<void>;
  getPlannerTasksLinkedToBigRock(bigRockId: string): Promise<PlannerTask[]>;
  
  // Consultant tenant access grants
  getConsultantTenantAccess(userId: string): Promise<ConsultantTenantAccess[]>;
  grantConsultantAccess(data: InsertConsultantTenantAccess): Promise<ConsultantTenantAccess>;
  revokeConsultantAccess(consultantUserId: string, tenantId: string): Promise<void>;
  hasConsultantAccess(consultantUserId: string, tenantId: string): Promise<boolean>;
  getConsultantsWithAccessToTenant(tenantId: string): Promise<ConsultantTenantAccess[]>;
  
  // Vocabulary methods
  getSystemVocabulary(): Promise<SystemVocabulary | undefined>;
  upsertSystemVocabulary(terms: VocabularyTerms, updatedBy: string): Promise<SystemVocabulary>;
  getEffectiveVocabulary(tenantId: string | null): Promise<VocabularyTerms>;
  
  // AI Usage tracking methods
  createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogs(tenantId: string, startDate?: Date, endDate?: Date, limit?: number): Promise<AiUsageLog[]>;
  getAiUsageSummary(tenantId: string, periodType: 'daily' | 'monthly', periodStart: Date): Promise<AiUsageSummary | undefined>;
  getAiUsageSummaries(tenantId: string, periodType: 'daily' | 'monthly', limit?: number): Promise<AiUsageSummary[]>;
  getPlatformAiUsageSummary(periodType: 'daily' | 'monthly', periodStart: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCostMicrodollars: number;
    byTenant: Array<{ tenantId: string; tenantName: string; requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  }>;
  
  // AI Configuration methods
  getAiConfiguration(): Promise<AiConfiguration | undefined>;
  updateAiConfiguration(config: Partial<InsertAiConfiguration>, updatedBy: string): Promise<AiConfiguration>;
  
  // Review Snapshots methods
  getReviewSnapshotsByTenantId(tenantId: string, year?: number, quarter?: number): Promise<ReviewSnapshot[]>;
  getReviewSnapshotById(id: string): Promise<ReviewSnapshot | undefined>;
  createReviewSnapshot(snapshot: InsertReviewSnapshot): Promise<ReviewSnapshot>;
  updateReviewSnapshot(id: string, snapshot: Partial<InsertReviewSnapshot>): Promise<ReviewSnapshot>;
  deleteReviewSnapshot(id: string): Promise<void>;
  
  // Report Templates methods
  getReportTemplates(tenantId?: string): Promise<ReportTemplate[]>;
  getReportTemplateById(id: string): Promise<ReportTemplate | undefined>;
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: string, template: Partial<InsertReportTemplate>): Promise<ReportTemplate>;
  deleteReportTemplate(id: string): Promise<void>;
  
  // Report Instances methods
  getReportInstances(tenantId: string, year?: number, reportType?: string): Promise<ReportInstance[]>;
  getReportInstanceById(id: string): Promise<ReportInstance | undefined>;
  createReportInstance(instance: InsertReportInstance): Promise<ReportInstance>;
  updateReportInstance(id: string, instance: Partial<ReportInstance>): Promise<ReportInstance>;
  deleteReportInstance(id: string): Promise<void>;
  
  // Service Plans methods
  getAllServicePlans(): Promise<ServicePlan[]>;
  getServicePlanById(id: string): Promise<ServicePlan | undefined>;
  getServicePlanByName(name: string): Promise<ServicePlan | undefined>;
  getDefaultServicePlan(): Promise<ServicePlan | undefined>;
  createServicePlan(plan: InsertServicePlan): Promise<ServicePlan>;
  updateServicePlan(id: string, plan: Partial<InsertServicePlan>): Promise<ServicePlan>;
  
  // Blocked Domains methods
  getAllBlockedDomains(): Promise<BlockedDomain[]>;
  getBlockedDomain(domain: string): Promise<BlockedDomain | undefined>;
  isDomainBlocked(domain: string): Promise<boolean>;
  blockDomain(data: InsertBlockedDomain): Promise<BlockedDomain>;
  unblockDomain(domain: string): Promise<void>;
  
  // Tenant Plan Management
  updateTenantPlan(tenantId: string, planId: string, expiresAt?: Date): Promise<Tenant>;
  cancelTenantPlan(tenantId: string, reason: string, cancelledBy: string): Promise<Tenant>;
  getTenantsWithExpiringPlans(daysUntilExpiry: number): Promise<Tenant[]>;
  
  // License Quota Management
  getTenantLicenseCounts(tenantId: string): Promise<{
    readWriteCount: number;
    readOnlyCount: number;
    adminCount: number;
    totalUsers: number;
  }>;
  getTenantLicenseQuota(tenantId: string): Promise<{
    maxReadWriteUsers: number | null;
    maxReadOnlyUsers: number | null;
    currentReadWrite: number;
    currentReadOnly: number;
    availableReadWrite: number | null;
    availableReadOnly: number | null;
  }>;
  canAssignReadWriteLicense(tenantId: string): Promise<boolean>;
  isUserReadOnly(userId: string): Promise<boolean>;
  
  // System Banners methods
  getActiveBanner(): Promise<SystemBanner | undefined>;
  getAllBanners(): Promise<SystemBanner[]>;
  getBannerById(id: string): Promise<SystemBanner | undefined>;
  createBanner(banner: InsertSystemBanner): Promise<SystemBanner>;
  updateBanner(id: string, banner: Partial<InsertSystemBanner>): Promise<SystemBanner>;
  deleteBanner(id: string): Promise<void>;
  
  // SEO Config
  getSeoConfig(): Promise<SeoConfig | undefined>;
  updateSeoConfig(config: Partial<InsertSeoConfig>, updatedBy?: string): Promise<SeoConfig>;

  // Landing Page Settings
  getLandingPageSettings(): Promise<LandingPageSettings | undefined>;
  updateLandingPageSettings(settings: Partial<InsertLandingPageSettings>): Promise<LandingPageSettings>;
  
  // Capability Section (Tabbed Navigation)
  getCapabilitySection(): Promise<CapabilitySection | undefined>;
  updateCapabilitySection(settings: Partial<InsertCapabilitySection>): Promise<CapabilitySection>;
  getCapabilityTabs(): Promise<CapabilityTab[]>;
  getCapabilityTabById(id: string): Promise<CapabilityTab | undefined>;
  createCapabilityTab(tab: InsertCapabilityTab): Promise<CapabilityTab>;
  updateCapabilityTab(id: string, tab: Partial<InsertCapabilityTab>): Promise<CapabilityTab>;
  deleteCapabilityTab(id: string): Promise<void>;
  reorderCapabilityTabs(tabOrders: { id: string; sortOrder: number }[]): Promise<void>;
  
  // Page Visit Analytics
  recordPageVisit(visit: InsertPageVisit): Promise<PageVisit>;
  getPageVisitStats(startDate?: Date, endDate?: Date): Promise<{
    totalVisits: number;
    totalSessions: number;
    visitsByPage: { page: string; count: number }[];
    visitsByDay: { date: string; count: number }[];
    visitsByCountry: { country: string; count: number }[];
    visitsByDevice: { device: string; count: number }[];
    visitsByBrowser: { browser: string; count: number }[];
    visitsByReferrer: { referrer: string; count: number }[];
  }>;
  
  // Tenant Activity Report for Platform Admins
  getTenantActivityReport(windowDays?: number): Promise<{
    tenants: {
      id: string;
      name: string;
      planName: string | null;
      planStatus: string | null;
      planExpiresAt: Date | null;
      selfServiceSignup: boolean | null;
      totalUsers: number;
      activeUsersLast30Days: number;
      elements: {
        hasMission: boolean;
        hasVision: boolean;
        valuesCount: number;
        goalsCount: number;
        strategiesCount: number;
        objectivesCount: number;
        keyResultsCount: number;
        meetingsCount: number;
      };
      lastActivityDate: string | null;
    }[];
    summary: {
      totalTenants: number;
      totalUsers: number;
      activeUsersLast30Days: number;
      inactiveTrialTenants: number;
    };
  }>;
  
  // MCP API Keys methods
  getMcpApiKeysByTenantId(tenantId: string): Promise<McpApiKey[]>;
  getMcpApiKeysByUserId(userId: string): Promise<McpApiKey[]>;
  getMcpApiKeyById(id: string): Promise<McpApiKey | undefined>;
  getMcpApiKeyByHash(keyHash: string): Promise<McpApiKey | undefined>;
  createMcpApiKey(key: InsertMcpApiKey): Promise<McpApiKey>;
  revokeMcpApiKey(id: string, revokedBy: string): Promise<void>;
  updateMcpApiKeyLastUsed(id: string): Promise<void>;
  updateMcpApiKey(id: string, updates: Partial<Pick<McpApiKey, 'allowedIps' | 'name' | 'scopes'>>): Promise<McpApiKey>;
  markKeyForRotation(keyId: string, gracePeriodEnds: Date): Promise<void>;
  
  // MCP Audit Logs methods
  createMcpAuditLog(log: InsertMcpAuditLog): Promise<McpAuditLog>;
  getMcpAuditLogs(tenantId: string, limit?: number): Promise<McpAuditLog[]>;

  // Galaxy Portal methods
  getTenantByGalaxyClientId(galaxyClientId: string): Promise<Tenant | undefined>;
  getUserByGalaxyUserId(galaxyUserId: string, tenantId?: string): Promise<User | undefined>;
  createPortalAuditLog(log: InsertPortalAuditLog): Promise<PortalAuditLog>;
  getPortalAuthCount(tenantId: string, sinceDate: Date): Promise<number>;
  getPortalAuditLogs(tenantId: string, filters?: { startDate?: Date; endDate?: Date; statusCode?: number; statusClass?: '2xx' | '3xx' | '4xx' | '5xx'; galaxyUserId?: string; userId?: string; limit?: number }): Promise<(PortalAuditLog & { userEmail?: string | null; userName?: string | null })[]>;
  
  // Support Tickets methods
  getSupportTicketsByTenantId(tenantId: string, status?: string): Promise<SupportTicket[]>;
  getSupportTicketsByUserId(userId: string): Promise<SupportTicket[]>;
  getAllSupportTickets(filters?: { status?: string; priority?: string; category?: string; tenantId?: string; assignedTo?: string }): Promise<SupportTicket[]>;
  getSupportTicketById(id: string): Promise<SupportTicket | undefined>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  getNextTicketNumber(): Promise<number>;
  
  // Support Ticket Replies methods
  getSupportTicketReplies(ticketId: string, includeInternal?: boolean): Promise<SupportTicketReply[]>;
  createSupportTicketReply(reply: InsertSupportTicketReply): Promise<SupportTicketReply>;
  
  // OAuth Client methods
  getOauthClientsByTenantId(tenantId: string): Promise<OauthClient[]>;
  getOauthClientByClientId(clientId: string): Promise<OauthClient | undefined>;
  getOauthClientById(id: string): Promise<OauthClient | undefined>;
  createOauthClient(client: InsertOauthClient): Promise<OauthClient>;
  updateOauthClient(id: string, updates: Partial<Pick<OauthClient, 'name' | 'redirectUris' | 'scopes' | 'status'>>): Promise<OauthClient>;
  deleteOauthClient(id: string): Promise<void>;
  
  // OAuth Authorization Code methods
  createOauthAuthorizationCode(code: Omit<OauthAuthorizationCode, 'id' | 'createdAt'>): Promise<OauthAuthorizationCode>;
  getOauthAuthorizationCode(code: string): Promise<OauthAuthorizationCode | undefined>;
  markOauthAuthorizationCodeUsed(id: string): Promise<void>;
  
  // OAuth Refresh Token methods
  createOauthRefreshToken(token: Omit<OauthRefreshToken, 'id' | 'createdAt'>): Promise<OauthRefreshToken>;
  getOauthRefreshToken(token: string): Promise<OauthRefreshToken | undefined>;
  revokeOauthRefreshToken(id: string): Promise<void>;
  revokeOauthRefreshTokensByClientAndUser(clientId: string, userId: string): Promise<void>;
  
  // Admin users methods
  getVegaAdminUsers(): Promise<User[]>;
  
  // Scheduled Jobs methods
  getScheduledJobs(tenantId?: string | null): Promise<ScheduledJob[]>;
  getScheduledJobById(id: string): Promise<ScheduledJob | undefined>;
  getScheduledJobByName(name: string): Promise<ScheduledJob | undefined>;
  createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob>;
  updateScheduledJob(id: string, updates: Partial<InsertScheduledJob>): Promise<ScheduledJob>;
  updateScheduledJobStatus(id: string, status: string): Promise<void>;
  updateScheduledJobLastRun(id: string, lastRunAt: Date, nextRunAt?: Date): Promise<void>;
  deleteScheduledJob(id: string): Promise<void>;
  
  // Notifications
  getNotificationsByUserId(userId: string, options?: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number }): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<number>;
  
  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreference[]>;
  upsertNotificationPreference(pref: InsertNotificationPreference): Promise<NotificationPreference>;
  getNotificationPreference(userId: string, eventType: string): Promise<NotificationPreference | undefined>;

  // Weekly digest send log (idempotency)
  getWeeklyDigestSend(userId: string, periodStart: string): Promise<WeeklyDigestSend | undefined>;
  recordWeeklyDigestSend(send: InsertWeeklyDigestSend): Promise<WeeklyDigestSend>;
  getWeeklyDigestSendsForPeriod(tenantId: string, periodStart: string): Promise<WeeklyDigestSend[]>;

  // Entity Comments
  getCommentsByEntity(tenantId: string, entityType: string, entityId: string): Promise<EntityComment[]>;
  getCommentById(id: string): Promise<EntityComment | undefined>;
  getCommentCountsByEntities(tenantId: string, entityType: string, entityIds: string[]): Promise<Map<string, number>>;
  createComment(comment: InsertEntityComment): Promise<EntityComment>;
  updateComment(id: string, body: string, mentionedUserIds: string[]): Promise<EntityComment | undefined>;
  softDeleteComment(id: string): Promise<EntityComment | undefined>;
  
  // Global cross-entity search
  searchAcrossEntities(
    tenantId: string,
    query: string,
    options?: { types?: string[]; limit?: number; userId?: string; isSupportAdmin?: boolean; canSeeGroundingDocs?: boolean }
  ): Promise<{
    type: 'objective' | 'key_result' | 'big_rock' | 'strategy' | 'ambition' | 'team' | 'meeting' | 'ticket' | 'document';
    id: string;
    title: string;
    snippet?: string;
    parentContext?: string;
    url: string;
    score: number;
  }[]>;

  // Job Runs methods
  getJobRuns(jobId?: string, limit?: number): Promise<JobRun[]>;
  getJobRunById(id: string): Promise<JobRun | undefined>;
  getRecentJobRuns(limit?: number): Promise<JobRun[]>;
  createJobRun(run: InsertJobRun): Promise<JobRun>;
  updateJobRun(id: string, updates: Partial<JobRun>): Promise<JobRun>;
  completeJobRun(id: string, status: string, summary?: string, details?: any, errorMessage?: string, errorStack?: string): Promise<JobRun>;

  // Trash / Soft-delete methods
  getTrashItemsByTenantId(tenantId: string): Promise<TrashListing>;
  restoreAmbition(tenantId: string, ambitionId: string): Promise<Ambition | undefined>;
  softDeleteAmbition(tenantId: string, ambitionId: string, userId?: string): Promise<void>;
  purgeOldDeletedItems(olderThanDays: number): Promise<{
    objectives: number;
    keyResults: number;
    bigRocks: number;
    bigRockTasks: number;
    strategies: number;
    ambitions: number;
  }>;

  // Reassignment methods
  getOwnedItemsByUser(tenantId: string, userId: string): Promise<{
    counts: ReassignmentCounts;
    items: {
      objectivesPrimary: Array<{ id: string; title: string }>;
      objectivesCoOwner: Array<{ id: string; title: string }>;
      objectivesCheckIn: Array<{ id: string; title: string }>;
      keyResults: Array<{ id: string; title: string }>;
      bigRocksOwner: Array<{ id: string; title: string }>;
      bigRocksAccountable: Array<{ id: string; title: string }>;
      ambitions: Array<{ id: string; title: string }>;
      strategies: Array<{ id: string; title: string }>;
      meetingsFacilitator: Array<{ id: string; title: string }>;
      meetingsAttendee: Array<{ id: string; title: string }>;
      supportTickets: Array<{ id: string; subject: string; ticketNumber: number }>;
    };
  }>;
  reassignOwnership(params: {
    tenantId: string;
    fromUserId: string;
    fromUserEmail: string;
    fromUserName: string | null;
    toUserId: string;
    toUserEmail: string;
    toUserName: string | null;
    performedById: string;
    performedByEmail: string;
    performedByName: string | null;
    notes?: string | null;
    keepOriginalAsCoOwner?: boolean;
    selection?: ReassignmentSelection;
  }): Promise<{ counts: ReassignmentCounts; auditLog: ReassignmentAuditLog }>;
  createReassignmentAuditLog(log: InsertReassignmentAuditLog): Promise<ReassignmentAuditLog>;
  getReassignmentAuditLogs(tenantId: string, limit?: number): Promise<ReassignmentAuditLog[]>;

  // Saved Views
  getSavedViews(tenantId: string, userId: string, page: SavedViewPage): Promise<SavedView[]>;
  getSavedViewById(id: string): Promise<SavedView | undefined>;
  createSavedView(view: InsertSavedView): Promise<SavedView>;
  updateSavedView(id: string, updates: Partial<InsertSavedView>): Promise<SavedView>;
  softDeleteSavedView(id: string): Promise<void>;

  // Admin Alerts methods
  recordAdminAlert(input: {
    tenantId: string;
    alertType: string;
    fingerprint: string;
    message: string;
    details?: any;
    severity?: string;
  }): Promise<AdminAlert>;
  getAdminAlertsByTenantId(tenantId: string, includeAcknowledged?: boolean): Promise<AdminAlert[]>;
  acknowledgeAdminAlert(id: string, tenantId: string, userId: string): Promise<AdminAlert | undefined>;

  // Custom Fields
  getCustomFieldDefs(tenantId: string, entityType?: CustomFieldEntityType, includeArchived?: boolean): Promise<CustomFieldDef[]>;
  getCustomFieldDefById(id: string): Promise<CustomFieldDef | undefined>;
  createCustomFieldDef(def: InsertCustomFieldDef): Promise<CustomFieldDef>;
  updateCustomFieldDef(id: string, updates: Partial<InsertCustomFieldDef>): Promise<CustomFieldDef>;
  archiveCustomFieldDef(id: string): Promise<CustomFieldDef>;
  restoreCustomFieldDef(id: string): Promise<CustomFieldDef>;
  reorderCustomFieldDefs(tenantId: string, entityType: CustomFieldEntityType, orderedIds: string[]): Promise<void>;
  getCustomFieldValuesByEntity(entityType: CustomFieldEntityType, entityId: string): Promise<CustomFieldValue[]>;
  getCustomFieldValuesByEntityIds(tenantId: string, entityType: CustomFieldEntityType, entityIds: string[]): Promise<Record<string, CustomFieldValue[]>>;
  setCustomFieldValues(
    tenantId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
    values: { fieldDefId: string; valueJson: any }[],
  ): Promise<void>;
}

export type ReassignmentSelection = Partial<{
  objectivesPrimary: string[];
  objectivesCoOwner: string[];
  objectivesCheckIn: string[];
  keyResults: string[];
  bigRocksOwner: string[];
  bigRocksAccountable: string[];
  ambitions: string[];
  strategies: string[];
  meetingsFacilitator: string[];
  meetingsAttendee: string[];
  supportTickets: string[];
}>;

/**
 * Hard cap on objective tree depth used by the recursive CTE in
 * getObjectiveHierarchy / getObjectiveSubtree. Protects against corrupted
 * parent_id chains and pathological alignment trees.
 */
const OBJECTIVE_HIERARCHY_DEPTH_CAP = 20;

// Enrichment shape for items shown in /trash UI
export type TrashEnrichment = {
  deletedByName: string | null;
  deletedByEmail: string | null;
  parentContext: { type: 'objective' | 'keyResult' | 'bigRock'; id: string; title: string } | null;
};
export type TrashListing = {
  objectives: (Objective & TrashEnrichment)[];
  keyResults: (KeyResult & TrashEnrichment)[];
  bigRocks: (BigRock & TrashEnrichment)[];
  strategies: (Strategy & TrashEnrichment)[];
  ambitions: (Ambition & { tenantId: string } & TrashEnrichment)[];
};

export class DatabaseStorage implements IStorage {
  // In-memory cache with TTL for frequently-accessed queries
  // Note: This is a simple in-memory cache suitable for single-instance deployments
  // For multi-instance deployments, consider using Redis or similar distributed cache
  private queryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = process.env.QUERY_CACHE_TTL 
    ? parseInt(process.env.QUERY_CACHE_TTL) 
    : 60 * 1000; // Default: 60 seconds

  /**
   * Get data from cache if available and not expired
   */
  private getCached<T>(cacheKey: string): T | null {
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * Store data in cache with current timestamp
   */
  private setCache(cacheKey: string, data: any): void {
    this.queryCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  /**
   * Invalidate cache entries by prefix
   */
  private invalidateCache(prefix: string): void {
    for (const key of Array.from(this.queryCache.keys())) {
      if (key.startsWith(prefix)) {
        this.queryCache.delete(key);
      }
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Case-insensitive email lookup to prevent duplicates with different casing
    const [user] = await db.select().from(users).where(
      sql`lower(${users.email}) = lower(${email})`
    );
    return user || undefined;
  }

  async getUserByAzureObjectId(azureObjectId: string, tenantId?: string): Promise<User | undefined> {
    if (tenantId) {
      const [user] = await db.select().from(users).where(
        and(eq(users.azureObjectId, azureObjectId), eq(users.tenantId, tenantId))
      );
      return user || undefined;
    }
    const [user] = await db.select().from(users).where(eq(users.azureObjectId, azureObjectId));
    return user || undefined;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user || undefined;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    // PERFORMANCE: Use JSONB containment operator with GIN index instead of
    // fetching all tenants and filtering in memory
    // The @> operator checks if allowed_domains JSONB array contains the domain
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(sql`${tenants.allowedDomains} @> ${JSON.stringify([domain])}::jsonb`);
    return tenant || undefined;
  }

  async getAllUsers(tenantId?: string): Promise<User[]> {
    if (tenantId) {
      return await db.select().from(users).where(eq(users.tenantId, tenantId));
    }
    return await db.select().from(users);
  }

  async searchUsers(tenantId: string, query: string, limit: number): Promise<Pick<User, "id" | "email" | "name" | "role">[]> {
    const columns = {
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    };
    const tenantFilter = eq(users.tenantId, tenantId);
    const baseQuery = db.select(columns).from(users);

    if (query) {
      const pattern = `%${query}%`;
      return await baseQuery
        .where(and(tenantFilter, or(ilike(users.name, pattern), ilike(users.email, pattern))))
        .orderBy(asc(users.name))
        .limit(limit);
    }

    return await baseQuery
      .where(tenantFilter)
      .orderBy(asc(users.name))
      .limit(limit);
  }

  async getUsersByEmails(tenantId: string, emails: string[]): Promise<Pick<User, "id" | "email" | "name" | "role">[]> {
    if (emails.length === 0) return [];
    const normalised = emails.map(e => e.toLowerCase());
    return await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), inArray(sql`lower(${users.email})`, normalised)))
      .orderBy(asc(users.name));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User> {
    const dataToUpdate: any = { ...updateData };
    
    // Hash password if it's being updated
    if (updateData.password) {
      dataToUpdate.password = await hashPassword(updateData.password);
    }
    
    const [user] = await db
      .update(users)
      .set(dataToUpdate)
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    
    return user;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(insertTenant as any).returning();
    return tenant;
  }

  async updateTenant(id: string, updateData: Partial<InsertTenant>): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set(updateData as any)
      .where(eq(tenants.id, id))
      .returning();
    
    if (!tenant) {
      throw new Error(`Tenant with id ${id} not found`);
    }
    
    return tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    // Delete grounding documents first (manual cascade for existing data without cascade)
    await db.delete(groundingDocuments).where(eq(groundingDocuments.tenantId, id));
    // Now delete the tenant
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getFoundationByTenantId(tenantId: string): Promise<Foundation | undefined> {
    const [foundation] = await db
      .select()
      .from(foundations)
      .where(eq(foundations.tenantId, tenantId));
    if (!foundation) return undefined;

    // Hide soft-deleted ambitions from default reads
    if (Array.isArray(foundation.ambitions)) {
      const visible = (foundation.ambitions as Ambition[]).filter(a => !a.deletedAt);
      return { ...foundation, ambitions: visible } as Foundation;
    }
    return foundation;
  }

  async upsertFoundation(insertFoundation: InsertFoundation): Promise<Foundation> {
    const existing = await this.getFoundationByTenantId(insertFoundation.tenantId);
    
    if (existing) {
      const [updated] = await db
        .update(foundations)
        .set({
          mission: insertFoundation.mission,
          vision: insertFoundation.vision,
          values: insertFoundation.values ? [...insertFoundation.values] : null,
          ambitions: insertFoundation.ambitions ? [...insertFoundation.ambitions] : null,
          annualGoals: insertFoundation.annualGoals ? [...insertFoundation.annualGoals] : null,
          fiscalYearStartMonth: insertFoundation.fiscalYearStartMonth,
          tagline: insertFoundation.tagline,
          companySummary: insertFoundation.companySummary,
          messagingStatement: insertFoundation.messagingStatement,
          cultureStatement: insertFoundation.cultureStatement,
          brandVoice: insertFoundation.brandVoice,
          updatedBy: insertFoundation.updatedBy,
        })
        .where(eq(foundations.tenantId, insertFoundation.tenantId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(foundations)
        .values({
          ...insertFoundation,
          values: insertFoundation.values ? [...insertFoundation.values] : null,
          ambitions: insertFoundation.ambitions ? [...insertFoundation.ambitions] : null,
          annualGoals: insertFoundation.annualGoals ? [...insertFoundation.annualGoals] : null,
        })
        .returning();
      return created;
    }
  }

  async getStrategiesByTenantId(tenantId: string): Promise<Strategy[]> {
    return await db.select().from(strategies).where(
      and(eq(strategies.tenantId, tenantId), isNull(strategies.deletedAt))
    );
  }

  async getStrategyById(id: string): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies).where(
      and(eq(strategies.id, id), isNull(strategies.deletedAt))
    );
    return strategy || undefined;
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    const [strategy] = await db
      .insert(strategies)
      .values({
        ...insertStrategy,
        linkedGoals: insertStrategy.linkedGoals ? [...insertStrategy.linkedGoals] : null,
      })
      .returning();
    return strategy;
  }

  async updateStrategy(id: string, updateData: Partial<InsertStrategy>): Promise<Strategy> {
    const [strategy] = await db
      .update(strategies)
      .set({
        ...updateData,
        linkedGoals: updateData.linkedGoals ? [...updateData.linkedGoals] : undefined,
      })
      .where(eq(strategies.id, id))
      .returning();
    return strategy;
  }

  async deleteStrategy(id: string, userId?: string): Promise<void> {
    await db.update(strategies)
      .set({ deletedAt: new Date(), deletedBy: userId ?? null })
      .where(and(eq(strategies.id, id), isNull(strategies.deletedAt)));
  }

  async restoreStrategy(id: string, tenantId: string): Promise<Strategy | undefined> {
    // Tenant-scoped restore: only updates the row if it belongs to the tenant.
    // The WHERE clause both authorizes and filters atomically — no mutation
    // happens against rows the caller doesn't own.
    const [restored] = await db.update(strategies)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(eq(strategies.id, id), eq(strategies.tenantId, tenantId)))
      .returning();
    return restored || undefined;
  }

  async getOkrsByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Okr[]> {
    const conditions = [eq(okrs.tenantId, tenantId)];
    if (quarter !== undefined) conditions.push(eq(okrs.quarter, quarter));
    if (year !== undefined) conditions.push(eq(okrs.year, year));
    return await db.select().from(okrs).where(and(...conditions));
  }

  async getOkrById(id: string): Promise<Okr | undefined> {
    const [okr] = await db.select().from(okrs).where(eq(okrs.id, id));
    return okr || undefined;
  }

  async createOkr(insertOkr: InsertOkr): Promise<Okr> {
    const [okr] = await db
      .insert(okrs)
      .values({
        ...insertOkr,
        linkedGoals: insertOkr.linkedGoals ? [...insertOkr.linkedGoals] : null,
        linkedStrategies: insertOkr.linkedStrategies ? [...insertOkr.linkedStrategies] : null,
        keyResults: insertOkr.keyResults ? [...insertOkr.keyResults] : null,
      })
      .returning();
    return okr;
  }

  async updateOkr(id: string, updateData: Partial<InsertOkr>): Promise<Okr> {
    const [okr] = await db
      .update(okrs)
      .set({
        ...updateData,
        linkedGoals: updateData.linkedGoals ? [...updateData.linkedGoals] : undefined,
        linkedStrategies: updateData.linkedStrategies ? [...updateData.linkedStrategies] : undefined,
        keyResults: updateData.keyResults ? [...updateData.keyResults] : undefined,
      })
      .where(eq(okrs.id, id))
      .returning();
    return okr;
  }

  async deleteOkr(id: string): Promise<void> {
    await db.delete(okrs).where(eq(okrs.id, id));
  }

  async getKpisByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Kpi[]> {
    const conditions = [eq(kpis.tenantId, tenantId)];
    if (quarter !== undefined) conditions.push(eq(kpis.quarter, quarter));
    if (year !== undefined) conditions.push(eq(kpis.year, year));
    return await db.select().from(kpis).where(and(...conditions));
  }

  async getKpiById(id: string): Promise<Kpi | undefined> {
    const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
    return kpi || undefined;
  }

  async createKpi(insertKpi: InsertKpi): Promise<Kpi> {
    const [kpi] = await db
      .insert(kpis)
      .values({
        ...insertKpi,
        linkedGoals: insertKpi.linkedGoals ? [...insertKpi.linkedGoals] : null,
      })
      .returning();
    return kpi;
  }

  async updateKpi(id: string, updateData: Partial<InsertKpi>): Promise<Kpi> {
    const [kpi] = await db
      .update(kpis)
      .set({
        ...updateData,
        linkedGoals: updateData.linkedGoals ? [...updateData.linkedGoals] : undefined,
      })
      .where(eq(kpis.id, id))
      .returning();
    return kpi;
  }

  async deleteKpi(id: string): Promise<void> {
    await db.delete(kpis).where(eq(kpis.id, id));
  }

  async getMeetingsByTenantId(tenantId: string): Promise<Meeting[]> {
    return await db.select().from(meetings).where(eq(meetings.tenantId, tenantId));
  }

  async getMeetingById(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting || undefined;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db
      .insert(meetings)
      .values({
        ...insertMeeting,
        attendees: insertMeeting.attendees ? [...insertMeeting.attendees] : null,
        decisions: insertMeeting.decisions ? [...insertMeeting.decisions] : null,
        actionItems: insertMeeting.actionItems ? [...insertMeeting.actionItems] : null,
        agenda: insertMeeting.agenda ? [...insertMeeting.agenda] : null,
        risks: insertMeeting.risks ? [...insertMeeting.risks] : null,
        linkedObjectiveIds: insertMeeting.linkedObjectiveIds ? [...insertMeeting.linkedObjectiveIds] : null,
        linkedKeyResultIds: insertMeeting.linkedKeyResultIds ? [...insertMeeting.linkedKeyResultIds] : null,
        linkedBigRockIds: insertMeeting.linkedBigRockIds ? [...insertMeeting.linkedBigRockIds] : null,
        meetingTime: insertMeeting.meetingTime ?? null,
        duration: insertMeeting.duration ?? null,
      } as any)
      .returning();
    return meeting;
  }

  async updateMeeting(id: string, updateData: Partial<InsertMeeting>): Promise<Meeting> {
    const setData: any = { ...updateData };
    if (updateData.attendees !== undefined) setData.attendees = updateData.attendees ? [...updateData.attendees] : null;
    if (updateData.decisions !== undefined) setData.decisions = updateData.decisions ? [...updateData.decisions] : null;
    if (updateData.actionItems !== undefined) setData.actionItems = updateData.actionItems ? [...updateData.actionItems] : null;
    if (updateData.agenda !== undefined) setData.agenda = updateData.agenda ? [...updateData.agenda] : null;
    if (updateData.risks !== undefined) setData.risks = updateData.risks ? [...updateData.risks] : null;
    if (updateData.linkedObjectiveIds !== undefined) setData.linkedObjectiveIds = updateData.linkedObjectiveIds ? [...updateData.linkedObjectiveIds] : null;
    if (updateData.linkedKeyResultIds !== undefined) setData.linkedKeyResultIds = updateData.linkedKeyResultIds ? [...updateData.linkedKeyResultIds] : null;
    if (updateData.linkedBigRockIds !== undefined) setData.linkedBigRockIds = updateData.linkedBigRockIds ? [...updateData.linkedBigRockIds] : null;
    
    const [meeting] = await db
      .update(meetings)
      .set(setData)
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Enhanced OKR Method Implementations
  async getObjectivesByTenantId(
    tenantId: string,
    quarter?: number,
    year?: number,
    level?: string,
    teamId?: string,
    options?: { viewerUserId?: string | null; viewerEmail?: string | null; includeAllStates?: boolean },
  ): Promise<Objective[]> {
    // Check cache first — viewer-scoped variants get their own cache key.
    const viewerKey = options?.includeAllStates
      ? 'all'
      : `${options?.viewerUserId || ''}:${options?.viewerEmail || ''}`;
    const cacheKey = `objectives:${tenantId}:${quarter}:${year}:${level}:${teamId}:${viewerKey}`;
    const cached = this.getCached<Objective[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build base conditions
    const conditions: any[] = [eq(objectives.tenantId, tenantId), isNull(objectives.deletedAt)];
    
    // Add year filter if provided
    if (year !== undefined) {
      conditions.push(eq(objectives.year, year));
    }
    
    // Add quarter filter
    if (quarter === 0 && year !== undefined) {
      // Annual only (quarter IS NULL or 0)
      conditions.push(or(
        isNull(objectives.quarter),
        eq(objectives.quarter, 0)
      ));
    } else if (quarter !== undefined && quarter > 0 && year !== undefined) {
      // Show exact quarter AND objectives with no quarter set (annual/unquartered objectives
      // are always visible regardless of which quarter filter is active)
      conditions.push(or(
        eq(objectives.quarter, quarter),
        isNull(objectives.quarter)
      ));
    }
    
    // Add level filter if provided (organization, team, individual)
    if (level && level !== 'all') {
      conditions.push(eq(objectives.level, level));
    }
    
    // Add team filter if provided
    if (teamId && teamId !== 'all') {
      conditions.push(eq(objectives.teamId, teamId));
    }
    
    const data = await db.select().from(objectives).where(and(...conditions));

    // Task #59: Hide draft / pending_approval objectives from broad views.
    // Approvers (includeAllStates) see everything. Authors / owners can still
    // see their own drafts and pending submissions.
    const viewerEmail = options?.viewerEmail?.toLowerCase() || null;
    const viewerUserId = options?.viewerUserId || null;
    const includeAll = !!options?.includeAllStates;
    const filtered = data.filter((obj: any) => {
      const state = obj.state || 'active';
      if (state === 'active' || state === 'closed' || state === 'archived') return true;
      if (includeAll) return true;
      // draft / pending_approval — only owner / submitter / creator can see.
      if (viewerUserId && (obj.ownerId === viewerUserId || obj.createdBy === viewerUserId || obj.submittedForApprovalBy === viewerUserId)) return true;
      if (viewerEmail && obj.ownerEmail && String(obj.ownerEmail).toLowerCase() === viewerEmail) return true;
      return false;
    });

    // Normalize: completed objectives always report 100% progress
    const normalized = filtered.map(obj =>
      obj.status === 'completed' && (obj.progress ?? 0) < 100
        ? { ...obj, progress: 100 }
        : obj
    );
    this.setCache(cacheKey, normalized);
    return normalized;
  }

  async getTeamsByTenantId(tenantId: string): Promise<Team[]> {
    const cacheKey = `teams:${tenantId}`;
    const cached = this.getCached<Team[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await db.select().from(teams).where(eq(teams.tenantId, tenantId));
    this.setCache(cacheKey, data);
    return data;
  }

  async getTeamByName(tenantId: string, name: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(and(eq(teams.tenantId, tenantId), eq(teams.name, name)));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team as any).returning();
    // Invalidate teams cache for this tenant
    this.invalidateCache(`teams:${team.tenantId}`);
    return created;
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async updateTeam(id: string, updateData: Partial<InsertTeam>): Promise<Team> {
    const [team] = await db
      .update(teams)
      .set({
        ...updateData,
        memberIds: updateData.memberIds ? [...updateData.memberIds] : undefined,
        updatedAt: new Date(),
      } as any)
      .where(eq(teams.id, id))
      .returning();
    // Invalidate teams cache for this tenant
    if (team) {
      this.invalidateCache(`teams:${team.tenantId}`);
    }
    return team;
  }

  async deleteTeam(id: string): Promise<void> {
    // Use RETURNING clause to get tenantId for cache invalidation without extra query
    const [deletedTeam] = await db.delete(teams).where(eq(teams.id, id)).returning({ tenantId: teams.tenantId });
    if (deletedTeam) {
      this.invalidateCache(`teams:${deletedTeam.tenantId}`);
    }
  }

  async getObjectiveById(id: string): Promise<Objective | undefined> {
    const [objective] = await db.select().from(objectives).where(
      and(eq(objectives.id, id), isNull(objectives.deletedAt))
    );
    if (!objective) return undefined;
    // Normalize: completed objectives always report 100% progress
    if (objective.status === 'completed' && (objective.progress ?? 0) < 100) {
      return { ...objective, progress: 100 };
    }
    return objective;
  }

  async getChildObjectives(parentId: string): Promise<Objective[]> {
    const data = await db.select().from(objectives).where(
      and(eq(objectives.parentId, parentId), isNull(objectives.deletedAt))
    );
    return data.map(obj =>
      obj.status === 'completed' && (obj.progress ?? 0) < 100
        ? { ...obj, progress: 100 }
        : obj
    );
  }

  async createObjective(insertObjective: InsertObjective): Promise<Objective> {
    const [objective] = await db
      .insert(objectives)
      .values({
        ...insertObjective,
        coOwnerIds: insertObjective.coOwnerIds ? [...insertObjective.coOwnerIds] : null,
        linkedStrategies: insertObjective.linkedStrategies ? [...insertObjective.linkedStrategies] : null,
        linkedGoals: insertObjective.linkedGoals ? [...insertObjective.linkedGoals] : null,
      } as any)
      .returning();
    // Invalidate objectives cache for this tenant
    this.invalidateCache(`objectives:${objective.tenantId}`);
    return objective;
  }

  async updateObjective(id: string, updateData: Partial<InsertObjective>): Promise<Objective> {
    const [objective] = await db
      .update(objectives)
      .set({
        ...updateData,
        coOwnerIds: updateData.coOwnerIds ? [...updateData.coOwnerIds] : undefined,
        linkedStrategies: updateData.linkedStrategies ? [...updateData.linkedStrategies] : undefined,
        linkedGoals: updateData.linkedGoals ? [...updateData.linkedGoals] : undefined,
        alignedToObjectiveIds: updateData.alignedToObjectiveIds ? [...updateData.alignedToObjectiveIds] : undefined,
      } as any)
      .where(eq(objectives.id, id))
      .returning();
    // Invalidate objectives cache for this tenant
    if (objective) {
      this.invalidateCache(`objectives:${objective.tenantId}`);
    }
    return objective;
  }

  async deleteObjective(id: string, userId?: string): Promise<void> {
    const now = new Date();
    const deletedBy = userId ?? null;

    // Find big rocks that will be cascaded so we can also cascade their tasks
    const cascadedBigRocks = await db
      .select({ id: bigRocks.id })
      .from(bigRocks)
      .where(and(eq(bigRocks.objectiveId, id), isNull(bigRocks.deletedAt)));
    const cascadedBigRockIds = cascadedBigRocks.map(b => b.id);

    // Cascade soft-delete to children: key results, big rocks, big rock tasks
    await db.update(keyResults)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(keyResults.objectiveId, id), isNull(keyResults.deletedAt)));
    await db.update(bigRocks)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(bigRocks.objectiveId, id), isNull(bigRocks.deletedAt)));
    if (cascadedBigRockIds.length > 0) {
      await db.update(bigRockTasks)
        .set({ deletedAt: now, deletedBy })
        .where(and(
          inArray(bigRockTasks.bigRockId, cascadedBigRockIds),
          isNull(bigRockTasks.deletedAt)
        ));
    }

    // Soft-delete the objective itself
    const [deletedObjective] = await db.update(objectives)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(objectives.id, id), isNull(objectives.deletedAt)))
      .returning({ tenantId: objectives.tenantId });

    // Invalidate objectives cache for this tenant
    if (deletedObjective) {
      this.invalidateCache(`objectives:${deletedObjective.tenantId}`);
    }
  }

  // ============================================
  // OKR Approval Workflow (Task #59)
  // ============================================
  private async _recordApprovalHistory(
    tx: any,
    entry: { tenantId: string; objectiveId: string; fromState: string | null; toState: string; actorUserId: string | null; note: string | null }
  ): Promise<void> {
    await tx.insert(okrApprovalHistory).values({
      tenantId: entry.tenantId,
      objectiveId: entry.objectiveId,
      fromState: entry.fromState,
      toState: entry.toState,
      actorUserId: entry.actorUserId,
      note: entry.note,
    });
  }

  async submitObjectiveForApproval(id: string, actorUserId: string | null): Promise<Objective> {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(objectives).where(eq(objectives.id, id));
      if (!existing) throw new Error("Objective not found");
      const fromState = (existing as any).state || 'active';
      const [updated] = fromState === 'pending_approval'
        ? [existing]
        : await tx
            .update(objectives)
            .set({
              state: 'pending_approval',
              submittedForApprovalAt: new Date(),
              submittedForApprovalBy: actorUserId,
            } as any)
            .where(eq(objectives.id, id))
            .returning();
      // Always record an audit row for the submission (initial create or
      // post-edit requeue), even if the row was already in pending_approval.
      await this._recordApprovalHistory(tx, {
        tenantId: existing.tenantId,
        objectiveId: id,
        fromState,
        toState: 'pending_approval',
        actorUserId,
        note: null,
      });
      return updated;
    });
    this.invalidateCache(`objectives:${result.tenantId}`);
    return result;
  }

  async approveObjective(id: string, actorUserId: string | null, note?: string | null): Promise<Objective> {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(objectives).where(eq(objectives.id, id));
      if (!existing) throw new Error("Objective not found");
      const fromState = (existing as any).state || 'active';
      const [updated] = await tx
        .update(objectives)
        .set({
          state: 'active',
          approvedAt: new Date(),
          approvedBy: actorUserId,
        } as any)
        .where(eq(objectives.id, id))
        .returning();
      await this._recordApprovalHistory(tx, {
        tenantId: existing.tenantId,
        objectiveId: id,
        fromState,
        toState: 'active',
        actorUserId,
        note: note ?? null,
      });
      return updated;
    });
    this.invalidateCache(`objectives:${result.tenantId}`);
    return result;
  }

  async rejectObjective(id: string, actorUserId: string | null, note: string): Promise<Objective> {
    if (!note || !note.trim()) {
      throw new Error("Rejection note is required");
    }
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(objectives).where(eq(objectives.id, id));
      if (!existing) throw new Error("Objective not found");
      const fromState = (existing as any).state || 'active';
      const [updated] = await tx
        .update(objectives)
        .set({
          state: 'draft',
          rejectedAt: new Date(),
          rejectedBy: actorUserId,
          lastRejectionNote: note,
        } as any)
        .where(eq(objectives.id, id))
        .returning();
      await this._recordApprovalHistory(tx, {
        tenantId: existing.tenantId,
        objectiveId: id,
        fromState,
        toState: 'draft',
        actorUserId,
        note,
      });
      return updated;
    });
    this.invalidateCache(`objectives:${result.tenantId}`);
    return result;
  }

  async getObjectiveApprovalHistory(objectiveId: string): Promise<OkrApprovalHistory[]> {
    return await db
      .select()
      .from(okrApprovalHistory)
      .where(eq(okrApprovalHistory.objectiveId, objectiveId))
      .orderBy(desc(okrApprovalHistory.createdAt));
  }

  async getApprovalQueueByTenantId(tenantId: string): Promise<Objective[]> {
    return await db
      .select()
      .from(objectives)
      .where(and(
        eq(objectives.tenantId, tenantId),
        eq(objectives.state, 'pending_approval'),
        isNull(objectives.deletedAt)
      ))
      .orderBy(desc(objectives.submittedForApprovalAt));
  }

  async getApproverUserIds(tenantId: string): Promise<string[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        or(
          eq(users.role, 'tenant_admin'),
          eq(users.role, 'admin'),
          eq(users.role, 'okr_approver'),
        )
      ));
    return rows.map(r => r.id);
  }

  async restoreObjective(id: string, tenantId: string): Promise<Objective | undefined> {
    // Fetch the row first (regardless of deleted state) and authorize by tenant.
    // No mutation happens until tenant ownership is confirmed.
    const [original] = await db.select().from(objectives).where(eq(objectives.id, id));
    if (!original || original.tenantId !== tenantId) return undefined;
    if (!original.deletedAt) return original;

    const cascadeTimestamp = original.deletedAt;

    // Restore the objective (tenant-scoped clause as defense in depth)
    const [restored] = await db.update(objectives)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(eq(objectives.id, id), eq(objectives.tenantId, tenantId)))
      .returning();
    if (!restored) return undefined;

    // Cascade-restore children that were deleted as part of the same operation
    // (i.e., share the exact deletedAt timestamp captured during the cascade delete).
    await db.update(keyResults)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(
        eq(keyResults.objectiveId, id),
        eq(keyResults.deletedAt, cascadeTimestamp)
      ));

    const restoredBigRocks = await db.update(bigRocks)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(
        eq(bigRocks.objectiveId, id),
        eq(bigRocks.deletedAt, cascadeTimestamp)
      ))
      .returning({ id: bigRocks.id });

    if (restoredBigRocks.length > 0) {
      await db.update(bigRockTasks)
        .set({ deletedAt: null, deletedBy: null })
        .where(and(
          inArray(bigRockTasks.bigRockId, restoredBigRocks.map(b => b.id)),
          eq(bigRockTasks.deletedAt, cascadeTimestamp)
        ));
    }

    this.invalidateCache(`objectives:${restored.tenantId}`);
    return restored;
  }

  async cloneObjective(objectiveId: string, options: {
    targetQuarter: number | null;
    targetYear: number;
    keepOriginalOwner: boolean;
    newOwnerId?: string;
    cloneScope: 'objective_only' | 'immediate_children' | 'all_children';
  }): Promise<Objective> {
    const sourceObjective = await this.getObjectiveById(objectiveId);
    if (!sourceObjective) {
      throw new Error('Source objective not found');
    }

    // Build dates for the target period (annual or quarterly)
    let startDate: Date;
    let endDate: Date;
    if (options.targetQuarter === null) {
      // Annual objective: full year
      startDate = new Date(options.targetYear, 0, 1);
      endDate = new Date(options.targetYear, 11, 31);
    } else {
      // Quarterly objective
      startDate = new Date(options.targetYear, (options.targetQuarter - 1) * 3, 1);
      endDate = new Date(options.targetYear, options.targetQuarter * 3, 0);
    }

    // Clone the main objective with reset progress
    const clonedObjectiveData: InsertObjective = {
      tenantId: sourceObjective.tenantId,
      title: sourceObjective.title,
      description: sourceObjective.description,
      parentId: null, // Top-level clone (not a child)
      level: sourceObjective.level,
      ownerId: options.keepOriginalOwner ? sourceObjective.ownerId : (options.newOwnerId || null),
      ownerEmail: options.keepOriginalOwner ? sourceObjective.ownerEmail : null,
      teamId: sourceObjective.teamId,
      coOwnerIds: sourceObjective.coOwnerIds,
      checkInOwnerId: options.keepOriginalOwner ? sourceObjective.checkInOwnerId : (options.newOwnerId || null),
      progress: 0,
      progressMode: sourceObjective.progressMode,
      status: 'not_started',
      statusOverride: 'false',
      quarter: options.targetQuarter,
      year: options.targetYear,
      startDate: startDate,
      endDate: endDate,
      linkedStrategies: sourceObjective.linkedStrategies,
      linkedGoals: sourceObjective.linkedGoals,
      linkedValues: sourceObjective.linkedValues,
      alignedToObjectiveIds: null, // Don't clone alignments
    };

    const clonedObjective = await this.createObjective(clonedObjectiveData);

    // Clone key results if scope includes immediate_children or all_children
    if (options.cloneScope === 'immediate_children' || options.cloneScope === 'all_children') {
      const sourceKeyResults = await this.getKeyResultsByObjectiveId(objectiveId);
      for (const kr of sourceKeyResults) {
        const clonedKRData: InsertKeyResult = {
          objectiveId: clonedObjective.id,
          tenantId: kr.tenantId,
          title: kr.title,
          description: kr.description,
          metricType: kr.metricType,
          currentValue: kr.initialValue || 0,
          targetValue: kr.targetValue,
          initialValue: kr.initialValue || 0,
          unit: kr.unit,
          progress: 0,
          weight: kr.weight,
          isWeightLocked: kr.isWeightLocked,
          status: 'not_started',
          ownerId: options.keepOriginalOwner ? kr.ownerId : (options.newOwnerId || null),
        };
        await this.createKeyResult(clonedKRData);
      }
    }

    // Clone child objectives if scope is all_children
    if (options.cloneScope === 'all_children') {
      await this.cloneChildObjectivesRecursively(objectiveId, clonedObjective.id, options);
    }

    return clonedObjective;
  }

  private async cloneChildObjectivesRecursively(
    sourceParentId: string, 
    targetParentId: string, 
    options: {
      targetQuarter: number | null;
      targetYear: number;
      keepOriginalOwner: boolean;
      newOwnerId?: string;
    }
  ): Promise<void> {
    const childObjectives = await this.getChildObjectives(sourceParentId);
    
    for (const child of childObjectives) {
      let startDate: Date;
      let endDate: Date;
      if (options.targetQuarter === null) {
        startDate = new Date(options.targetYear, 0, 1);
        endDate = new Date(options.targetYear, 11, 31);
      } else {
        startDate = new Date(options.targetYear, (options.targetQuarter - 1) * 3, 1);
        endDate = new Date(options.targetYear, options.targetQuarter * 3, 0);
      }

      const clonedChildData: InsertObjective = {
        tenantId: child.tenantId,
        title: child.title,
        description: child.description,
        parentId: targetParentId,
        level: child.level,
        ownerId: options.keepOriginalOwner ? child.ownerId : (options.newOwnerId || null),
        ownerEmail: options.keepOriginalOwner ? child.ownerEmail : null,
        teamId: child.teamId,
        coOwnerIds: child.coOwnerIds,
        checkInOwnerId: options.keepOriginalOwner ? child.checkInOwnerId : (options.newOwnerId || null),
        progress: 0,
        progressMode: child.progressMode,
        status: 'not_started',
        statusOverride: 'false',
        quarter: options.targetQuarter,
        year: options.targetYear,
        startDate: startDate,
        endDate: endDate,
        linkedStrategies: child.linkedStrategies,
        linkedGoals: child.linkedGoals,
        linkedValues: child.linkedValues,
        alignedToObjectiveIds: null,
      };

      const clonedChild = await this.createObjective(clonedChildData);

      // Clone key results for this child
      const childKeyResults = await this.getKeyResultsByObjectiveId(child.id);
      for (const kr of childKeyResults) {
        const clonedKRData: InsertKeyResult = {
          objectiveId: clonedChild.id,
          tenantId: kr.tenantId,
          title: kr.title,
          description: kr.description,
          metricType: kr.metricType,
          currentValue: kr.initialValue || 0,
          targetValue: kr.targetValue,
          initialValue: kr.initialValue || 0,
          unit: kr.unit,
          progress: 0,
          weight: kr.weight,
          isWeightLocked: kr.isWeightLocked,
          status: 'not_started',
          ownerId: options.keepOriginalOwner ? kr.ownerId : (options.newOwnerId || null),
        };
        await this.createKeyResult(clonedKRData);
      }

      // Recursively clone grandchildren
      await this.cloneChildObjectivesRecursively(child.id, clonedChild.id, options);
    }
  }

  async getKeyResultsByObjectiveId(objectiveId: string): Promise<KeyResult[]> {
    return await db.select().from(keyResults).where(
      and(eq(keyResults.objectiveId, objectiveId), isNull(keyResults.deletedAt))
    );
  }

  async getKeyResultsByTenantId(tenantId: string, quarter?: number, year?: number, teamId?: string): Promise<KeyResult[]> {
    // Key results don't have tenant/quarter/year directly - get them through their parent objectives
    const matchingObjectives = await this.getObjectivesByTenantId(tenantId, quarter, year, undefined, teamId);
    const objectiveIds = matchingObjectives.map(o => o.id);
    
    if (objectiveIds.length === 0) {
      return [];
    }
    
    // Fetch all key results for these objectives
    return await db.select().from(keyResults).where(
      and(inArray(keyResults.objectiveId, objectiveIds), isNull(keyResults.deletedAt))
    );
  }

  async getKeyResultById(id: string): Promise<KeyResult | undefined> {
    const [keyResult] = await db.select().from(keyResults).where(
      and(eq(keyResults.id, id), isNull(keyResults.deletedAt))
    );
    return keyResult || undefined;
  }

  async getAllKeyResults(): Promise<KeyResult[]> {
    return await db.select().from(keyResults).where(isNull(keyResults.deletedAt));
  }

  async getAllObjectives(): Promise<Objective[]> {
    return await db.select().from(objectives).where(isNull(objectives.deletedAt));
  }

  async createKeyResult(insertKeyResult: InsertKeyResult): Promise<KeyResult> {
    const [keyResult] = await db
      .insert(keyResults)
      .values(insertKeyResult as any)
      .returning();
    // Invalidate objectives cache since KR progress affects objective progress
    // Use lightweight query to get just tenantId instead of full objective
    if (keyResult.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, keyResult.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return keyResult;
  }

  async updateKeyResult(id: string, updateData: Partial<InsertKeyResult>): Promise<KeyResult> {
    const [keyResult] = await db
      .update(keyResults)
      .set(updateData as any)
      .where(eq(keyResults.id, id))
      .returning();
    // Invalidate objectives cache since KR progress affects objective progress
    // Use lightweight query to get just tenantId instead of full objective
    if (keyResult.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, keyResult.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return keyResult;
  }

  async deleteKeyResult(id: string, userId?: string): Promise<void> {
    const now = new Date();
    const deletedBy = userId ?? null;

    // Get key result with objective info using join, then soft-delete
    const keyResultWithObjective = await db
      .select({ objectiveId: keyResults.objectiveId })
      .from(keyResults)
      .where(eq(keyResults.id, id))
      .limit(1);

    // Find big rocks linked to this KR so we can cascade their tasks too
    const cascadedBigRocks = await db
      .select({ id: bigRocks.id })
      .from(bigRocks)
      .where(and(eq(bigRocks.keyResultId, id), isNull(bigRocks.deletedAt)));
    const cascadedBigRockIds = cascadedBigRocks.map(b => b.id);

    // Cascade soft-delete to associated big rocks
    await db.update(bigRocks)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(bigRocks.keyResultId, id), isNull(bigRocks.deletedAt)));
    if (cascadedBigRockIds.length > 0) {
      await db.update(bigRockTasks)
        .set({ deletedAt: now, deletedBy })
        .where(and(
          inArray(bigRockTasks.bigRockId, cascadedBigRockIds),
          isNull(bigRockTasks.deletedAt)
        ));
    }

    // Soft-delete the key result
    await db.update(keyResults)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(keyResults.id, id), isNull(keyResults.deletedAt)));

    // Invalidate objectives cache
    if (keyResultWithObjective[0]?.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, keyResultWithObjective[0].objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
  }

  async restoreKeyResult(id: string, tenantId: string): Promise<KeyResult | undefined> {
    // Fetch original (regardless of deleted state) and authorize by tenant via parent objective.
    const [original] = await db.select().from(keyResults).where(eq(keyResults.id, id));
    if (!original) return undefined;
    const [parentObj] = await db
      .select({ tenantId: objectives.tenantId })
      .from(objectives)
      .where(eq(objectives.id, original.objectiveId))
      .limit(1);
    if (!parentObj || parentObj.tenantId !== tenantId) return undefined;
    if (!original.deletedAt) return original;

    const cascadeTimestamp = original.deletedAt;

    const [restored] = await db.update(keyResults)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(keyResults.id, id))
      .returning();
    if (!restored) return undefined;

    // Cascade-restore big rocks that were deleted as part of the same operation
    const restoredBigRocks = await db.update(bigRocks)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(
        eq(bigRocks.keyResultId, id),
        eq(bigRocks.deletedAt, cascadeTimestamp)
      ))
      .returning({ id: bigRocks.id });

    if (restoredBigRocks.length > 0) {
      await db.update(bigRockTasks)
        .set({ deletedAt: null, deletedBy: null })
        .where(and(
          inArray(bigRockTasks.bigRockId, restoredBigRocks.map(b => b.id)),
          eq(bigRockTasks.deletedAt, cascadeTimestamp)
        ));
    }

    {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, restored.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return restored || undefined;
  }

  async promoteKeyResultToKpi(keyResultId: string, userId: string): Promise<Kpi> {
    // Get the key result
    const keyResult = await this.getKeyResultById(keyResultId);
    if (!keyResult) {
      throw new Error(`Key Result with id ${keyResultId} not found`);
    }

    // Create a KPI from the key result
    const [kpi] = await db
      .insert(kpis)
      .values({
        tenantId: keyResult.tenantId,
        label: keyResult.title,
        value: Math.floor(keyResult.currentValue || 0),
        target: Math.floor(keyResult.targetValue),
        linkedGoals: [],
        quarter: null,
        year: null,
        updatedBy: userId,
      })
      .returning();

    // Mark the key result as promoted
    await db
      .update(keyResults)
      .set({
        isPromotedToKpi: 'true',
        promotedKpiId: kpi.id,
        promotedAt: new Date(),
        promotedBy: userId,
      })
      .where(eq(keyResults.id, keyResultId));

    return kpi;
  }

  async unpromoteKeyResultFromKpi(keyResultId: string): Promise<KeyResult> {
    // Get the key result
    const keyResult = await this.getKeyResultById(keyResultId);
    if (!keyResult) {
      throw new Error(`Key Result with id ${keyResultId} not found`);
    }

    // Delete the associated KPI if it exists
    if (keyResult.promotedKpiId) {
      await db.delete(kpis).where(eq(kpis.id, keyResult.promotedKpiId));
    }

    // Un-mark the key result as promoted
    const [updated] = await db
      .update(keyResults)
      .set({
        isPromotedToKpi: 'false',
        promotedKpiId: null,
        promotedAt: null,
        promotedBy: null,
      })
      .where(eq(keyResults.id, keyResultId))
      .returning();

    return updated;
  }

  async getBigRocksByTenantId(tenantId: string, quarter?: number, year?: number): Promise<BigRock[]> {
    // Annual view (quarter=0): show only annual big rocks for that year
    if (quarter === 0 && year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          or(eq(bigRocks.quarter, 0), isNull(bigRocks.quarter)),
          isNull(bigRocks.deletedAt)
        )
      );
    }
    
    // No quarter specified: fetch ALL big rocks for that year (all periods)
    if (quarter === undefined && year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          isNull(bigRocks.deletedAt)
        )
      );
    }
    
    // If quarter and year provided (quarterly view), show only that quarter's big rocks
    if (quarter !== undefined && quarter > 0 && year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          eq(bigRocks.quarter, quarter),
          isNull(bigRocks.deletedAt)
        )
      );
    }
    
    // If only year provided, fetch all big rocks for that year
    if (year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          isNull(bigRocks.deletedAt)
        )
      );
    }
    
    // No filters, return all
    return await db.select().from(bigRocks).where(
      and(eq(bigRocks.tenantId, tenantId), isNull(bigRocks.deletedAt))
    );
  }

  async getBigRockById(id: string): Promise<BigRock | undefined> {
    const [bigRock] = await db.select().from(bigRocks).where(
      and(eq(bigRocks.id, id), isNull(bigRocks.deletedAt))
    );
    return bigRock || undefined;
  }

  async getBigRockByIdForTenant(id: string, tenantId: string): Promise<BigRock | undefined> {
    const [bigRock] = await db.select().from(bigRocks).where(
      and(
        eq(bigRocks.id, id),
        eq(bigRocks.tenantId, tenantId),
        isNull(bigRocks.deletedAt)
      )
    );
    return bigRock || undefined;
  }

  async getBigRocksByObjectiveId(objectiveId: string): Promise<BigRock[]> {
    return await db.select().from(bigRocks).where(
      and(eq(bigRocks.objectiveId, objectiveId), isNull(bigRocks.deletedAt))
    );
  }

  async getBigRocksByKeyResultId(keyResultId: string): Promise<BigRock[]> {
    return await db.select().from(bigRocks).where(
      and(eq(bigRocks.keyResultId, keyResultId), isNull(bigRocks.deletedAt))
    );
  }

  async getBigRocksWithPlannerSync(): Promise<BigRock[]> {
    return await db.select().from(bigRocks).where(
      and(
        isNotNull(bigRocks.plannerPlanId),
        eq(bigRocks.plannerSyncEnabled, true),
        isNull(bigRocks.deletedAt)
      )
    );
  }

  async createBigRock(insertBigRock: InsertBigRock): Promise<BigRock> {
    const [bigRock] = await db
      .insert(bigRocks)
      .values({
        ...insertBigRock,
        blockedBy: insertBigRock.blockedBy ? [...insertBigRock.blockedBy] : null,
        tasks: insertBigRock.tasks ? [...insertBigRock.tasks] : null,
      } as any)
      .returning();
    // Invalidate objectives cache since big rocks are linked to objectives
    // Use lightweight query to get just tenantId
    if (bigRock.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, bigRock.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return bigRock;
  }

  async updateBigRock(id: string, updateData: Partial<InsertBigRock>): Promise<BigRock> {
    const [bigRock] = await db
      .update(bigRocks)
      .set({
        ...updateData,
        blockedBy: updateData.blockedBy ? [...updateData.blockedBy] : undefined,
        tasks: updateData.tasks ? [...updateData.tasks] : undefined,
        linkedStrategies: updateData.linkedStrategies ? [...updateData.linkedStrategies] : undefined,
      })
      .where(eq(bigRocks.id, id))
      .returning();
    // Invalidate objectives cache
    // Use lightweight query to get just tenantId
    if (bigRock.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, bigRock.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return bigRock;
  }

  async deleteBigRock(id: string, userId?: string): Promise<void> {
    const now = new Date();
    const deletedBy = userId ?? null;

    // Get big rock with objective info, then soft-delete
    const bigRockWithObjective = await db
      .select({ objectiveId: bigRocks.objectiveId })
      .from(bigRocks)
      .where(eq(bigRocks.id, id))
      .limit(1);

    // Cascade soft-delete to big rock tasks
    await db.update(bigRockTasks)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(bigRockTasks.bigRockId, id), isNull(bigRockTasks.deletedAt)));

    await db.update(bigRocks)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(bigRocks.id, id), isNull(bigRocks.deletedAt)));

    // Invalidate objectives cache
    if (bigRockWithObjective[0]?.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, bigRockWithObjective[0].objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
  }

  async restoreBigRock(id: string, tenantId: string): Promise<BigRock | undefined> {
    // Fetch and authorize by tenant before any mutation
    const [original] = await db.select().from(bigRocks).where(eq(bigRocks.id, id));
    if (!original || original.tenantId !== tenantId) return undefined;
    if (!original.deletedAt) return original;

    const cascadeTimestamp = original.deletedAt;

    const [restored] = await db.update(bigRocks)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(eq(bigRocks.id, id), eq(bigRocks.tenantId, tenantId)))
      .returning();
    if (!restored) return undefined;

    // Cascade-restore tasks deleted as part of the same operation
    await db.update(bigRockTasks)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(
        eq(bigRockTasks.bigRockId, id),
        eq(bigRockTasks.deletedAt, cascadeTimestamp)
      ));

    if (restored.objectiveId) {
      const objective = await db
        .select({ tenantId: objectives.tenantId })
        .from(objectives)
        .where(eq(objectives.id, restored.objectiveId))
        .limit(1);
      if (objective[0]) {
        this.invalidateCache(`objectives:${objective[0].tenantId}`);
      }
    }
    return restored;
  }

  // Big Rock Task methods
  async getBigRockTasksByBigRockId(bigRockId: string): Promise<BigRockTask[]> {
    return await db
      .select()
      .from(bigRockTasks)
      .where(and(eq(bigRockTasks.bigRockId, bigRockId), isNull(bigRockTasks.deletedAt)))
      .orderBy(bigRockTasks.sortOrder, bigRockTasks.createdAt);
  }

  async getBigRockTaskById(id: string): Promise<BigRockTask | undefined> {
    const [task] = await db.select().from(bigRockTasks)
      .where(and(eq(bigRockTasks.id, id), isNull(bigRockTasks.deletedAt)));
    return task;
  }

  async createBigRockTask(insertTask: InsertBigRockTask): Promise<BigRockTask> {
    // Get the max sortOrder for tasks in this big rock
    const existingTasks = await db
      .select({ sortOrder: bigRockTasks.sortOrder })
      .from(bigRockTasks)
      .where(eq(bigRockTasks.bigRockId, insertTask.bigRockId))
      .orderBy(desc(bigRockTasks.sortOrder))
      .limit(1);
    
    const nextSortOrder = existingTasks.length > 0 ? (existingTasks[0].sortOrder || 0) + 1 : 0;
    
    const [task] = await db
      .insert(bigRockTasks)
      .values({
        ...insertTask,
        sortOrder: insertTask.sortOrder ?? nextSortOrder,
      })
      .returning();
    return task;
  }

  async updateBigRockTask(id: string, updateData: Partial<InsertBigRockTask>): Promise<BigRockTask> {
    // If status is being set to completed, set completedAt
    const updates: any = {
      ...updateData,
      updatedAt: new Date(),
    };
    
    if (updateData.status === 'completed' && !updateData.completedAt) {
      updates.completedAt = new Date();
    } else if (updateData.status && updateData.status !== 'completed') {
      updates.completedAt = null;
    }
    
    const [task] = await db
      .update(bigRockTasks)
      .set(updates)
      .where(eq(bigRockTasks.id, id))
      .returning();
    return task;
  }

  async deleteBigRockTask(id: string): Promise<void> {
    await db.delete(bigRockTasks).where(eq(bigRockTasks.id, id));
  }

  async reorderBigRockTasks(bigRockId: string, taskIds: string[]): Promise<void> {
    // Update sortOrder based on the position in the array
    for (let i = 0; i < taskIds.length; i++) {
      await db
        .update(bigRockTasks)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(bigRockTasks.id, taskIds[i]), eq(bigRockTasks.bigRockId, bigRockId)));
    }
  }

  async getBigRockTaskCountsByBigRockIds(bigRockIds: string[]): Promise<Map<string, { total: number; completed: number }>> {
    if (bigRockIds.length === 0) return new Map();
    
    const tasks = await db
      .select({
        bigRockId: bigRockTasks.bigRockId,
        status: bigRockTasks.status,
      })
      .from(bigRockTasks)
      .where(and(
        inArray(bigRockTasks.bigRockId, bigRockIds),
        isNull(bigRockTasks.deletedAt)
      ));
    
    const counts = new Map<string, { total: number; completed: number }>();
    
    for (const bigRockId of bigRockIds) {
      counts.set(bigRockId, { total: 0, completed: 0 });
    }
    
    for (const task of tasks) {
      const current = counts.get(task.bigRockId) || { total: 0, completed: 0 };
      current.total++;
      if (task.status === 'completed') {
        current.completed++;
      }
      counts.set(task.bigRockId, current);
    }
    
    return counts;
  }

  async linkObjectiveToBigRock(objectiveId: string, bigRockId: string, tenantId: string): Promise<void> {
    await db.insert(objectiveBigRocks).values({
      objectiveId,
      bigRockId,
      tenantId,
    }).onConflictDoNothing();
  }

  async unlinkObjectiveToBigRock(objectiveId: string, bigRockId: string): Promise<void> {
    await db.delete(objectiveBigRocks).where(
      and(
        eq(objectiveBigRocks.objectiveId, objectiveId),
        eq(objectiveBigRocks.bigRockId, bigRockId)
      )
    );
  }

  async getBigRocksLinkedToObjective(objectiveId: string): Promise<BigRock[]> {
    const links = await db
      .select()
      .from(objectiveBigRocks)
      .innerJoin(bigRocks, eq(objectiveBigRocks.bigRockId, bigRocks.id))
      .where(eq(objectiveBigRocks.objectiveId, objectiveId));
    
    return links.map(link => link.big_rocks);
  }

  async getLinkedObjectiveIdsForBigRocks(bigRockIds: string[]): Promise<Map<string, string[]>> {
    if (bigRockIds.length === 0) return new Map();
    
    const links = await db
      .select({
        bigRockId: objectiveBigRocks.bigRockId,
        objectiveId: objectiveBigRocks.objectiveId,
      })
      .from(objectiveBigRocks)
      .where(inArray(objectiveBigRocks.bigRockId, bigRockIds));
    
    const result = new Map<string, string[]>();
    for (const link of links) {
      const existing = result.get(link.bigRockId) || [];
      existing.push(link.objectiveId);
      result.set(link.bigRockId, existing);
    }
    return result;
  }

  async linkKeyResultToBigRock(keyResultId: string, bigRockId: string, tenantId: string): Promise<void> {
    await db.insert(keyResultBigRocks).values({
      keyResultId,
      bigRockId,
      tenantId,
    }).onConflictDoNothing();
  }

  async unlinkKeyResultToBigRock(keyResultId: string, bigRockId: string): Promise<void> {
    await db.delete(keyResultBigRocks).where(
      and(
        eq(keyResultBigRocks.keyResultId, keyResultId),
        eq(keyResultBigRocks.bigRockId, bigRockId)
      )
    );
  }

  async getBigRocksLinkedToKeyResult(keyResultId: string): Promise<BigRock[]> {
    const links = await db
      .select()
      .from(keyResultBigRocks)
      .innerJoin(bigRocks, eq(keyResultBigRocks.bigRockId, bigRocks.id))
      .where(eq(keyResultBigRocks.keyResultId, keyResultId));
    
    return links.map(link => link.big_rocks);
  }

  async getObjectiveHierarchy(tenantId: string, quarter?: number, year?: number, level?: string, teamId?: string): Promise<Array<Objective & {
    keyResults: KeyResult[];
    childObjectives: Objective[];
    alignedObjectives: Objective[]; // Objectives that "ladder up" to this one (virtual children)
    linkedBigRocks: BigRock[];
    lastUpdated: Date | null;
  }>> {
    // Use the recursive CTE to fetch only the matching objectives in dependency order.
    const tree = await this.loadObjectiveTreeRows({ tenantId, quarter, year, level, teamId });
    if (tree.rows.length === 0) return [];

    return await this.assembleObjectiveTree(tenantId, tree.rows, null);
  }

  async getObjectiveSubtree(rootId: string, tenantId: string): Promise<Array<Objective & {
    keyResults: KeyResult[];
    childObjectives: Objective[];
    alignedObjectives: Objective[];
    linkedBigRocks: BigRock[];
    lastUpdated: Date | null;
  }>> {
    // Sub-tree mode: traverse only descendants of the requested root via recursive CTE.
    // No quarter/year/level/team filters are applied — callers can post-filter if needed.
    const tree = await this.loadObjectiveTreeRows({ tenantId, rootId });
    if (tree.rows.length === 0) return [];

    // Force the requested root to always appear as a root, regardless of any
    // corruption in its own parent chain (its parent_id might point at a row
    // that's also in the result set due to cycles upstream).
    return await this.assembleObjectiveTree(tenantId, tree.rows, rootId);
  }

  /**
   * Assemble the enriched tree from the CTE row set.
   *
   * Parent/child links are taken from the CTE edges (rows with depth > 0),
   * never from raw objective.parentId, so cycle/back-edge rows excluded by
   * the CTE cannot reappear during JS assembly. Build is recursive with a
   * per-branch processedIds set so any residual cycle in the alignment
   * graph terminates with empty children rather than circular references.
   *
   * forcedRootId pins the requested root for sub-tree loads.
   */
  private async assembleObjectiveTree(
    tenantId: string,
    treeRows: Array<{ id: string; parentId: string | null; depth: number }>,
    forcedRootId: string | null,
  ): Promise<Array<Objective & {
    keyResults: KeyResult[];
    childObjectives: any[];
    alignedObjectives: any[];
    linkedBigRocks: BigRock[];
    lastUpdated: Date | null;
  }>> {
    const objectiveIds = treeRows.map(r => r.id);

    const rawObjectives = await db
      .select()
      .from(objectives)
      .where(and(eq(objectives.tenantId, tenantId), inArray(objectives.id, objectiveIds)));

    // Completed objectives always report 100% progress (matches getObjectivesByTenantId).
    const allObjectives: Objective[] = rawObjectives.map(obj =>
      obj.status === 'completed' && (obj.progress ?? 0) < 100
        ? { ...obj, progress: 100 }
        : obj
    );
    const objectivesById = new Map<string, Objective>();
    for (const obj of allObjectives) objectivesById.set(obj.id, obj);

    const levelOrder: Record<string, number> = {
      organization: 0,
      division: 1,
      team: 2,
      individual: 3,
    };

    const extractNumericPrefix = (title: string): number | null => {
      const match = title.match(/^\s*(\d+)\./);
      return match ? parseInt(match[1], 10) : null;
    };

    const sortObjectives = <T extends { level?: string | null; title: string }>(objs: T[]): T[] => {
      return [...objs].sort((a, b) => {
        const aPrefix = extractNumericPrefix(a.title || '');
        const bPrefix = extractNumericPrefix(b.title || '');
        if (aPrefix !== null && bPrefix !== null) return aPrefix - bPrefix;
        if (aPrefix !== null) return -1;
        if (bPrefix !== null) return 1;
        const levelDiff = (levelOrder[a.level || 'team'] ?? 4) - (levelOrder[b.level || 'team'] ?? 4);
        if (levelDiff !== 0) return levelDiff;
        return (a.title || '').localeCompare(b.title || '');
      });
    };

    const [keyResultsMap, linkedBigRocksMap, latestCheckInMap] = await Promise.all([
      this.getKeyResultsByObjectiveIds(objectiveIds),
      this.getBigRocksLinkedToObjectives(objectiveIds),
      this.getLatestCheckInsForEntities('objective', objectiveIds),
    ]);

    // Build childrenByParentId from CTE edges only — rows with depth > 0 are
    // accepted descendants; depth-0 rows are CTE roots (real or virtual) and
    // never re-attach as someone else's child even if their raw parentId
    // happens to match another included node (e.g. cycle back-edge).
    const childrenByParentId = new Map<string, Objective[]>();
    for (const row of treeRows) {
      if (row.depth === 0 || !row.parentId) continue;
      const childObj = objectivesById.get(row.id);
      if (!childObj) continue;
      const arr = childrenByParentId.get(row.parentId);
      if (arr) arr.push(childObj); else childrenByParentId.set(row.parentId, [childObj]);
    }

    // Aligned ("ladders up to") children: a many-to-many graph independent of
    // parent_id. Filtered to targets that are also in the result set.
    const filteredIds = new Set(objectivesById.keys());
    const alignedChildrenByTargetId = new Map<string, Objective[]>();
    for (const obj of allObjectives) {
      const alignedToIds = obj.alignedToObjectiveIds;
      if (!Array.isArray(alignedToIds)) continue;
      for (const targetId of alignedToIds) {
        if (!filteredIds.has(targetId)) continue;
        const arr = alignedChildrenByTargetId.get(targetId);
        if (arr) arr.push(obj); else alignedChildrenByTargetId.set(targetId, [obj]);
      }
    }
    for (const [k, v] of Array.from(childrenByParentId.entries())) {
      childrenByParentId.set(k, sortObjectives(v));
    }
    for (const [k, v] of Array.from(alignedChildrenByTargetId.entries())) {
      alignedChildrenByTargetId.set(k, sortObjectives(v));
    }

    // Recursive enrichment with per-branch processedIds — siblings can share
    // a descendant, but a cycle terminates with an empty leaf so the result
    // is always JSON-serializable.
    const buildEnriched = (
      objective: Objective,
      processedIds: Set<string>,
    ): Objective & {
      keyResults: KeyResult[];
      childObjectives: any[];
      alignedObjectives: any[];
      linkedBigRocks: BigRock[];
      lastUpdated: Date | null;
    } => {
      const krs = keyResultsMap.get(objective.id) || [];
      const sortedKeyResults = [...krs].sort((a, b) => {
        const aPrefix = extractNumericPrefix(a.title || '');
        const bPrefix = extractNumericPrefix(b.title || '');
        if (aPrefix !== null && bPrefix !== null) return aPrefix - bPrefix;
        if (aPrefix !== null) return -1;
        if (bPrefix !== null) return 1;
        return (a.title || '').localeCompare(b.title || '');
      });
      const latestCheckIn = latestCheckInMap.get(objective.id);
      const linkedBigRocks = linkedBigRocksMap.get(objective.id) || [];

      if (processedIds.has(objective.id)) {
        return {
          ...objective,
          keyResults: sortedKeyResults,
          childObjectives: [],
          alignedObjectives: [],
          linkedBigRocks,
          lastUpdated: latestCheckIn?.createdAt || objective.updatedAt,
        };
      }
      const branchProcessed = new Set(processedIds);
      branchProcessed.add(objective.id);

      const children = childrenByParentId.get(objective.id) || [];
      const aligned = alignedChildrenByTargetId.get(objective.id) || [];
      return {
        ...objective,
        keyResults: sortedKeyResults,
        childObjectives: children.map(c => buildEnriched(c, branchProcessed)),
        alignedObjectives: aligned.map(a => ({
          ...buildEnriched(a, branchProcessed),
          isAligned: true,
        })),
        linkedBigRocks,
        lastUpdated: latestCheckIn?.createdAt || objective.updatedAt,
      };
    };

    // Roots: forced root for sub-tree mode, otherwise CTE depth-0 rows
    // (which are virtual roots whose parent was filtered/missing).
    let rootObjectives: Objective[];
    if (forcedRootId) {
      const forced = objectivesById.get(forcedRootId);
      rootObjectives = forced ? [forced] : [];
    } else {
      const rootIds = treeRows.filter(r => r.depth === 0).map(r => r.id);
      rootObjectives = rootIds
        .map(id => objectivesById.get(id))
        .filter((o): o is Objective => o !== undefined);
    }

    return sortObjectives(rootObjectives).map(obj => buildEnriched(obj, new Set<string>()));
  }

  /**
   * Build a SQL fragment for the standard objective filters (year/quarter/level/team)
   * that mirrors getObjectivesByTenantId's filter logic. Used inside the recursive CTE.
   */
  private buildObjectiveFilterSQL(
    opts: { quarter?: number; year?: number; level?: string; teamId?: string },
    alias: string,
  ) {
    const a = sql.raw(alias);
    const parts: any[] = [];
    if (opts.year !== undefined) {
      parts.push(sql`${a}.year = ${opts.year}`);
    }
    if (opts.quarter === 0 && opts.year !== undefined) {
      parts.push(sql`(${a}.quarter IS NULL OR ${a}.quarter = 0)`);
    } else if (opts.quarter !== undefined && opts.quarter > 0 && opts.year !== undefined) {
      parts.push(sql`(${a}.quarter = ${opts.quarter} OR ${a}.quarter IS NULL)`);
    }
    if (opts.level && opts.level !== 'all') {
      parts.push(sql`${a}.level = ${opts.level}`);
    }
    if (opts.teamId && opts.teamId !== 'all') {
      parts.push(sql`${a}.team_id = ${opts.teamId}`);
    }
    if (parts.length === 0) return sql`TRUE`;
    return sql.join(parts, sql` AND `);
  }

  /**
   * Recursive CTE that walks the objective parent_id chain.
   *
   * Modes:
   *   - rootId set     → root + all descendants (sub-tree load).
   *   - rootId not set → all tenant objectives matching the standard
   *     filters, with any matching row whose parent is missing/filtered as a
   *     virtual root.
   *
   * The recursive step emits an is_cycle flag for any row whose id is
   * already on its ancestry path; cycle rows are warned about and excluded
   * from the result. Depth is capped at OBJECTIVE_HIERARCHY_DEPTH_CAP and
   * we only warn about truncation when an at-cap row actually has omitted
   * descendants in the DB.
   */
  private async loadObjectiveTreeRows(params: {
    tenantId: string;
    rootId?: string;
    quarter?: number;
    year?: number;
    level?: string;
    teamId?: string;
  }): Promise<{ rows: Array<{ id: string; parentId: string | null; depth: number }> }> {
    const { tenantId, rootId } = params;
    const filterSQL = this.buildObjectiveFilterSQL(params, 'o');

    let baseSelect;
    if (rootId) {
      baseSelect = sql`
        SELECT b.id AS id, b.parent_id AS parent_id, 0 AS depth, ARRAY[b.id] AS path,
               FALSE AS is_cycle
        FROM objectives b
        WHERE b.id = ${rootId} AND b.tenant_id = ${tenantId}
      `;
    } else {
      const baseFilterSQL = this.buildObjectiveFilterSQL(params, 'b');
      const parentFilterSQL = this.buildObjectiveFilterSQL(params, 'p');
      baseSelect = sql`
        SELECT b.id AS id, b.parent_id AS parent_id, 0 AS depth, ARRAY[b.id] AS path,
               FALSE AS is_cycle
        FROM objectives b
        WHERE b.tenant_id = ${tenantId}
          AND ${baseFilterSQL}
          AND (
            b.parent_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM objectives p
              WHERE p.id = b.parent_id
                AND p.tenant_id = ${tenantId}
                AND ${parentFilterSQL}
            )
          )
      `;
    }

    // In sub-tree mode no extra filters apply; in full mode they apply at every depth.
    const recursiveFilterSQL = rootId ? sql`TRUE` : filterSQL;

    const result = await db.execute(sql`
      WITH RECURSIVE okr_tree AS (
        ${baseSelect}
        UNION ALL
        SELECT
          o.id AS id,
          o.parent_id AS parent_id,
          t.depth + 1 AS depth,
          t.path || o.id AS path,
          (o.id = ANY(t.path)) AS is_cycle
        FROM objectives o
        INNER JOIN okr_tree t ON o.parent_id = t.id
        WHERE NOT t.is_cycle
          AND o.tenant_id = ${tenantId}
          AND t.depth < ${OBJECTIVE_HIERARCHY_DEPTH_CAP}
          AND ${recursiveFilterSQL}
      )
      SELECT id, parent_id, depth, is_cycle
      FROM okr_tree
      ORDER BY depth ASC, id ASC
    `);

    const allRows = (result.rows || []).map((r: any) => ({
      id: String(r.id),
      parentId: r.parent_id == null ? null : String(r.parent_id),
      depth: Number(r.depth),
      isCycle: r.is_cycle === true || r.is_cycle === 't' || r.is_cycle === 'true',
    }));

    const cycleRows = allRows.filter(r => r.isCycle);
    if (cycleRows.length > 0) {
      const sample = cycleRows.slice(0, 10).map(r => `${r.id} (parent=${r.parentId})`).join(', ');
      console.warn(
        `[getObjectiveHierarchy] Detected ${cycleRows.length} cyclic parent_id link(s) for tenant ${tenantId}. ` +
        `These rows were skipped during traversal: ${sample}${cycleRows.length > 10 ? ', ...' : ''}`
      );
    }

    const rows = allRows.filter(r => !r.isCycle).map(({ id, parentId, depth }) => ({ id, parentId, depth }));

    const cappedIds = rows.filter(r => r.depth >= OBJECTIVE_HIERARCHY_DEPTH_CAP).map(r => r.id);
    if (cappedIds.length > 0) {
      const includedIds = new Set(rows.map(r => r.id));
      const childCheck = await db.execute(sql`
        SELECT o.id AS id, o.parent_id AS parent_id
        FROM objectives o
        WHERE o.tenant_id = ${tenantId}
          AND o.parent_id IN (${sql.join(cappedIds.map(id => sql`${id}`), sql`, `)})
      `);
      const omittedParentIds = new Set<string>();
      for (const r of (childCheck.rows || []) as Array<{ id: any; parent_id: any }>) {
        const cid = String(r.id);
        const pid = r.parent_id == null ? null : String(r.parent_id);
        if (pid && !includedIds.has(cid)) omittedParentIds.add(pid);
      }
      if (omittedParentIds.size > 0) {
        const affectedIds = Array.from(omittedParentIds).sort();
        const message =
          `[getObjectiveHierarchy] Hierarchy depth cap (${OBJECTIVE_HIERARCHY_DEPTH_CAP}) reached for tenant ${tenantId}. ` +
          `Truncated descendants under objective ids: ${affectedIds.join(', ')}`;
        console.warn(message);
        try {
          await this.recordAdminAlert({
            tenantId,
            alertType: ADMIN_ALERT_TYPE.OBJECTIVE_DEPTH_CAP,
            fingerprint: ADMIN_ALERT_TYPE.OBJECTIVE_DEPTH_CAP,
            severity: ADMIN_ALERT_SEVERITY.WARNING,
            message:
              `Objective hierarchy depth cap (${OBJECTIVE_HIERARCHY_DEPTH_CAP}) reached. ` +
              `${affectedIds.length} objective(s) had descendants truncated when loading the alignment tree.`,
            details: {
              depthCap: OBJECTIVE_HIERARCHY_DEPTH_CAP,
              affectedObjectiveIds: affectedIds,
            },
          });
        } catch (err) {
          console.error('[getObjectiveHierarchy] Failed to record admin alert for depth cap', err);
        }
      }
    }

    return { rows };
  }

  async getCheckInsByEntityId(entityType: string, entityId: string): Promise<CheckIn[]> {
    return await db
      .select()
      .from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        eq(checkIns.entityId, entityId)
      ))
      .orderBy(desc(checkIns.asOfDate));
  }

  async getCheckInsByTenantId(tenantId: string): Promise<CheckIn[]> {
    return await db
      .select()
      .from(checkIns)
      .where(eq(checkIns.tenantId, tenantId))
      .orderBy(desc(checkIns.asOfDate));
  }

  async getCheckInById(id: string): Promise<CheckIn | undefined> {
    const [checkIn] = await db.select().from(checkIns).where(eq(checkIns.id, id));
    return checkIn || undefined;
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db
      .insert(checkIns)
      .values({
        ...insertCheckIn,
        achievements: insertCheckIn.achievements ? [...insertCheckIn.achievements] : null,
        challenges: insertCheckIn.challenges ? [...insertCheckIn.challenges] : null,
        nextSteps: insertCheckIn.nextSteps ? [...insertCheckIn.nextSteps] : null,
      } as any)
      .returning();
    return checkIn;
  }

  async updateCheckIn(id: string, updateData: Partial<CheckIn>): Promise<CheckIn> {
    const [checkIn] = await db
      .update(checkIns)
      .set({
        ...updateData,
        achievements: updateData.achievements ? [...updateData.achievements] : undefined,
        challenges: updateData.challenges ? [...updateData.challenges] : undefined,
        nextSteps: updateData.nextSteps ? [...updateData.nextSteps] : undefined,
      })
      .where(eq(checkIns.id, id))
      .returning();
    return checkIn;
  }

  async deleteCheckIn(id: string): Promise<void> {
    await db.delete(checkIns).where(eq(checkIns.id, id));
  }

  async getLatestCheckIn(entityType: string, entityId: string): Promise<CheckIn | undefined> {
    const [checkIn] = await db
      .select()
      .from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        eq(checkIns.entityId, entityId)
      ))
      .orderBy(desc(checkIns.asOfDate))
      .limit(1);
    return checkIn || undefined;
  }

  // ============================================
  // Progress Snapshots — daily, immutable history
  // ============================================

  async upsertProgressSnapshot(snapshot: InsertProgressSnapshot): Promise<ProgressSnapshot> {
    const values: InsertProgressSnapshot = {
      tenantId: snapshot.tenantId,
      entityType: snapshot.entityType,
      entityId: snapshot.entityId,
      snapshotDate: snapshot.snapshotDate,
      progress: snapshot.progress ?? 0,
      status: snapshot.status ?? null,
      paceStatus: snapshot.paceStatus ?? null,
      source: snapshot.source ?? 'job',
    };

    const [row] = await db
      .insert(progressSnapshots)
      .values(values)
      .onConflictDoUpdate({
        target: [
          progressSnapshots.tenantId,
          progressSnapshots.entityType,
          progressSnapshots.entityId,
          progressSnapshots.snapshotDate,
        ],
        set: {
          progress: values.progress,
          status: values.status,
          paceStatus: values.paceStatus,
          source: values.source,
        },
      })
      .returning();
    return row;
  }

  async getProgressSnapshotsByEntity(
    entityType: string,
    entityId: string,
    fromDate?: string
  ): Promise<ProgressSnapshot[]> {
    const conditions = [
      eq(progressSnapshots.entityType, entityType),
      eq(progressSnapshots.entityId, entityId),
    ];
    if (fromDate) {
      conditions.push(gte(progressSnapshots.snapshotDate, fromDate));
    }
    return await db
      .select()
      .from(progressSnapshots)
      .where(and(...conditions))
      .orderBy(asc(progressSnapshots.snapshotDate));
  }

  async getProgressSnapshotsByEntityIds(
    entityType: string,
    entityIds: string[],
    fromDate?: string
  ): Promise<Map<string, ProgressSnapshot[]>> {
    const result = new Map<string, ProgressSnapshot[]>();
    if (entityIds.length === 0) return result;

    const conditions = [
      eq(progressSnapshots.entityType, entityType),
      inArray(progressSnapshots.entityId, entityIds),
    ];
    if (fromDate) {
      conditions.push(gte(progressSnapshots.snapshotDate, fromDate));
    }

    const rows = await db
      .select()
      .from(progressSnapshots)
      .where(and(...conditions))
      .orderBy(asc(progressSnapshots.snapshotDate));

    for (const row of rows) {
      const list = result.get(row.entityId) || [];
      list.push(row);
      result.set(row.entityId, list);
    }
    return result;
  }

  async countProgressSnapshotsForTenant(tenantId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(progressSnapshots)
      .where(eq(progressSnapshots.tenantId, tenantId));
    return Number(row?.c ?? 0);
  }

  // ============================================
  // BATCH QUERY METHODS - Performance optimizations
  // These methods fetch data for multiple entities in a single query
  // to avoid N+1 query problems
  // ============================================

  /**
   * Get all check-ins for multiple entities in a single query
   * Returns a Map of entityId -> CheckIn[]
   */
  async getCheckInsByEntityIds(entityType: string, entityIds: string[]): Promise<Map<string, CheckIn[]>> {
    if (entityIds.length === 0) {
      return new Map();
    }
    
    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        inArray(checkIns.entityId, entityIds)
      ))
      .orderBy(desc(checkIns.asOfDate));
    
    // Group by entityId
    const resultMap = new Map<string, CheckIn[]>();
    for (const checkIn of allCheckIns) {
      const existing = resultMap.get(checkIn.entityId) || [];
      existing.push(checkIn);
      resultMap.set(checkIn.entityId, existing);
    }
    
    return resultMap;
  }

  /**
   * Get all key results for multiple objectives in a single query
   * Returns a Map of objectiveId -> KeyResult[]
   */
  async getKeyResultsByObjectiveIds(objectiveIds: string[]): Promise<Map<string, KeyResult[]>> {
    if (objectiveIds.length === 0) {
      return new Map();
    }
    
    const allKeyResults = await db
      .select()
      .from(keyResults)
      .where(and(inArray(keyResults.objectiveId, objectiveIds), isNull(keyResults.deletedAt)));
    
    // Group by objectiveId
    const resultMap = new Map<string, KeyResult[]>();
    for (const kr of allKeyResults) {
      const existing = resultMap.get(kr.objectiveId) || [];
      existing.push(kr);
      resultMap.set(kr.objectiveId, existing);
    }
    
    return resultMap;
  }

  /**
   * Get all linked big rocks for multiple objectives in a single query
   * Returns a Map of objectiveId -> BigRock[]
   */
  async getBigRocksLinkedToObjectives(objectiveIds: string[]): Promise<Map<string, BigRock[]>> {
    if (objectiveIds.length === 0) {
      return new Map();
    }
    
    const links = await db
      .select()
      .from(objectiveBigRocks)
      .innerJoin(bigRocks, eq(objectiveBigRocks.bigRockId, bigRocks.id))
      .where(inArray(objectiveBigRocks.objectiveId, objectiveIds));
    
    // Group by objectiveId
    const resultMap = new Map<string, BigRock[]>();
    for (const link of links) {
      const objectiveId = link.objective_big_rocks.objectiveId;
      const existing = resultMap.get(objectiveId) || [];
      existing.push(link.big_rocks);
      resultMap.set(objectiveId, existing);
    }
    
    return resultMap;
  }

  /**
   * Get the latest check-in for multiple entities in a single query
   * Fetches all check-ins for the entities and filters to latest per entity in memory
   * Uses 1 query instead of N separate queries, and then processes O(M) check-ins in memory,
   * where M is the total number of check-ins for all given entities
   * Returns a Map of entityId -> CheckIn
   */
  async getLatestCheckInsForEntities(entityType: string, entityIds: string[]): Promise<Map<string, CheckIn>> {
    if (entityIds.length === 0) {
      return new Map();
    }
    
    // Fetch all check-ins for the given entities in one query
    const allCheckIns = await db
      .select()
      .from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        inArray(checkIns.entityId, entityIds)
      ))
      .orderBy(desc(checkIns.asOfDate));
    
    // Keep only the latest check-in per entity (they're already sorted by date desc)
    const resultMap = new Map<string, CheckIn>();
    for (const checkIn of allCheckIns) {
      if (!resultMap.has(checkIn.entityId)) {
        resultMap.set(checkIn.entityId, checkIn);
      }
    }
    
    return resultMap;
  }

  /**
   * Get all planner tasks linked to multiple objectives in a single query
   * Returns a Map of objectiveId -> PlannerTask[]
   */
  async getPlannerTasksLinkedToObjectives(objectiveIds: string[]): Promise<Map<string, PlannerTask[]>> {
    if (objectiveIds.length === 0) {
      return new Map();
    }
    
    const links = await db
      .select()
      .from(objectivePlannerTasks)
      .innerJoin(plannerTasks, eq(objectivePlannerTasks.plannerTaskId, plannerTasks.id))
      .where(inArray(objectivePlannerTasks.objectiveId, objectiveIds));
    
    const resultMap = new Map<string, PlannerTask[]>();
    for (const link of links) {
      const objectiveId = link.objective_planner_tasks.objectiveId;
      const existing = resultMap.get(objectiveId) || [];
      existing.push(link.planner_tasks);
      resultMap.set(objectiveId, existing);
    }
    
    return resultMap;
  }

  /**
   * Get all planner tasks linked to multiple big rocks in a single query
   * Returns a Map of bigRockId -> PlannerTask[]
   */
  async getPlannerTasksLinkedToBigRocks(bigRockIds: string[]): Promise<Map<string, PlannerTask[]>> {
    if (bigRockIds.length === 0) {
      return new Map();
    }
    
    const links = await db
      .select()
      .from(bigRockPlannerTasks)
      .innerJoin(plannerTasks, eq(bigRockPlannerTasks.plannerTaskId, plannerTasks.id))
      .where(inArray(bigRockPlannerTasks.bigRockId, bigRockIds));
    
    const resultMap = new Map<string, PlannerTask[]>();
    for (const link of links) {
      const bigRockId = link.big_rock_planner_tasks.bigRockId;
      const existing = resultMap.get(bigRockId) || [];
      existing.push(link.planner_tasks);
      resultMap.set(bigRockId, existing);
    }
    
    return resultMap;
  }

  // ============================================
  // END BATCH QUERY METHODS
  // ============================================

  // Value tagging implementations
  async addValueToObjective(objectiveId: string, valueTitle: string, tenantId: string): Promise<void> {
    await db.insert(objectiveValues).values({
      objectiveId,
      valueTitle,
      tenantId,
    }).onConflictDoNothing();
  }

  async removeValueFromObjective(objectiveId: string, valueTitle: string, tenantId: string): Promise<void> {
    await db.delete(objectiveValues).where(
      and(
        eq(objectiveValues.objectiveId, objectiveId),
        eq(objectiveValues.valueTitle, valueTitle),
        eq(objectiveValues.tenantId, tenantId)
      )
    );
  }

  async getValuesByObjectiveId(objectiveId: string, tenantId: string): Promise<string[]> {
    const results = await db
      .select({ valueTitle: objectiveValues.valueTitle })
      .from(objectiveValues)
      .where(and(
        eq(objectiveValues.objectiveId, objectiveId),
        eq(objectiveValues.tenantId, tenantId)
      ));
    return results.map(r => r.valueTitle);
  }

  async addValueToStrategy(strategyId: string, valueTitle: string, tenantId: string): Promise<void> {
    await db.insert(strategyValues).values({
      strategyId,
      valueTitle,
      tenantId,
    }).onConflictDoNothing();
  }

  async removeValueFromStrategy(strategyId: string, valueTitle: string, tenantId: string): Promise<void> {
    await db.delete(strategyValues).where(
      and(
        eq(strategyValues.strategyId, strategyId),
        eq(strategyValues.valueTitle, valueTitle),
        eq(strategyValues.tenantId, tenantId)
      )
    );
  }

  async getValuesByStrategyId(strategyId: string, tenantId: string): Promise<string[]> {
    const results = await db
      .select({ valueTitle: strategyValues.valueTitle })
      .from(strategyValues)
      .where(and(
        eq(strategyValues.strategyId, strategyId),
        eq(strategyValues.tenantId, tenantId)
      ));
    return results.map(r => r.valueTitle);
  }

  async getItemsTaggedWithValue(tenantId: string, valueTitle: string): Promise<{
    objectives: Objective[];
    strategies: Strategy[];
  }> {
    // Get objective IDs tagged with this value
    const objectiveIds = await db
      .select({ id: objectiveValues.objectiveId })
      .from(objectiveValues)
      .where(and(
        eq(objectiveValues.tenantId, tenantId),
        eq(objectiveValues.valueTitle, valueTitle)
      ));

    // Get strategy IDs tagged with this value
    const strategyIds = await db
      .select({ id: strategyValues.strategyId })
      .from(strategyValues)
      .where(and(
        eq(strategyValues.tenantId, tenantId),
        eq(strategyValues.valueTitle, valueTitle)
      ));

    // PERFORMANCE: Use inArray() instead of multiple or(eq()) for better query performance
    const objectiveIdList = objectiveIds.map(({ id }) => id);
    const strategyIdList = strategyIds.map(({ id }) => id);

    // Fetch full objects using inArray for efficient IN clause
    const objectivesList = objectiveIdList.length > 0 
      ? await db.select().from(objectives).where(and(inArray(objectives.id, objectiveIdList), isNull(objectives.deletedAt)))
      : [];

    const strategiesList = strategyIdList.length > 0
      ? await db.select().from(strategies).where(and(inArray(strategies.id, strategyIdList), isNull(strategies.deletedAt)))
      : [];

    return {
      objectives: objectivesList,
      strategies: strategiesList,
    };
  }

  async createImportHistory(data: any): Promise<any> {
    try {
      const result = await db.execute(sql`
        INSERT INTO import_history (
          tenant_id, import_type, file_name, file_size, status,
          objectives_created, key_results_created, big_rocks_created,
          check_ins_created, teams_created, warnings, errors,
          skipped_items, duplicate_strategy, fiscal_year_start_month,
          imported_by
        ) VALUES (
          ${data.tenantId}, ${data.importType}, ${data.fileName}, ${data.fileSize}, ${data.status},
          ${data.objectivesCreated}, ${data.keyResultsCreated}, ${data.bigRocksCreated},
          ${data.checkInsCreated}, ${data.teamsCreated}, ${JSON.stringify(data.warnings)}, ${JSON.stringify(data.errors)},
          ${JSON.stringify(data.skippedItems)}, ${data.duplicateStrategy}, ${data.fiscalYearStartMonth},
          ${data.importedBy}
        )
        RETURNING *
      `);
      return result.rows?.[0] || result;
    } catch (error: any) {
      // Table might not exist in production yet - log and return empty
      console.warn('Import history table not available:', error.message);
      return { id: 'temp-' + Date.now(), ...data };
    }
  }

  async getImportHistory(tenantId: string): Promise<any[]> {
    try {
      const results = await db.execute(sql`
        SELECT * FROM import_history
        WHERE tenant_id = ${tenantId}
        ORDER BY imported_at DESC
        LIMIT 50
      `);
      return results.rows || [];
    } catch (error: any) {
      // Table might not exist in production yet - return empty array
      console.warn('Import history table not available:', error.message);
      return [];
    }
  }

  // Grounding documents methods (for AI context)
  async getAllGroundingDocuments(): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getGlobalGroundingDocuments(): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .where(isNull(groundingDocuments.tenantId))
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getTenantGroundingDocuments(tenantId: string): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .where(eq(groundingDocuments.tenantId, tenantId))
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getActiveGroundingDocuments(): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .where(eq(groundingDocuments.isActive, true))
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getActiveGroundingDocumentsForTenant(tenantId: string): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .where(
        and(
          eq(groundingDocuments.isActive, true),
          or(
            isNull(groundingDocuments.tenantId),
            eq(groundingDocuments.tenantId, tenantId)
          )
        )
      )
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getGroundingDocumentById(id: string): Promise<GroundingDocument | undefined> {
    const [doc] = await db
      .select()
      .from(groundingDocuments)
      .where(eq(groundingDocuments.id, id));
    return doc || undefined;
  }

  async createGroundingDocument(document: InsertGroundingDocument): Promise<GroundingDocument> {
    const [doc] = await db
      .insert(groundingDocuments)
      .values(document)
      .returning();
    return doc;
  }

  async updateGroundingDocument(id: string, document: Partial<InsertGroundingDocument>): Promise<GroundingDocument> {
    const [doc] = await db
      .update(groundingDocuments)
      .set({ ...document, updatedAt: new Date() } as any)
      .where(eq(groundingDocuments.id, id))
      .returning();
    return doc;
  }

  async deleteGroundingDocument(id: string): Promise<void> {
    await db.delete(groundingDocuments).where(eq(groundingDocuments.id, id));
  }

  // Microsoft Graph token methods (service-scoped: 'planner' | 'outlook')
  async getGraphToken(userId: string, service: string = 'planner'): Promise<GraphToken | undefined> {
    const [token] = await db
      .select()
      .from(graphTokens)
      .where(and(
        eq(graphTokens.userId, userId),
        eq(graphTokens.service, service)
      ));
    return token || undefined;
  }

  async upsertGraphToken(token: InsertGraphToken): Promise<GraphToken> {
    const service = token.service || 'planner';
    const existing = await this.getGraphToken(token.userId, service);
    if (existing) {
      const [updated] = await db
        .update(graphTokens)
        .set({ ...token, updatedAt: new Date() } as any)
        .where(and(
          eq(graphTokens.userId, token.userId),
          eq(graphTokens.service, service)
        ))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(graphTokens)
      .values({ ...token, service } as any)
      .returning();
    return created;
  }

  async deleteGraphToken(userId: string, service: string = 'planner'): Promise<void> {
    await db.delete(graphTokens).where(and(
      eq(graphTokens.userId, userId),
      eq(graphTokens.service, service)
    ));
  }

  // Microsoft Planner methods
  async getPlannerPlansByTenantId(tenantId: string): Promise<PlannerPlan[]> {
    return await db
      .select()
      .from(plannerPlans)
      .where(eq(plannerPlans.tenantId, tenantId))
      .orderBy(plannerPlans.title);
  }

  async getPlannerPlanById(id: string): Promise<PlannerPlan | undefined> {
    const [plan] = await db
      .select()
      .from(plannerPlans)
      .where(eq(plannerPlans.id, id));
    return plan || undefined;
  }

  async getPlannerPlanByGraphId(tenantId: string, graphPlanId: string): Promise<PlannerPlan | undefined> {
    const [plan] = await db
      .select()
      .from(plannerPlans)
      .where(and(
        eq(plannerPlans.tenantId, tenantId),
        eq(plannerPlans.graphPlanId, graphPlanId)
      ));
    return plan || undefined;
  }

  async upsertPlannerPlan(plan: InsertPlannerPlan): Promise<PlannerPlan> {
    const existing = await this.getPlannerPlanByGraphId(plan.tenantId, plan.graphPlanId);
    if (existing) {
      const [updated] = await db
        .update(plannerPlans)
        .set({ ...plan, updatedAt: new Date() })
        .where(eq(plannerPlans.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(plannerPlans)
      .values(plan)
      .returning();
    return created;
  }

  async deletePlannerPlan(id: string): Promise<void> {
    await db.delete(plannerPlans).where(eq(plannerPlans.id, id));
  }

  async getPlannerBucketsByPlanId(planId: string): Promise<PlannerBucket[]> {
    return await db
      .select()
      .from(plannerBuckets)
      .where(eq(plannerBuckets.planId, planId))
      .orderBy(plannerBuckets.orderHint);
  }

  async getPlannerBucketById(id: string): Promise<PlannerBucket | undefined> {
    const [bucket] = await db
      .select()
      .from(plannerBuckets)
      .where(eq(plannerBuckets.id, id));
    return bucket || undefined;
  }

  async upsertPlannerBucket(bucket: InsertPlannerBucket): Promise<PlannerBucket> {
    const [existing] = await db
      .select()
      .from(plannerBuckets)
      .where(and(
        eq(plannerBuckets.planId, bucket.planId),
        eq(plannerBuckets.graphBucketId, bucket.graphBucketId)
      ));
    if (existing) {
      const [updated] = await db
        .update(plannerBuckets)
        .set({ ...bucket, updatedAt: new Date() })
        .where(eq(plannerBuckets.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(plannerBuckets)
      .values(bucket)
      .returning();
    return created;
  }

  async deletePlannerBucket(id: string): Promise<void> {
    await db.delete(plannerBuckets).where(eq(plannerBuckets.id, id));
  }

  async getPlannerTasksByPlanId(planId: string): Promise<PlannerTask[]> {
    return await db
      .select()
      .from(plannerTasks)
      .where(eq(plannerTasks.planId, planId))
      .orderBy(plannerTasks.title);
  }

  async getPlannerTasksByBucketId(bucketId: string): Promise<PlannerTask[]> {
    return await db
      .select()
      .from(plannerTasks)
      .where(eq(plannerTasks.bucketId, bucketId))
      .orderBy(plannerTasks.title);
  }

  async getPlannerTaskById(id: string): Promise<PlannerTask | undefined> {
    const [task] = await db
      .select()
      .from(plannerTasks)
      .where(eq(plannerTasks.id, id));
    return task || undefined;
  }

  async upsertPlannerTask(task: InsertPlannerTask): Promise<PlannerTask> {
    const [existing] = await db
      .select()
      .from(plannerTasks)
      .where(and(
        eq(plannerTasks.planId, task.planId),
        eq(plannerTasks.graphTaskId, task.graphTaskId)
      ));
    if (existing) {
      const [updated] = await db
        .update(plannerTasks)
        .set({ ...task, updatedAt: new Date() })
        .where(eq(plannerTasks.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(plannerTasks)
      .values(task)
      .returning();
    return created;
  }

  async deletePlannerTask(id: string): Promise<void> {
    await db.delete(plannerTasks).where(eq(plannerTasks.id, id));
  }

  // Planner task linking
  async linkPlannerTaskToObjective(plannerTaskId: string, objectiveId: string, tenantId: string, userId?: string): Promise<void> {
    await db
      .insert(objectivePlannerTasks)
      .values({
        objectiveId,
        plannerTaskId,
        tenantId,
        createdBy: userId || null,
      })
      .onConflictDoNothing();
  }

  async unlinkPlannerTaskFromObjective(plannerTaskId: string, objectiveId: string): Promise<void> {
    await db
      .delete(objectivePlannerTasks)
      .where(and(
        eq(objectivePlannerTasks.plannerTaskId, plannerTaskId),
        eq(objectivePlannerTasks.objectiveId, objectiveId)
      ));
  }

  async getPlannerTasksLinkedToObjective(objectiveId: string): Promise<PlannerTask[]> {
    // PERFORMANCE: Use JOIN to fetch all tasks in a single query instead of N+1
    const links = await db
      .select()
      .from(objectivePlannerTasks)
      .innerJoin(plannerTasks, eq(objectivePlannerTasks.plannerTaskId, plannerTasks.id))
      .where(eq(objectivePlannerTasks.objectiveId, objectiveId));
    
    return links.map(link => link.planner_tasks);
  }

  async linkPlannerTaskToBigRock(plannerTaskId: string, bigRockId: string, tenantId: string, userId?: string): Promise<void> {
    await db
      .insert(bigRockPlannerTasks)
      .values({
        bigRockId,
        plannerTaskId,
        tenantId,
        createdBy: userId || null,
      })
      .onConflictDoNothing();
  }

  async unlinkPlannerTaskFromBigRock(plannerTaskId: string, bigRockId: string): Promise<void> {
    await db
      .delete(bigRockPlannerTasks)
      .where(and(
        eq(bigRockPlannerTasks.plannerTaskId, plannerTaskId),
        eq(bigRockPlannerTasks.bigRockId, bigRockId)
      ));
  }

  async getPlannerTasksLinkedToBigRock(bigRockId: string): Promise<PlannerTask[]> {
    // PERFORMANCE: Use JOIN to fetch all tasks in a single query instead of N+1
    const links = await db
      .select()
      .from(bigRockPlannerTasks)
      .innerJoin(plannerTasks, eq(bigRockPlannerTasks.plannerTaskId, plannerTasks.id))
      .where(eq(bigRockPlannerTasks.bigRockId, bigRockId));
    
    return links.map(link => link.planner_tasks);
  }

  // Consultant tenant access grant methods
  async getConsultantTenantAccess(userId: string): Promise<ConsultantTenantAccess[]> {
    return await db
      .select()
      .from(consultantTenantAccess)
      .where(eq(consultantTenantAccess.consultantUserId, userId));
  }

  async grantConsultantAccess(data: InsertConsultantTenantAccess): Promise<ConsultantTenantAccess> {
    const [grant] = await db
      .insert(consultantTenantAccess)
      .values(data)
      .onConflictDoUpdate({
        target: [consultantTenantAccess.consultantUserId, consultantTenantAccess.tenantId],
        set: {
          grantedBy: data.grantedBy,
          grantedAt: new Date(),
          expiresAt: data.expiresAt,
          notes: data.notes,
        },
      })
      .returning();
    return grant;
  }

  async revokeConsultantAccess(consultantUserId: string, tenantId: string): Promise<void> {
    await db
      .delete(consultantTenantAccess)
      .where(and(
        eq(consultantTenantAccess.consultantUserId, consultantUserId),
        eq(consultantTenantAccess.tenantId, tenantId)
      ));
  }

  async hasConsultantAccess(consultantUserId: string, tenantId: string): Promise<boolean> {
    const [grant] = await db
      .select()
      .from(consultantTenantAccess)
      .where(and(
        eq(consultantTenantAccess.consultantUserId, consultantUserId),
        eq(consultantTenantAccess.tenantId, tenantId)
      ));
    
    if (!grant) return false;
    
    // Check if grant has expired
    if (grant.expiresAt && new Date(grant.expiresAt) < new Date()) {
      return false;
    }
    
    return true;
  }

  async getConsultantsWithAccessToTenant(tenantId: string): Promise<ConsultantTenantAccess[]> {
    return await db
      .select()
      .from(consultantTenantAccess)
      .where(eq(consultantTenantAccess.tenantId, tenantId));
  }

  // Vocabulary methods
  async getSystemVocabulary(): Promise<SystemVocabulary | undefined> {
    const [vocab] = await db.select().from(systemVocabulary);
    return vocab || undefined;
  }

  async upsertSystemVocabulary(terms: VocabularyTerms, updatedBy: string): Promise<SystemVocabulary> {
    const existing = await this.getSystemVocabulary();
    
    if (existing) {
      const [updated] = await db
        .update(systemVocabulary)
        .set({ terms, updatedBy, updatedAt: new Date() })
        .where(eq(systemVocabulary.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(systemVocabulary)
        .values({ terms, updatedBy })
        .returning();
      return created;
    }
  }

  async getEffectiveVocabulary(tenantId: string | null): Promise<VocabularyTerms> {
    // Start with built-in defaults
    let effectiveVocab: VocabularyTerms = { ...defaultVocabulary };
    
    // Apply system-level defaults if they exist
    const systemVocab = await this.getSystemVocabulary();
    if (systemVocab?.terms) {
      effectiveVocab = { ...effectiveVocab, ...systemVocab.terms };
    }
    
    // Apply tenant-level overrides if tenant exists and has overrides
    if (tenantId) {
      const tenant = await this.getTenantById(tenantId);
      if (tenant?.vocabularyOverrides) {
        // Merge each term individually to preserve non-overridden properties
        const overrides = tenant.vocabularyOverrides as Partial<VocabularyTerms>;
        for (const key of Object.keys(overrides) as Array<keyof VocabularyTerms>) {
          if (overrides[key]) {
            effectiveVocab[key] = { ...effectiveVocab[key], ...overrides[key] };
          }
        }
      }
    }
    
    return effectiveVocab;
  }

  // AI Usage tracking methods
  async createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog> {
    const [created] = await db.insert(aiUsageLogs).values(log).returning();
    return created;
  }

  async getAiUsageLogs(tenantId: string, startDate?: Date, endDate?: Date, limit: number = 100): Promise<AiUsageLog[]> {
    let query = db.select().from(aiUsageLogs).where(eq(aiUsageLogs.tenantId, tenantId));
    
    if (startDate && endDate) {
      query = db.select().from(aiUsageLogs).where(
        and(
          eq(aiUsageLogs.tenantId, tenantId),
          sql`${aiUsageLogs.createdAt} >= ${startDate}`,
          sql`${aiUsageLogs.createdAt} <= ${endDate}`
        )
      );
    }
    
    return await query.orderBy(desc(aiUsageLogs.createdAt)).limit(limit);
  }

  async getAiUsageSummary(tenantId: string, periodType: 'daily' | 'monthly', periodStart: Date): Promise<AiUsageSummary | undefined> {
    const [summary] = await db
      .select()
      .from(aiUsageSummaries)
      .where(and(
        eq(aiUsageSummaries.tenantId, tenantId),
        eq(aiUsageSummaries.periodType, periodType),
        eq(aiUsageSummaries.periodStart, periodStart)
      ));
    return summary || undefined;
  }

  async getAiUsageSummaries(tenantId: string, periodType: 'daily' | 'monthly', limit: number = 30): Promise<AiUsageSummary[]> {
    return await db
      .select()
      .from(aiUsageSummaries)
      .where(and(
        eq(aiUsageSummaries.tenantId, tenantId),
        eq(aiUsageSummaries.periodType, periodType)
      ))
      .orderBy(desc(aiUsageSummaries.periodStart))
      .limit(limit);
  }

  async getPlatformAiUsageSummary(periodType: 'daily' | 'monthly', periodStart: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCostMicrodollars: number;
    byTenant: Array<{ tenantId: string; tenantName: string; requests: number; tokens: number; cost: number }>;
    byModel: Record<string, { requests: number; tokens: number; cost: number }>;
    byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
    byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  }> {
    // Calculate period end based on type
    const periodEnd = new Date(periodStart);
    if (periodType === 'daily') {
      periodEnd.setDate(periodEnd.getDate() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Get all logs for the period
    const logs = await db
      .select()
      .from(aiUsageLogs)
      .where(and(
        sql`${aiUsageLogs.createdAt} >= ${periodStart}`,
        sql`${aiUsageLogs.createdAt} < ${periodEnd}`
      ));

    // Aggregate by tenant
    const byTenantMap = new Map<string, { requests: number; tokens: number; cost: number }>();
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byFeature: Record<string, { requests: number; tokens: number; cost: number }> = {};
    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {};
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCostMicrodollars = 0;

    for (const log of logs) {
      totalRequests++;
      totalTokens += log.totalTokens;
      totalCostMicrodollars += log.estimatedCostMicrodollars || 0;

      // By tenant
      if (log.tenantId) {
        const existing = byTenantMap.get(log.tenantId) || { requests: 0, tokens: 0, cost: 0 };
        existing.requests++;
        existing.tokens += log.totalTokens;
        existing.cost += log.estimatedCostMicrodollars || 0;
        byTenantMap.set(log.tenantId, existing);
      }

      // By model
      if (!byModel[log.model]) {
        byModel[log.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      byModel[log.model].requests++;
      byModel[log.model].tokens += log.totalTokens;
      byModel[log.model].cost += log.estimatedCostMicrodollars || 0;

      // By feature
      if (!byFeature[log.feature]) {
        byFeature[log.feature] = { requests: 0, tokens: 0, cost: 0 };
      }
      byFeature[log.feature].requests++;
      byFeature[log.feature].tokens += log.totalTokens;
      byFeature[log.feature].cost += log.estimatedCostMicrodollars || 0;

      // By provider (aggregate from actual log data)
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      byProvider[log.provider].requests++;
      byProvider[log.provider].tokens += log.totalTokens;
      byProvider[log.provider].cost += log.estimatedCostMicrodollars || 0;
    }

    // Get tenant names
    const tenantIds = Array.from(byTenantMap.keys());
    const tenantsData = tenantIds.length > 0 
      ? await db.select().from(tenants).where(inArray(tenants.id, tenantIds))
      : [];
    const tenantNameMap = new Map(tenantsData.map(t => [t.id, t.name]));

    const byTenant = Array.from(byTenantMap.entries()).map(([tenantId, data]) => ({
      tenantId,
      tenantName: tenantNameMap.get(tenantId) || 'Unknown',
      ...data
    }));

    return {
      totalRequests,
      totalTokens,
      totalCostMicrodollars,
      byTenant,
      byModel,
      byFeature,
      byProvider
    };
  }

  // AI Configuration methods
  async getAiConfiguration(): Promise<AiConfiguration | undefined> {
    // There's only one platform-wide AI configuration
    const [config] = await db.select().from(aiConfiguration).limit(1);
    return config;
  }

  async updateAiConfiguration(config: Partial<InsertAiConfiguration>, updatedBy: string): Promise<AiConfiguration> {
    // Check if configuration exists
    const existing = await this.getAiConfiguration();
    
    if (existing) {
      // Update existing
      const [updated] = await db.update(aiConfiguration)
        .set({ 
          ...config, 
          updatedBy,
          updatedAt: new Date() 
        })
        .where(eq(aiConfiguration.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db.insert(aiConfiguration)
        .values({ 
          ...config as InsertAiConfiguration,
          updatedBy 
        })
        .returning();
      return created;
    }
  }

  // Review Snapshots methods
  async getReviewSnapshotsByTenantId(tenantId: string, year?: number, quarter?: number): Promise<ReviewSnapshot[]> {
    const conditions = [eq(reviewSnapshots.tenantId, tenantId)];
    if (year) conditions.push(eq(reviewSnapshots.year, year));
    if (quarter) conditions.push(eq(reviewSnapshots.quarter, quarter));
    return db.select().from(reviewSnapshots)
      .where(and(...conditions))
      .orderBy(desc(reviewSnapshots.snapshotDate));
  }

  async getReviewSnapshotById(id: string): Promise<ReviewSnapshot | undefined> {
    const [snapshot] = await db.select().from(reviewSnapshots).where(eq(reviewSnapshots.id, id));
    return snapshot;
  }

  async createReviewSnapshot(snapshot: InsertReviewSnapshot): Promise<ReviewSnapshot> {
    const [created] = await db.insert(reviewSnapshots).values(snapshot).returning();
    return created;
  }

  async updateReviewSnapshot(id: string, snapshot: Partial<InsertReviewSnapshot>): Promise<ReviewSnapshot> {
    const [updated] = await db.update(reviewSnapshots)
      .set({ ...snapshot, updatedAt: new Date() })
      .where(eq(reviewSnapshots.id, id))
      .returning();
    return updated;
  }

  async deleteReviewSnapshot(id: string): Promise<void> {
    await db.delete(reviewSnapshots).where(eq(reviewSnapshots.id, id));
  }

  // Report Templates methods
  async getReportTemplates(tenantId?: string): Promise<ReportTemplate[]> {
    if (tenantId) {
      return db.select().from(reportTemplates)
        .where(or(eq(reportTemplates.tenantId, tenantId), isNull(reportTemplates.tenantId)))
        .orderBy(desc(reportTemplates.createdAt));
    }
    return db.select().from(reportTemplates).orderBy(desc(reportTemplates.createdAt));
  }

  async getReportTemplateById(id: string): Promise<ReportTemplate | undefined> {
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    return template;
  }

  async createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    const [created] = await db.insert(reportTemplates).values(template).returning();
    return created;
  }

  async updateReportTemplate(id: string, template: Partial<InsertReportTemplate>): Promise<ReportTemplate> {
    const [updated] = await db.update(reportTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(reportTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteReportTemplate(id: string): Promise<void> {
    await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  }

  // Report Instances methods
  async getReportInstances(tenantId: string, year?: number, reportType?: string): Promise<ReportInstance[]> {
    const conditions = [eq(reportInstances.tenantId, tenantId)];
    if (year) conditions.push(eq(reportInstances.year, year));
    if (reportType) conditions.push(eq(reportInstances.reportType, reportType));
    return db.select().from(reportInstances)
      .where(and(...conditions))
      .orderBy(desc(reportInstances.createdAt));
  }

  async getReportInstanceById(id: string): Promise<ReportInstance | undefined> {
    const [instance] = await db.select().from(reportInstances).where(eq(reportInstances.id, id));
    return instance;
  }

  async createReportInstance(instance: InsertReportInstance): Promise<ReportInstance> {
    const [created] = await db.insert(reportInstances).values(instance).returning();
    return created;
  }

  async updateReportInstance(id: string, instance: Partial<ReportInstance>): Promise<ReportInstance> {
    const [updated] = await db.update(reportInstances)
      .set(instance)
      .where(eq(reportInstances.id, id))
      .returning();
    return updated;
  }

  async deleteReportInstance(id: string): Promise<void> {
    await db.delete(reportInstances).where(eq(reportInstances.id, id));
  }

  // Launchpad Session methods
  async getLaunchpadSessions(tenantId: string, userId?: string): Promise<LaunchpadSession[]> {
    const conditions = [eq(launchpadSessions.tenantId, tenantId)];
    if (userId) conditions.push(eq(launchpadSessions.userId, userId));
    return db.select().from(launchpadSessions)
      .where(and(...conditions))
      .orderBy(desc(launchpadSessions.createdAt));
  }

  async getLaunchpadSessionById(id: string): Promise<LaunchpadSession | undefined> {
    const [session] = await db.select().from(launchpadSessions).where(eq(launchpadSessions.id, id));
    return session;
  }

  async createLaunchpadSession(session: InsertLaunchpadSession): Promise<LaunchpadSession> {
    const [created] = await db.insert(launchpadSessions).values(session).returning();
    return created;
  }

  async updateLaunchpadSession(id: string, session: Partial<InsertLaunchpadSession>): Promise<LaunchpadSession> {
    const [updated] = await db.update(launchpadSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(launchpadSessions.id, id))
      .returning();
    return updated;
  }

  async deleteLaunchpadSession(id: string): Promise<void> {
    await db.delete(launchpadSessions).where(eq(launchpadSessions.id, id));
  }

  // ============================================
  // SERVICE PLANS METHODS
  // ============================================

  async getAllServicePlans(): Promise<ServicePlan[]> {
    return db.select().from(servicePlans).orderBy(servicePlans.name);
  }

  async getServicePlanById(id: string): Promise<ServicePlan | undefined> {
    const [plan] = await db.select().from(servicePlans).where(eq(servicePlans.id, id));
    return plan;
  }

  async getServicePlanByName(name: string): Promise<ServicePlan | undefined> {
    const [plan] = await db.select().from(servicePlans).where(eq(servicePlans.name, name));
    return plan;
  }

  async getDefaultServicePlan(): Promise<ServicePlan | undefined> {
    const [plan] = await db.select().from(servicePlans).where(eq(servicePlans.isDefault, true));
    return plan;
  }

  async createServicePlan(plan: InsertServicePlan): Promise<ServicePlan> {
    const [created] = await db.insert(servicePlans).values(plan).returning();
    return created;
  }

  async updateServicePlan(id: string, plan: Partial<InsertServicePlan>): Promise<ServicePlan> {
    const [updated] = await db.update(servicePlans)
      .set(plan)
      .where(eq(servicePlans.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // BLOCKED DOMAINS METHODS
  // ============================================

  async getAllBlockedDomains(): Promise<BlockedDomain[]> {
    return db.select().from(blockedDomains).orderBy(blockedDomains.domain);
  }

  async getBlockedDomain(domain: string): Promise<BlockedDomain | undefined> {
    const [blocked] = await db.select().from(blockedDomains).where(eq(blockedDomains.domain, domain.toLowerCase()));
    return blocked;
  }

  async isDomainBlocked(domain: string): Promise<boolean> {
    const blocked = await this.getBlockedDomain(domain.toLowerCase());
    return !!blocked;
  }

  async blockDomain(data: InsertBlockedDomain): Promise<BlockedDomain> {
    const [created] = await db.insert(blockedDomains).values({
      ...data,
      domain: data.domain.toLowerCase(),
    }).returning();
    return created;
  }

  async unblockDomain(domain: string): Promise<void> {
    await db.delete(blockedDomains).where(eq(blockedDomains.domain, domain.toLowerCase()));
  }

  // ============================================
  // TENANT PLAN MANAGEMENT METHODS
  // ============================================

  async updateTenantPlan(tenantId: string, planId: string, expiresAt?: Date): Promise<Tenant> {
    const plan = await this.getServicePlanById(planId);
    const now = new Date();
    
    let planExpiresAt = expiresAt;
    if (!planExpiresAt && plan?.durationDays) {
      planExpiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    }

    const [updated] = await db.update(tenants)
      .set({
        servicePlanId: planId,
        planStartedAt: now,
        planExpiresAt: planExpiresAt,
        planStatus: 'active',
        planCancelledAt: null,
        planCancelledBy: null,
        planCancelReason: null,
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated;
  }

  async cancelTenantPlan(tenantId: string, reason: string, cancelledBy: string): Promise<Tenant> {
    const [updated] = await db.update(tenants)
      .set({
        planStatus: 'cancelled',
        planCancelledAt: new Date(),
        planCancelledBy: cancelledBy,
        planCancelReason: reason,
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    return updated;
  }

  async getTenantsWithExpiringPlans(daysUntilExpiry: number): Promise<Tenant[]> {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return db.select().from(tenants)
      .where(
        and(
          eq(tenants.planStatus, 'active'),
          sql`${tenants.planExpiresAt} >= ${startOfDay}`,
          sql`${tenants.planExpiresAt} <= ${endOfDay}`
        )
      );
  }

  async getTenantLicenseCounts(tenantId: string): Promise<{
    readWriteCount: number;
    readOnlyCount: number;
    adminCount: number;
    totalUsers: number;
  }> {
    const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
    
    let readWriteCount = 0;
    let readOnlyCount = 0;
    let adminCount = 0;
    
    for (const user of tenantUsers) {
      // Admins count against read-write quota
      if (user.role === 'tenant_admin' || user.role === 'admin') {
        adminCount++;
        readWriteCount++; // Admins always have read-write access
      } else if (user.licenseType === 'read_only') {
        readOnlyCount++;
      } else {
        // Default to read-write for non-admin users
        readWriteCount++;
      }
    }
    
    return {
      readWriteCount,
      readOnlyCount,
      adminCount,
      totalUsers: tenantUsers.length,
    };
  }

  async getTenantLicenseQuota(tenantId: string): Promise<{
    maxReadWriteUsers: number | null;
    maxReadOnlyUsers: number | null;
    currentReadWrite: number;
    currentReadOnly: number;
    availableReadWrite: number | null;
    availableReadOnly: number | null;
  }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    
    // Get the service plan
    let plan: ServicePlan | undefined;
    if (tenant.servicePlanId) {
      plan = await this.getServicePlanById(tenant.servicePlanId);
    }
    
    const counts = await this.getTenantLicenseCounts(tenantId);
    
    const maxReadWriteUsers = plan?.maxReadWriteUsers ?? null;
    const maxReadOnlyUsers = plan?.maxReadOnlyUsers ?? null;
    
    return {
      maxReadWriteUsers,
      maxReadOnlyUsers,
      currentReadWrite: counts.readWriteCount,
      currentReadOnly: counts.readOnlyCount,
      availableReadWrite: maxReadWriteUsers !== null 
        ? Math.max(0, maxReadWriteUsers - counts.readWriteCount) 
        : null,
      availableReadOnly: maxReadOnlyUsers !== null 
        ? Math.max(0, maxReadOnlyUsers - counts.readOnlyCount) 
        : null,
    };
  }

  async canAssignReadWriteLicense(tenantId: string): Promise<boolean> {
    const quota = await this.getTenantLicenseQuota(tenantId);
    // If no limit (null), always allow
    if (quota.availableReadWrite === null) {
      return true;
    }
    // Check if there's at least 1 available slot
    return quota.availableReadWrite > 0;
  }

  async isUserReadOnly(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    // Admins are never read-only
    if (user.role === 'tenant_admin' || user.role === 'admin' || user.role === 'global_admin' || 
        user.role === 'vega_admin' || user.role === 'vega_consultant') {
      return false;
    }
    return user.licenseType === 'read_only';
  }

  async getActiveBanner(): Promise<SystemBanner | undefined> {
    const now = new Date();
    const allBanners = await db.select().from(systemBanners).orderBy(desc(systemBanners.updatedAt));
    
    for (const banner of allBanners) {
      if (banner.status === BANNER_STATUS.ON) {
        return banner;
      }
      if (banner.status === BANNER_STATUS.SCHEDULED) {
        const start = banner.scheduledStart ? new Date(banner.scheduledStart) : null;
        const end = banner.scheduledEnd ? new Date(banner.scheduledEnd) : null;
        const afterStart = !start || now >= start;
        const beforeEnd = !end || now <= end;
        if (afterStart && beforeEnd) {
          return banner;
        }
      }
    }
    return undefined;
  }

  async getAllBanners(): Promise<SystemBanner[]> {
    return db.select().from(systemBanners).orderBy(desc(systemBanners.updatedAt));
  }

  async getBannerById(id: string): Promise<SystemBanner | undefined> {
    const [banner] = await db.select().from(systemBanners).where(eq(systemBanners.id, id));
    return banner || undefined;
  }

  async createBanner(banner: InsertSystemBanner): Promise<SystemBanner> {
    const [created] = await db.insert(systemBanners).values(banner).returning();
    return created;
  }

  async updateBanner(id: string, banner: Partial<InsertSystemBanner>): Promise<SystemBanner> {
    const [updated] = await db.update(systemBanners)
      .set({ ...banner, updatedAt: new Date() })
      .where(eq(systemBanners.id, id))
      .returning();
    return updated;
  }

  async deleteBanner(id: string): Promise<void> {
    await db.delete(systemBanners).where(eq(systemBanners.id, id));
  }

  async getSeoConfig(): Promise<SeoConfig | undefined> {
    const [config] = await db.select().from(seoConfig).limit(1);
    return config || undefined;
  }

  async updateSeoConfig(config: Partial<InsertSeoConfig>, updatedBy?: string): Promise<SeoConfig> {
    const existing = await this.getSeoConfig();
    const updates = { ...config, updatedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) };
    if (existing) {
      const [updated] = await db.update(seoConfig)
        .set(updates)
        .where(eq(seoConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(seoConfig)
        .values({
          title: config.title || "Vega - The Synozur Alliance Company OS",
          description: config.description || "Vega delivers the ultimate Company Operating System experience with AI-powered foundations, strategy, planning, and focus rhythm modules for modern organizations. Designed by former Microsoft Viva product leadership.",
          ogDescription: config.ogDescription || "Vega delivers the ultimate Company Operating System experience. Designed by former Microsoft Viva product leadership.",
          keywords: config.keywords || "company operating system, OKR software, strategy execution, AI-powered OKRs, business alignment, leadership cadence, Synozur, Vega",
          canonicalUrl: config.canonicalUrl || "https://vega.synozur.com",
          ...updates,
        })
        .returning();
      return created;
    }
  }

  async getLandingPageSettings(): Promise<LandingPageSettings | undefined> {
    const [settings] = await db.select().from(landingPageSettings).limit(1);
    return settings || undefined;
  }

  async updateLandingPageSettings(settings: Partial<InsertLandingPageSettings>): Promise<LandingPageSettings> {
    const existing = await this.getLandingPageSettings();
    if (existing) {
      const [updated] = await db.update(landingPageSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(landingPageSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(landingPageSettings)
        .values({ heroMediaType: settings.heroMediaType || 'image', ...settings })
        .returning();
      return created;
    }
  }

  async getCapabilitySection(): Promise<CapabilitySection | undefined> {
    const [settings] = await db.select().from(capabilitySection).limit(1);
    return settings || undefined;
  }

  async updateCapabilitySection(settings: Partial<InsertCapabilitySection>): Promise<CapabilitySection> {
    const existing = await this.getCapabilitySection();
    if (existing) {
      const [updated] = await db.update(capabilitySection)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(capabilitySection.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(capabilitySection)
        .values({ 
          headline: settings.headline || 'Explore Vega Capabilities',
          subHeadline: settings.subHeadline || 'Discover how Vega transforms strategy into weekly action',
          enabled: settings.enabled ?? false,
          ...settings 
        })
        .returning();
      return created;
    }
  }

  async getCapabilityTabs(): Promise<CapabilityTab[]> {
    return db.select().from(capabilityTabs).orderBy(capabilityTabs.sortOrder);
  }

  async getCapabilityTabById(id: string): Promise<CapabilityTab | undefined> {
    const [tab] = await db.select().from(capabilityTabs).where(eq(capabilityTabs.id, id));
    return tab || undefined;
  }

  async createCapabilityTab(tab: InsertCapabilityTab): Promise<CapabilityTab> {
    const existingTabs = await this.getCapabilityTabs();
    const maxSortOrder = existingTabs.length > 0 
      ? Math.max(...existingTabs.map(t => t.sortOrder)) 
      : -1;
    const [created] = await db.insert(capabilityTabs)
      .values({ ...tab, sortOrder: tab.sortOrder ?? maxSortOrder + 1 })
      .returning();
    return created;
  }

  async updateCapabilityTab(id: string, tab: Partial<InsertCapabilityTab>): Promise<CapabilityTab> {
    const [updated] = await db.update(capabilityTabs)
      .set({ ...tab, updatedAt: new Date() })
      .where(eq(capabilityTabs.id, id))
      .returning();
    return updated;
  }

  async deleteCapabilityTab(id: string): Promise<void> {
    await db.delete(capabilityTabs).where(eq(capabilityTabs.id, id));
  }

  async reorderCapabilityTabs(tabOrders: { id: string; sortOrder: number }[]): Promise<void> {
    for (const { id, sortOrder } of tabOrders) {
      await db.update(capabilityTabs)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(capabilityTabs.id, id));
    }
  }

  async recordPageVisit(visit: InsertPageVisit): Promise<PageVisit> {
    const [recorded] = await db.insert(pageVisits).values(visit).returning();
    return recorded;
  }

  async getPageVisitStats(startDate?: Date, endDate?: Date): Promise<{
    totalVisits: number;
    totalSessions: number;
    visitsByPage: { page: string; count: number }[];
    visitsByDay: { date: string; count: number }[];
    visitsByCountry: { country: string; count: number }[];
    visitsByDevice: { device: string; count: number }[];
    visitsByBrowser: { browser: string; count: number }[];
    visitsByReferrer: { referrer: string; count: number }[];
  }> {
    const conditions: any[] = [];
    if (startDate) {
      conditions.push(gte(pageVisits.visitedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(pageVisits.visitedAt, endDate));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allVisits = await db.select().from(pageVisits).where(whereClause);
    const totalVisits = allVisits.length;

    const pageMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const referrerMap = new Map<string, number>();
    const uniqueVisitors = new Set<string>();

    for (const visit of allVisits) {
      pageMap.set(visit.page, (pageMap.get(visit.page) || 0) + 1);
      
      if (visit.visitedAt) {
        // Format date in Pacific Time to avoid timezone misdating
        const dateStr = visit.visitedAt.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
      }
      
      const country = visit.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);

      const device = this.parseDeviceType(visit.userAgent || '');
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);

      const browser = this.parseBrowserName(visit.userAgent || '');
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);

      // Track referrers
      const referrer = this.parseReferrerDomain(visit.referrer || '');
      referrerMap.set(referrer, (referrerMap.get(referrer) || 0) + 1);

      // Track unique sessions by visitorId
      if (visit.visitorId) {
        uniqueVisitors.add(visit.visitorId);
      }
    }

    return {
      totalVisits,
      totalSessions: uniqueVisitors.size,
      visitsByPage: Array.from(pageMap.entries()).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count),
      visitsByDay: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      visitsByCountry: Array.from(countryMap.entries()).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
      visitsByDevice: Array.from(deviceMap.entries()).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count),
      visitsByBrowser: Array.from(browserMap.entries()).map(([browser, count]) => ({ browser, count })).sort((a, b) => b.count - a.count),
      visitsByReferrer: Array.from(referrerMap.entries()).map(([referrer, count]) => ({ referrer, count })).sort((a, b) => b.count - a.count),
    };
  }

  private parseReferrerDomain(referrer: string): string {
    if (!referrer || referrer.trim() === '') return 'Direct';
    try {
      const url = new URL(referrer);
      return url.hostname || 'Direct';
    } catch {
      // If not a valid URL, return as-is or Direct
      return referrer.trim() || 'Direct';
    }
  }

  private parseDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'Mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'Tablet';
    } else if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'Bot';
    }
    return 'Desktop';
  }

  private parseBrowserName(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('edg')) return 'Edge';
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
    if (ua.includes('msie') || ua.includes('trident')) return 'IE';
    return 'Other';
  }

  async getTenantActivityReport(windowDays: number = 30): Promise<{
    tenants: {
      id: string;
      name: string;
      planName: string | null;
      planStatus: string | null;
      planExpiresAt: Date | null;
      selfServiceSignup: boolean | null;
      totalUsers: number;
      activeUsersLast30Days: number;
      elements: {
        hasMission: boolean;
        hasVision: boolean;
        valuesCount: number;
        goalsCount: number;
        strategiesCount: number;
        objectivesCount: number;
        keyResultsCount: number;
        meetingsCount: number;
      };
      lastActivityDate: string | null;
    }[];
    summary: {
      totalTenants: number;
      totalUsers: number;
      activeUsersLast30Days: number;
      inactiveTrialTenants: number;
    };
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    // Fetch all tenants with their service plans
    const allTenants = await db.select({
      id: tenants.id,
      name: tenants.name,
      planStatus: tenants.planStatus,
      planExpiresAt: tenants.planExpiresAt,
      selfServiceSignup: tenants.selfServiceSignup,
      servicePlanId: tenants.servicePlanId,
    }).from(tenants);

    // Fetch all service plans for lookup
    const allPlans = await db.select().from(servicePlans);
    const planMap = new Map(allPlans.map(p => [p.id, p]));

    // Fetch all users grouped by tenant
    const allUsers = await db.select().from(users);
    const usersByTenant = new Map<string, User[]>();
    for (const user of allUsers) {
      if (user.tenantId) {
        const existing = usersByTenant.get(user.tenantId) || [];
        existing.push(user);
        usersByTenant.set(user.tenantId, existing);
      }
    }

    // Fetch all foundations
    const allFoundations = await db.select().from(foundations);
    const foundationByTenant = new Map(allFoundations.map(f => [f.tenantId, f]));

    // Fetch element counts by tenant (excluding soft-deleted)
    const allStrategies = await db.select({ tenantId: strategies.tenantId }).from(strategies).where(isNull(strategies.deletedAt));
    const allObjectives = await db.select({ tenantId: objectives.tenantId }).from(objectives).where(isNull(objectives.deletedAt));
    const allKeyResults = await db.select({ tenantId: keyResults.tenantId }).from(keyResults).where(isNull(keyResults.deletedAt));
    const allMeetings = await db.select({ tenantId: meetings.tenantId }).from(meetings);

    const countByTenant = (items: { tenantId: string }[]) => {
      const map = new Map<string, number>();
      for (const item of items) {
        map.set(item.tenantId, (map.get(item.tenantId) || 0) + 1);
      }
      return map;
    };

    const strategyCounts = countByTenant(allStrategies);
    const objectiveCounts = countByTenant(allObjectives);
    const keyResultCounts = countByTenant(allKeyResults);
    const meetingCounts = countByTenant(allMeetings);

    // Fetch recent activity dates from various tables to identify active users
    // We'll use updatedAt from objectives, keyResults, meetings, checkIns as activity signals
    const recentObjectives = await db.select({
      tenantId: objectives.tenantId,
      updatedAt: objectives.updatedAt,
    }).from(objectives).where(and(gte(objectives.updatedAt, cutoffDate), isNull(objectives.deletedAt)));

    const recentKeyResults = await db.select({
      tenantId: keyResults.tenantId,
      updatedAt: keyResults.updatedAt,
    }).from(keyResults).where(and(gte(keyResults.updatedAt, cutoffDate), isNull(keyResults.deletedAt)));

    const recentMeetings = await db.select({
      tenantId: meetings.tenantId,
      updatedAt: meetings.updatedAt,
    }).from(meetings).where(gte(meetings.updatedAt, cutoffDate));

    const recentCheckIns = await db.select({
      tenantId: checkIns.tenantId,
      createdAt: checkIns.createdAt,
    }).from(checkIns).where(gte(checkIns.createdAt, cutoffDate));

    // Count active tenants (those with any recent activity)
    const activeTenants = new Set<string>();
    const lastActivityByTenant = new Map<string, Date>();

    const updateLastActivity = (tenantId: string, date: Date | null) => {
      if (!date) return;
      activeTenants.add(tenantId);
      const existing = lastActivityByTenant.get(tenantId);
      if (!existing || date > existing) {
        lastActivityByTenant.set(tenantId, date);
      }
    };

    for (const obj of recentObjectives) { updateLastActivity(obj.tenantId, obj.updatedAt); }
    for (const kr of recentKeyResults) { updateLastActivity(kr.tenantId, kr.updatedAt); }
    for (const mtg of recentMeetings) { updateLastActivity(mtg.tenantId, mtg.updatedAt); }
    for (const ci of recentCheckIns) { updateLastActivity(ci.tenantId, ci.createdAt); }

    // Build result
    const tenantResults = allTenants.map(tenant => {
      const plan = tenant.servicePlanId ? planMap.get(tenant.servicePlanId) : null;
      const foundation = foundationByTenant.get(tenant.id);
      const tenantUsers = usersByTenant.get(tenant.id) || [];
      const isActive = activeTenants.has(tenant.id);
      const lastActivity = lastActivityByTenant.get(tenant.id);

      // Count values and goals from foundation
      const values = foundation?.values as any[] | null;
      const goals = foundation?.annualGoals as any[] | null;

      return {
        id: tenant.id,
        name: tenant.name,
        planName: plan?.displayName || null,
        planStatus: tenant.planStatus,
        planExpiresAt: tenant.planExpiresAt,
        selfServiceSignup: tenant.selfServiceSignup,
        totalUsers: tenantUsers.length,
        activeUsersLast30Days: isActive ? tenantUsers.length : 0, // Simplified: if tenant active, count all users
        elements: {
          hasMission: !!foundation?.mission,
          hasVision: !!foundation?.vision,
          valuesCount: Array.isArray(values) ? values.length : 0,
          goalsCount: Array.isArray(goals) ? goals.length : 0,
          strategiesCount: strategyCounts.get(tenant.id) || 0,
          objectivesCount: objectiveCounts.get(tenant.id) || 0,
          keyResultsCount: keyResultCounts.get(tenant.id) || 0,
          meetingsCount: meetingCounts.get(tenant.id) || 0,
        },
        lastActivityDate: lastActivity 
          ? lastActivity.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
          : null,
      };
    });

    // Sort by last activity (most recent first), then by name
    tenantResults.sort((a, b) => {
      if (a.lastActivityDate && b.lastActivityDate) {
        return b.lastActivityDate.localeCompare(a.lastActivityDate);
      }
      if (a.lastActivityDate) return -1;
      if (b.lastActivityDate) return 1;
      return a.name.localeCompare(b.name);
    });

    // Count inactive trial tenants (self-service signups with no activity)
    const inactiveTrialTenants = tenantResults.filter(t => 
      t.selfServiceSignup && !activeTenants.has(t.id)
    ).length;

    return {
      tenants: tenantResults,
      summary: {
        totalTenants: allTenants.length,
        totalUsers: allUsers.filter(u => u.tenantId).length,
        activeUsersLast30Days: tenantResults.reduce((sum, t) => sum + t.activeUsersLast30Days, 0),
        inactiveTrialTenants,
      },
    };
  }

  // ============================================
  // MCP API Keys methods
  // ============================================

  async getMcpApiKeysByTenantId(tenantId: string): Promise<McpApiKey[]> {
    return await db.select().from(mcpApiKeys)
      .where(eq(mcpApiKeys.tenantId, tenantId))
      .orderBy(desc(mcpApiKeys.createdAt));
  }

  async getMcpApiKeysByUserId(userId: string): Promise<McpApiKey[]> {
    return await db.select().from(mcpApiKeys)
      .where(eq(mcpApiKeys.userId, userId))
      .orderBy(desc(mcpApiKeys.createdAt));
  }

  async getMcpApiKeyById(id: string): Promise<McpApiKey | undefined> {
    const [key] = await db.select().from(mcpApiKeys).where(eq(mcpApiKeys.id, id));
    return key || undefined;
  }

  async getMcpApiKeyByHash(keyHash: string): Promise<McpApiKey | undefined> {
    const [key] = await db.select().from(mcpApiKeys).where(eq(mcpApiKeys.keyHash, keyHash));
    return key || undefined;
  }

  async createMcpApiKey(key: InsertMcpApiKey): Promise<McpApiKey> {
    const [created] = await db.insert(mcpApiKeys).values(key).returning();
    return created;
  }

  async revokeMcpApiKey(id: string, revokedBy: string): Promise<void> {
    await db.update(mcpApiKeys)
      .set({ 
        status: 'revoked', 
        revokedAt: new Date(), 
        revokedBy 
      })
      .where(eq(mcpApiKeys.id, id));
  }

  async updateMcpApiKeyLastUsed(id: string): Promise<void> {
    await db.update(mcpApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(mcpApiKeys.id, id));
  }

  async updateMcpApiKey(id: string, updates: Partial<Pick<McpApiKey, 'allowedIps' | 'name' | 'scopes'>>): Promise<McpApiKey> {
    const [updated] = await db.update(mcpApiKeys)
      .set(updates)
      .where(eq(mcpApiKeys.id, id))
      .returning();
    return updated;
  }

  async markKeyForRotation(keyId: string, gracePeriodEnds: Date): Promise<void> {
    await db.update(mcpApiKeys)
      .set({ rotationGracePeriodEnds: gracePeriodEnds })
      .where(eq(mcpApiKeys.id, keyId));
  }

  // ============================================
  // MCP Audit Logs methods
  // ============================================

  async createMcpAuditLog(log: InsertMcpAuditLog): Promise<McpAuditLog> {
    const [created] = await db.insert(mcpAuditLogs).values(log).returning();
    return created;
  }

  async getMcpAuditLogs(tenantId: string, limit: number = 100): Promise<McpAuditLog[]> {
    return await db.select().from(mcpAuditLogs)
      .where(eq(mcpAuditLogs.tenantId, tenantId))
      .orderBy(desc(mcpAuditLogs.createdAt))
      .limit(limit);
  }

  // ============================================
  // Galaxy Portal methods
  // ============================================

  async getTenantByGalaxyClientId(galaxyClientId: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.galaxyClientId, galaxyClientId));
    return tenant || undefined;
  }

  async getUserByGalaxyUserId(galaxyUserId: string, tenantId?: string): Promise<User | undefined> {
    if (tenantId) {
      const [user] = await db.select().from(users).where(
        and(eq(users.galaxyUserId, galaxyUserId), eq(users.tenantId, tenantId))
      );
      return user || undefined;
    }
    const [user] = await db.select().from(users).where(eq(users.galaxyUserId, galaxyUserId));
    return user || undefined;
  }

  async createPortalAuditLog(log: InsertPortalAuditLog): Promise<PortalAuditLog> {
    const [created] = await db.insert(portalAuditLogs).values(log).returning();
    return created;
  }

  async getPortalAuthCount(tenantId: string, sinceDate: Date): Promise<number> {
    const rows = await db
      .selectDistinct({ userId: portalAuditLogs.userId })
      .from(portalAuditLogs)
      .where(and(
        eq(portalAuditLogs.tenantId, tenantId),
        gte(portalAuditLogs.createdAt, sinceDate),
        isNotNull(portalAuditLogs.userId),
      ));
    return rows.length;
  }

  async getPortalAuditLogs(
    tenantId: string,
    filters?: { startDate?: Date; endDate?: Date; statusCode?: number; statusClass?: '2xx' | '3xx' | '4xx' | '5xx'; galaxyUserId?: string; userId?: string; limit?: number },
  ): Promise<(PortalAuditLog & { userEmail?: string | null; userName?: string | null })[]> {
    const conditions: SQL[] = [eq(portalAuditLogs.tenantId, tenantId)];
    if (filters?.startDate) conditions.push(gte(portalAuditLogs.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(portalAuditLogs.createdAt, filters.endDate));
    if (filters?.statusCode !== undefined) {
      conditions.push(eq(portalAuditLogs.statusCode, filters.statusCode));
    } else if (filters?.statusClass) {
      const min = parseInt(filters.statusClass[0], 10) * 100;
      conditions.push(gte(portalAuditLogs.statusCode, min));
      conditions.push(lte(portalAuditLogs.statusCode, min + 99));
    }
    if (filters?.galaxyUserId) {
      conditions.push(eq(portalAuditLogs.galaxyUserId, filters.galaxyUserId));
    }
    if (filters?.userId) {
      conditions.push(eq(portalAuditLogs.userId, filters.userId));
    }
    const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 1000);

    const rows = await db
      .select({
        log: portalAuditLogs,
        userEmail: users.email,
        userName: users.name,
      })
      .from(portalAuditLogs)
      .leftJoin(users, eq(users.id, portalAuditLogs.userId))
      .where(and(...conditions))
      .orderBy(desc(portalAuditLogs.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r.log, userEmail: r.userEmail, userName: r.userName }));
  }

  // ============================================
  // Admin users methods
  // ============================================

  async getVegaAdminUsers(): Promise<User[]> {
    return await db.select().from(users)
      .where(
        or(eq(users.role, 'vega_admin'), eq(users.role, 'vega_consultant'))
      )
      .orderBy(users.email);
  }

  // ============================================
  // Scheduled Jobs methods
  // ============================================

  async getScheduledJobs(tenantId?: string | null): Promise<ScheduledJob[]> {
    if (tenantId === null) {
      return await db.select().from(scheduledJobs)
        .where(isNull(scheduledJobs.tenantId))
        .orderBy(scheduledJobs.category, scheduledJobs.displayName);
    } else if (tenantId) {
      return await db.select().from(scheduledJobs)
        .where(or(
          eq(scheduledJobs.tenantId, tenantId),
          isNull(scheduledJobs.tenantId)
        ))
        .orderBy(scheduledJobs.category, scheduledJobs.displayName);
    }
    return await db.select().from(scheduledJobs)
      .orderBy(scheduledJobs.category, scheduledJobs.displayName);
  }

  async getScheduledJobById(id: string): Promise<ScheduledJob | undefined> {
    const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id));
    return job || undefined;
  }

  async getScheduledJobByName(name: string): Promise<ScheduledJob | undefined> {
    const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.name, name));
    return job || undefined;
  }

  async createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob> {
    const [created] = await db.insert(scheduledJobs).values(job).returning();
    return created;
  }

  async updateScheduledJob(id: string, updates: Partial<InsertScheduledJob>): Promise<ScheduledJob> {
    const [updated] = await db.update(scheduledJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scheduledJobs.id, id))
      .returning();
    return updated;
  }

  async updateScheduledJobStatus(id: string, status: string): Promise<void> {
    await db.update(scheduledJobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(scheduledJobs.id, id));
  }

  async updateScheduledJobLastRun(id: string, lastRunAt: Date, nextRunAt?: Date): Promise<void> {
    await db.update(scheduledJobs)
      .set({ lastRunAt, nextRunAt, updatedAt: new Date() })
      .where(eq(scheduledJobs.id, id));
  }

  async deleteScheduledJob(id: string): Promise<void> {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id));
  }

  // ============================================
  // Job Runs methods
  // ============================================

  async getJobRuns(jobId?: string, limit: number = 50): Promise<JobRun[]> {
    if (jobId) {
      return await db.select().from(jobRuns)
        .where(eq(jobRuns.jobId, jobId))
        .orderBy(desc(jobRuns.startedAt))
        .limit(limit);
    }
    return await db.select().from(jobRuns)
      .orderBy(desc(jobRuns.startedAt))
      .limit(limit);
  }

  async getJobRunById(id: string): Promise<JobRun | undefined> {
    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, id));
    return run || undefined;
  }

  async getRecentJobRuns(limit: number = 100): Promise<JobRun[]> {
    return await db.select().from(jobRuns)
      .orderBy(desc(jobRuns.startedAt))
      .limit(limit);
  }

  async createJobRun(run: InsertJobRun): Promise<JobRun> {
    const [created] = await db.insert(jobRuns).values(run).returning();
    return created;
  }

  async updateJobRun(id: string, updates: Partial<JobRun>): Promise<JobRun> {
    const [updated] = await db.update(jobRuns)
      .set(updates)
      .where(eq(jobRuns.id, id))
      .returning();
    return updated;
  }

  async completeJobRun(
    id: string, 
    status: string, 
    summary?: string, 
    details?: any, 
    errorMessage?: string, 
    errorStack?: string,
    resultSummary?: any
  ): Promise<JobRun> {
    const run = await this.getJobRunById(id);
    const now = new Date();
    const durationMs = run ? now.getTime() - new Date(run.startedAt).getTime() : 0;
    
    const [updated] = await db.update(jobRuns)
      .set({ 
        status, 
        completedAt: now, 
        durationMs,
        summary,
        details,
        errorMessage,
        errorStack,
        resultSummary
      })
      .where(eq(jobRuns.id, id))
      .returning();
    return updated;
  }

  async killJobRun(id: string, killedByUserId: string): Promise<JobRun> {
    const run = await this.getJobRunById(id);
    const now = new Date();
    const durationMs = run ? now.getTime() - new Date(run.startedAt).getTime() : 0;
    
    const [updated] = await db.update(jobRuns)
      .set({ 
        status: JOB_RUN_STATUS.KILLED,
        completedAt: now, 
        durationMs,
        killedByUserId,
        killedAt: now,
        summary: 'Job run was manually killed by admin'
      })
      .where(eq(jobRuns.id, id))
      .returning();
    return updated;
  }

  async getStuckJobRuns(thresholdMinutes: number = 30): Promise<JobRun[]> {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    
    return await db.select().from(jobRuns)
      .where(
        and(
          eq(jobRuns.status, JOB_RUN_STATUS.RUNNING),
          lte(jobRuns.startedAt, threshold)
        )
      )
      .orderBy(desc(jobRuns.startedAt));
  }

  async getSupportTicketsByTenantId(tenantId: string, status?: string): Promise<SupportTicket[]> {
    const conditions = [eq(supportTickets.tenantId, tenantId)];
    if (status) conditions.push(eq(supportTickets.status, status));
    return await db.select().from(supportTickets)
      .where(and(...conditions))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketsByUserId(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllSupportTickets(filters?: { status?: string; priority?: string; category?: string; tenantId?: string; assignedTo?: string }): Promise<SupportTicket[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(supportTickets.status, filters.status));
    if (filters?.priority) conditions.push(eq(supportTickets.priority, filters.priority));
    if (filters?.category) conditions.push(eq(supportTickets.category, filters.category));
    if (filters?.tenantId) conditions.push(eq(supportTickets.tenantId, filters.tenantId));
    if (filters?.assignedTo) conditions.push(eq(supportTickets.assignedTo, filters.assignedTo));
    
    const query = conditions.length > 0
      ? db.select().from(supportTickets).where(and(...conditions))
      : db.select().from(supportTickets);
    
    return await query.orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicketById(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketNumber = await this.getNextTicketNumber();
    const [created] = await db.insert(supportTickets).values({ ...ticket, ticketNumber }).returning();
    return created;
  }

  async updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const [updated] = await db.update(supportTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async getNextTicketNumber(): Promise<number> {
    const result = await db.select({ maxNum: sql<number>`COALESCE(MAX(${supportTickets.ticketNumber}), 0)` })
      .from(supportTickets);
    return (result[0]?.maxNum || 0) + 1;
  }

  async getSupportTicketReplies(ticketId: string, includeInternal: boolean = false): Promise<SupportTicketReply[]> {
    const conditions = [eq(supportTicketReplies.ticketId, ticketId)];
    if (!includeInternal) {
      conditions.push(eq(supportTicketReplies.isInternal, false));
    }
    return await db.select().from(supportTicketReplies)
      .where(and(...conditions))
      .orderBy(supportTicketReplies.createdAt);
  }

  async createSupportTicketReply(reply: InsertSupportTicketReply): Promise<SupportTicketReply> {
    const [created] = await db.insert(supportTicketReplies).values(reply).returning();
    await db.update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, reply.ticketId));
    return created;
  }

  async getOauthClientsByTenantId(tenantId: string): Promise<OauthClient[]> {
    return await db.select().from(oauthClients)
      .where(eq(oauthClients.tenantId, tenantId))
      .orderBy(desc(oauthClients.createdAt));
  }

  async getOauthClientByClientId(clientId: string): Promise<OauthClient | undefined> {
    const [client] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId));
    return client;
  }

  async getOauthClientById(id: string): Promise<OauthClient | undefined> {
    const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, id));
    return client;
  }

  async createOauthClient(client: InsertOauthClient): Promise<OauthClient> {
    const [created] = await db.insert(oauthClients).values(client).returning();
    return created;
  }

  async updateOauthClient(id: string, updates: Partial<Pick<OauthClient, 'name' | 'redirectUris' | 'scopes' | 'status'>>): Promise<OauthClient> {
    const [updated] = await db.update(oauthClients).set(updates).where(eq(oauthClients.id, id)).returning();
    return updated;
  }

  async deleteOauthClient(id: string): Promise<void> {
    await db.delete(oauthClients).where(eq(oauthClients.id, id));
  }

  async createOauthAuthorizationCode(code: Omit<OauthAuthorizationCode, 'id' | 'createdAt'>): Promise<OauthAuthorizationCode> {
    const [created] = await db.insert(oauthAuthorizationCodes).values(code).returning();
    return created;
  }

  async getOauthAuthorizationCode(code: string): Promise<OauthAuthorizationCode | undefined> {
    const [found] = await db.select().from(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.code, code));
    return found;
  }

  async markOauthAuthorizationCodeUsed(id: string): Promise<void> {
    await db.update(oauthAuthorizationCodes).set({ used: true }).where(eq(oauthAuthorizationCodes.id, id));
  }

  async createOauthRefreshToken(token: Omit<OauthRefreshToken, 'id' | 'createdAt'>): Promise<OauthRefreshToken> {
    const [created] = await db.insert(oauthRefreshTokens).values(token).returning();
    return created;
  }

  async getOauthRefreshToken(token: string): Promise<OauthRefreshToken | undefined> {
    const [found] = await db.select().from(oauthRefreshTokens).where(eq(oauthRefreshTokens.token, token));
    return found;
  }

  async revokeOauthRefreshToken(id: string): Promise<void> {
    await db.update(oauthRefreshTokens).set({ revoked: true }).where(eq(oauthRefreshTokens.id, id));
  }

  async revokeOauthRefreshTokensByClientAndUser(clientId: string, userId: string): Promise<void> {
    await db.update(oauthRefreshTokens)
      .set({ revoked: true })
      .where(and(eq(oauthRefreshTokens.clientId, clientId), eq(oauthRefreshTokens.userId, userId)));
  }

  // ============================================================================
  // Trash / Soft-delete methods
  // ============================================================================

  async getTrashItemsByTenantId(tenantId: string): Promise<TrashListing> {
    const trashedObjectives = await db.select().from(objectives).where(
      and(eq(objectives.tenantId, tenantId), isNotNull(objectives.deletedAt))
    );
    const trashedStrategies = await db.select().from(strategies).where(
      and(eq(strategies.tenantId, tenantId), isNotNull(strategies.deletedAt))
    );
    const trashedBigRocks = await db.select().from(bigRocks).where(
      and(eq(bigRocks.tenantId, tenantId), isNotNull(bigRocks.deletedAt))
    );

    // Key results don't have tenantId directly - join through objectives
    const tenantObjectiveIds = await db
      .select({ id: objectives.id })
      .from(objectives)
      .where(eq(objectives.tenantId, tenantId));
    const objectiveIds = tenantObjectiveIds.map(o => o.id);
    const trashedKeyResults = objectiveIds.length > 0
      ? await db.select().from(keyResults).where(
          and(inArray(keyResults.objectiveId, objectiveIds), isNotNull(keyResults.deletedAt))
        )
      : [];

    // Ambitions live inside foundation JSONB array
    const [foundation] = await db.select().from(foundations).where(eq(foundations.tenantId, tenantId));
    const trashedAmbitions: (Ambition & { tenantId: string })[] = [];
    if (foundation && Array.isArray(foundation.ambitions)) {
      for (const a of foundation.ambitions as Ambition[]) {
        if (a.deletedAt) {
          trashedAmbitions.push({ ...a, tenantId });
        }
      }
    }

    // ------------- Enrichment: deletedBy user info + parent context -------------
    const collectIds = (arr: Array<{ deletedBy?: string | null }>) =>
      arr.map(i => i.deletedBy).filter((v): v is string => !!v);
    const deletedByIds = Array.from(new Set([
      ...collectIds(trashedObjectives),
      ...collectIds(trashedKeyResults),
      ...collectIds(trashedBigRocks),
      ...collectIds(trashedStrategies),
      ...collectIds(trashedAmbitions as Array<{ deletedBy?: string | null }>),
    ]));

    const userMap = new Map<string, { name: string | null; email: string | null }>();
    if (deletedByIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, deletedByIds));
      for (const u of userRows) {
        userMap.set(u.id, { name: u.name ?? null, email: u.email ?? null });
      }
    }

    // Parent objective titles (for objective parent, keyResult parent, bigRock parent)
    const parentObjectiveIds = Array.from(new Set([
      ...trashedObjectives.map(o => o.parentId).filter((v): v is string => !!v),
      ...trashedKeyResults.map(kr => kr.objectiveId).filter((v): v is string => !!v),
      ...trashedBigRocks.map(br => br.objectiveId).filter((v): v is string => !!v),
    ]));
    const parentObjMap = new Map<string, string>();
    if (parentObjectiveIds.length > 0) {
      const parentRows = await db
        .select({ id: objectives.id, title: objectives.title })
        .from(objectives)
        .where(inArray(objectives.id, parentObjectiveIds));
      for (const o of parentRows) parentObjMap.set(o.id, o.title);
    }

    // For big rocks linked to a key result instead of an objective
    const parentKrIds = Array.from(new Set(
      trashedBigRocks.map(br => br.keyResultId).filter((v): v is string => !!v)
    ));
    const parentKrMap = new Map<string, string>();
    if (parentKrIds.length > 0) {
      const krRows = await db
        .select({ id: keyResults.id, title: keyResults.title })
        .from(keyResults)
        .where(inArray(keyResults.id, parentKrIds));
      for (const k of krRows) parentKrMap.set(k.id, k.title);
    }

    const enrichDeletedBy = (deletedBy?: string | null): Pick<TrashEnrichment, 'deletedByName' | 'deletedByEmail'> => {
      const u = deletedBy ? userMap.get(deletedBy) : undefined;
      return { deletedByName: u?.name ?? null, deletedByEmail: u?.email ?? null };
    };

    const objectivesOut: (Objective & TrashEnrichment)[] = trashedObjectives.map(o => ({
      ...o,
      ...enrichDeletedBy(o.deletedBy),
      parentContext: o.parentId
        ? { type: 'objective' as const, id: o.parentId, title: parentObjMap.get(o.parentId) ?? '' }
        : null,
    }));
    const keyResultsOut: (KeyResult & TrashEnrichment)[] = trashedKeyResults.map(kr => ({
      ...kr,
      ...enrichDeletedBy(kr.deletedBy),
      parentContext: kr.objectiveId
        ? { type: 'objective' as const, id: kr.objectiveId, title: parentObjMap.get(kr.objectiveId) ?? '' }
        : null,
    }));
    const bigRocksOut: (BigRock & TrashEnrichment)[] = trashedBigRocks.map(br => ({
      ...br,
      ...enrichDeletedBy(br.deletedBy),
      parentContext: br.objectiveId
        ? { type: 'objective' as const, id: br.objectiveId, title: parentObjMap.get(br.objectiveId) ?? '' }
        : br.keyResultId
          ? { type: 'keyResult' as const, id: br.keyResultId, title: parentKrMap.get(br.keyResultId) ?? '' }
          : null,
    }));
    const strategiesOut: (Strategy & TrashEnrichment)[] = trashedStrategies.map(s => ({
      ...s,
      ...enrichDeletedBy(s.deletedBy),
      parentContext: null,
    }));
    const ambitionsOut: (Ambition & { tenantId: string } & TrashEnrichment)[] = trashedAmbitions.map(a => ({
      ...a,
      ...enrichDeletedBy(a.deletedBy),
      parentContext: null,
    }));

    return {
      objectives: objectivesOut,
      keyResults: keyResultsOut,
      bigRocks: bigRocksOut,
      strategies: strategiesOut,
      ambitions: ambitionsOut,
    };
  }

  async softDeleteAmbition(tenantId: string, ambitionId: string, userId?: string): Promise<void> {
    const [foundation] = await db.select().from(foundations).where(eq(foundations.tenantId, tenantId));
    if (!foundation || !Array.isArray(foundation.ambitions)) return;

    const now = new Date().toISOString();
    const updated = (foundation.ambitions as Ambition[]).map(a => {
      if (a.id === ambitionId && !a.deletedAt) {
        return { ...a, deletedAt: now, deletedBy: userId };
      }
      return a;
    });

    await db.update(foundations)
      .set({ ambitions: updated as any })
      .where(eq(foundations.tenantId, tenantId));
  }

  async restoreAmbition(tenantId: string, ambitionId: string): Promise<Ambition | undefined> {
    const [foundation] = await db.select().from(foundations).where(eq(foundations.tenantId, tenantId));
    if (!foundation || !Array.isArray(foundation.ambitions)) return undefined;

    let restored: Ambition | undefined;
    const updated = (foundation.ambitions as Ambition[]).map(a => {
      if (a.id === ambitionId && a.deletedAt) {
        const { deletedAt, deletedBy, ...rest } = a;
        restored = rest as Ambition;
        return rest as Ambition;
      }
      return a;
    });

    if (!restored) return undefined;

    await db.update(foundations)
      .set({ ambitions: updated as any })
      .where(eq(foundations.tenantId, tenantId));
    return restored;
  }

  async purgeOldDeletedItems(olderThanDays: number): Promise<{
    objectives: number;
    keyResults: number;
    bigRocks: number;
    bigRockTasks: number;
    strategies: number;
    ambitions: number;
  }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Hard-delete relational items where deletedAt < cutoff
    // Order: tasks before big rocks (FK on bigRockId cascades, but explicit is safer).
    const deletedTasks = await db.delete(bigRockTasks)
      .where(and(isNotNull(bigRockTasks.deletedAt), lte(bigRockTasks.deletedAt, cutoff)))
      .returning({ id: bigRockTasks.id });
    const deletedBigRocks = await db.delete(bigRocks)
      .where(and(isNotNull(bigRocks.deletedAt), lte(bigRocks.deletedAt, cutoff)))
      .returning({ id: bigRocks.id });
    const deletedKeyResults = await db.delete(keyResults)
      .where(and(isNotNull(keyResults.deletedAt), lte(keyResults.deletedAt, cutoff)))
      .returning({ id: keyResults.id });
    const deletedObjectives = await db.delete(objectives)
      .where(and(isNotNull(objectives.deletedAt), lte(objectives.deletedAt, cutoff)))
      .returning({ id: objectives.id });
    const deletedStrategies = await db.delete(strategies)
      .where(and(isNotNull(strategies.deletedAt), lte(strategies.deletedAt, cutoff)))
      .returning({ id: strategies.id });

    // Ambitions: walk foundations and remove items where deletedAt < cutoff
    let purgedAmbitions = 0;
    const allFoundations = await db.select().from(foundations);
    for (const f of allFoundations) {
      if (!Array.isArray(f.ambitions) || f.ambitions.length === 0) continue;
      const before = f.ambitions.length;
      const kept = (f.ambitions as Ambition[]).filter(a => {
        if (!a.deletedAt) return true;
        return new Date(a.deletedAt).getTime() > cutoff.getTime();
      });
      if (kept.length !== before) {
        purgedAmbitions += before - kept.length;
        await db.update(foundations)
          .set({ ambitions: kept as any })
          .where(eq(foundations.tenantId, f.tenantId));
      }
    }

    return {
      objectives: deletedObjectives.length,
      keyResults: deletedKeyResults.length,
      bigRocks: deletedBigRocks.length,
      bigRockTasks: deletedTasks.length,
      strategies: deletedStrategies.length,
      ambitions: purgedAmbitions,
    };
  }

  async getNotificationsByUserId(userId: string, options?: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    if (options?.unreadOnly) conditions.push(eq(notifications.isRead, false));
    if (options?.type) conditions.push(eq(notifications.type, options.type));
    return await db.select().from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ c: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.c || 0);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  // Alias used by reassignment routes (kept for compatibility with multiple callers)
  async getNotificationsForUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<Notification[]> {
    return this.getNotificationsByUserId(userId, options);
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });
    return result.length;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    return await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
  }

  async getNotificationPreference(userId: string, eventType: string): Promise<NotificationPreference | undefined> {
    const [pref] = await db.select().from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.eventType, eventType)));
    return pref;
  }

  async upsertNotificationPreference(pref: InsertNotificationPreference): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreference(pref.userId, pref.eventType);
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({
          inAppEnabled: pref.inAppEnabled ?? existing.inAppEnabled,
          emailEnabled: pref.emailEnabled ?? existing.emailEnabled,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(notificationPreferences).values(pref).returning();
    return created;
  }

  // ============================================
  // ENTITY COMMENTS
  // ============================================

  async getCommentsByEntity(tenantId: string, entityType: string, entityId: string): Promise<EntityComment[]> {
    return await db.select().from(entityComments)
      .where(and(
        eq(entityComments.tenantId, tenantId),
        eq(entityComments.entityType, entityType),
        eq(entityComments.entityId, entityId),
      ))
      .orderBy(asc(entityComments.createdAt));
  }

  async getCommentById(id: string): Promise<EntityComment | undefined> {
    const [c] = await db.select().from(entityComments).where(eq(entityComments.id, id));
    return c;
  }

  async getCommentCountsByEntities(tenantId: string, entityType: string, entityIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (entityIds.length === 0) return result;
    const rows = await db.select({
      entityId: entityComments.entityId,
      c: count(),
    }).from(entityComments)
      .where(and(
        eq(entityComments.tenantId, tenantId),
        eq(entityComments.entityType, entityType),
        inArray(entityComments.entityId, entityIds),
        isNull(entityComments.deletedAt),
      ))
      .groupBy(entityComments.entityId);
    for (const r of rows) {
      result.set(r.entityId, Number(r.c));
    }
    return result;
  }

  async createComment(comment: InsertEntityComment): Promise<EntityComment> {
    const [created] = await db.insert(entityComments).values(comment).returning();
    return created;
  }

  async updateComment(id: string, body: string, mentionedUserIds: string[]): Promise<EntityComment | undefined> {
    const [updated] = await db.update(entityComments)
      .set({ body, mentionedUserIds, editedAt: new Date() })
      .where(eq(entityComments.id, id))
      .returning();
    return updated;
  }

  async softDeleteComment(id: string): Promise<EntityComment | undefined> {
    const [updated] = await db.update(entityComments)
      .set({ deletedAt: new Date() })
      .where(eq(entityComments.id, id))
      .returning();
    return updated;
  }

  async searchAcrossEntities(
    tenantId: string,
    query: string,
    options?: { types?: string[]; limit?: number; userId?: string; isSupportAdmin?: boolean; canSeeGroundingDocs?: boolean }
  ) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const wantedTypes = new Set(
      options?.types && options.types.length > 0
        ? options.types
        : ['objective', 'key_result', 'big_rock', 'strategy', 'ambition', 'team', 'meeting', 'ticket', 'document']
    );
    const perTypeLimit = Math.min(options?.limit ?? 8, 15);
    const totalLimit = Math.min((options?.limit ?? 8) * 4, 80);
    const pattern = `%${trimmed.replace(/[%_]/g, '\\$&')}%`;
    const lower = trimmed.toLowerCase();

    type Result = {
      type: 'objective' | 'key_result' | 'big_rock' | 'strategy' | 'ambition' | 'team' | 'meeting' | 'ticket' | 'document';
      id: string;
      title: string;
      snippet?: string;
      parentContext?: string;
      url: string;
      score: number;
    };

    const scoreFor = (title: string, body: string | null | undefined): number => {
      const t = (title || '').toLowerCase();
      if (t === lower) return 110;
      if (t.startsWith(lower)) return 100;
      if (t.includes(lower)) return 60;
      const b = (body || '').toLowerCase();
      if (b.includes(lower)) return 25;
      return 10;
    };

    const buildSnippet = (text: string | null | undefined): string | undefined => {
      if (!text) return undefined;
      const idx = text.toLowerCase().indexOf(lower);
      if (idx < 0) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + lower.length + 60);
      const prefix = start > 0 ? '…' : '';
      const suffix = end < text.length ? '…' : '';
      return `${prefix}${text.slice(start, end)}${suffix}`;
    };

    const tasks: Promise<Result[]>[] = [];

    if (wantedTypes.has('objective')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: objectives.id,
            title: objectives.title,
            description: objectives.description,
            quarter: objectives.quarter,
            year: objectives.year,
            level: objectives.level,
            teamId: objectives.teamId,
          })
          .from(objectives)
          .where(and(
            eq(objectives.tenantId, tenantId),
            or(ilike(objectives.title, pattern), ilike(objectives.description, pattern))
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => {
          const period = r.quarter ? `Q${r.quarter} ${r.year ?? ''}`.trim() : r.year ? `FY ${r.year}` : '';
          const ctxParts = [period, r.level ? r.level.charAt(0).toUpperCase() + r.level.slice(1) : ''].filter(Boolean);
          return {
            type: 'objective' as const,
            id: r.id,
            title: r.title,
            snippet: buildSnippet(r.description),
            parentContext: ctxParts.join(' · ') || undefined,
            url: `/planning?focus=${r.id}`,
            score: scoreFor(r.title, r.description),
          };
        });
      })().catch((e) => { console.error('[search] objectives failed:', e); return []; }));
    }

    if (wantedTypes.has('key_result')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: keyResults.id,
            title: keyResults.title,
            description: keyResults.description,
            objectiveId: keyResults.objectiveId,
            objectiveTitle: objectives.title,
            quarter: objectives.quarter,
            year: objectives.year,
          })
          .from(keyResults)
          .leftJoin(objectives, eq(keyResults.objectiveId, objectives.id))
          .where(and(
            eq(keyResults.tenantId, tenantId),
            or(ilike(keyResults.title, pattern), ilike(keyResults.description, pattern))
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => {
          const period = r.quarter ? `Q${r.quarter} ${r.year ?? ''}`.trim() : r.year ? `FY ${r.year}` : '';
          const ctxParts = [period, r.objectiveTitle ? `Objective: ${r.objectiveTitle}` : ''].filter(Boolean);
          return {
            type: 'key_result' as const,
            id: r.id,
            title: r.title,
            snippet: buildSnippet(r.description),
            parentContext: ctxParts.join(' · ') || undefined,
            url: `/planning?focus=${r.id}`,
            score: scoreFor(r.title, r.description),
          };
        });
      })().catch((e) => { console.error('[search] key_results failed:', e); return []; }));
    }

    if (wantedTypes.has('big_rock')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: bigRocks.id,
            title: bigRocks.title,
            description: bigRocks.description,
            quarter: bigRocks.quarter,
            year: bigRocks.year,
            objectiveId: bigRocks.objectiveId,
          })
          .from(bigRocks)
          .where(and(
            eq(bigRocks.tenantId, tenantId),
            or(ilike(bigRocks.title, pattern), ilike(bigRocks.description, pattern))
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => {
          const period = r.quarter && r.quarter > 0 ? `Q${r.quarter} ${r.year}` : r.year ? `FY ${r.year}` : '';
          return {
            type: 'big_rock' as const,
            id: r.id,
            title: r.title,
            snippet: buildSnippet(r.description),
            parentContext: period || undefined,
            url: `/planning?focus=${r.id}`,
            score: scoreFor(r.title, r.description),
          };
        });
      })().catch((e) => { console.error('[search] big_rocks failed:', e); return []; }));
    }

    if (wantedTypes.has('strategy')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: strategies.id,
            title: strategies.title,
            description: strategies.description,
            priority: strategies.priority,
            status: strategies.status,
          })
          .from(strategies)
          .where(and(
            eq(strategies.tenantId, tenantId),
            or(ilike(strategies.title, pattern), ilike(strategies.description, pattern))
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => ({
          type: 'strategy' as const,
          id: r.id,
          title: r.title,
          snippet: buildSnippet(r.description),
          parentContext: [r.priority, r.status].filter(Boolean).join(' · ') || undefined,
          url: `/strategy?focus=${r.id}`,
          score: scoreFor(r.title, r.description),
        }));
      })().catch((e) => { console.error('[search] strategies failed:', e); return []; }));
    }

    if (wantedTypes.has('ambition')) {
      tasks.push((async () => {
        const [foundation] = await db.select().from(foundations).where(eq(foundations.tenantId, tenantId));
        if (!foundation || !foundation.ambitions) return [];
        const ambitionsList: Ambition[] = foundation.ambitions;
        return ambitionsList
          .filter((a) => {
            const t = (a.title || '').toLowerCase();
            const d = (a.description || '').toLowerCase();
            return t.includes(lower) || d.includes(lower);
          })
          .map((a) => ({
            type: 'ambition' as const,
            id: a.id,
            title: a.title,
            snippet: buildSnippet(a.description),
            parentContext: a.targetYear ? `Target ${a.targetYear}` : undefined,
            url: `/foundations`,
            score: scoreFor(a.title, a.description),
          }));
      })().catch((e) => { console.error('[search] ambitions failed:', e); return []; }));
    }

    if (wantedTypes.has('team')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: teams.id,
            name: teams.name,
            description: teams.description,
          })
          .from(teams)
          .where(and(
            eq(teams.tenantId, tenantId),
            or(ilike(teams.name, pattern), ilike(teams.description, pattern))
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => ({
          type: 'team' as const,
          id: r.id,
          title: r.name,
          snippet: buildSnippet(r.description),
          url: `/team`,
          score: scoreFor(r.name, r.description),
        }));
      })().catch((e) => { console.error('[search] teams failed:', e); return []; }));
    }

    if (wantedTypes.has('meeting')) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: meetings.id,
            title: meetings.title,
            summary: meetings.summary,
            date: meetings.date,
            meetingType: meetings.meetingType,
          })
          .from(meetings)
          .where(and(
            eq(meetings.tenantId, tenantId),
            or(ilike(meetings.title, pattern), ilike(meetings.summary, pattern))
          ))
          .orderBy(desc(meetings.date))
          .limit(perTypeLimit * 2);
        return rows.map((r) => {
          const dateStr = r.date ? new Date(r.date).toLocaleDateString() : '';
          const ctxParts = [r.meetingType, dateStr].filter(Boolean);
          return {
            type: 'meeting' as const,
            id: r.id,
            title: r.title,
            snippet: buildSnippet(r.summary),
            parentContext: ctxParts.join(' · ') || undefined,
            url: `/focus-rhythm/${r.id}`,
            score: scoreFor(r.title, r.summary),
          };
        });
      })().catch((e) => { console.error('[search] meetings failed:', e); return []; }));
    }

    if (wantedTypes.has('ticket')) {
      tasks.push((async () => {
        const baseConditions: SQL[] = [
          eq(supportTickets.tenantId, tenantId),
          or(ilike(supportTickets.subject, pattern), ilike(supportTickets.description, pattern))!,
        ];
        // Regular users can only see their own tickets; admins see all in the tenant.
        if (!options?.isSupportAdmin && options?.userId) {
          baseConditions.push(eq(supportTickets.userId, options.userId));
        }
        const rows = await db
          .select({
            id: supportTickets.id,
            ticketNumber: supportTickets.ticketNumber,
            subject: supportTickets.subject,
            description: supportTickets.description,
            status: supportTickets.status,
            category: supportTickets.category,
          })
          .from(supportTickets)
          .where(and(...baseConditions))
          .orderBy(desc(supportTickets.createdAt))
          .limit(perTypeLimit * 2);
        return rows.map((r) => ({
          type: 'ticket' as const,
          id: r.id,
          title: `#${r.ticketNumber} ${r.subject}`,
          snippet: buildSnippet(r.description),
          parentContext: [r.category, r.status].filter(Boolean).join(' · ') || undefined,
          url: `/support?ticketId=${r.id}`,
          score: scoreFor(r.subject, r.description),
        }));
      })().catch((e) => { console.error('[search] tickets failed:', e); return []; }));
    }

    if (wantedTypes.has('document') && options?.canSeeGroundingDocs) {
      tasks.push((async () => {
        const rows = await db
          .select({
            id: groundingDocuments.id,
            title: groundingDocuments.title,
            description: groundingDocuments.description,
            category: groundingDocuments.category,
            content: groundingDocuments.content,
            tenantId: groundingDocuments.tenantId,
          })
          .from(groundingDocuments)
          .where(and(
            or(eq(groundingDocuments.tenantId, tenantId), isNull(groundingDocuments.tenantId)),
            or(
              ilike(groundingDocuments.title, pattern),
              ilike(groundingDocuments.description, pattern),
              ilike(groundingDocuments.content, pattern)
            )
          ))
          .limit(perTypeLimit * 2);
        return rows.map((r) => ({
          type: 'document' as const,
          id: r.id,
          title: r.title,
          snippet: buildSnippet(r.description || r.content),
          parentContext: [r.category, r.tenantId ? 'Tenant' : 'Global'].filter(Boolean).join(' · ') || undefined,
          url: `/ai-grounding`,
          score: scoreFor(r.title, r.description || r.content),
        }));
      })().catch((e) => { console.error('[search] documents failed:', e); return []; }));
    }

    const groups = await Promise.all(tasks);
    const flat = groups.flat();
    flat.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    // Cap each type at perTypeLimit to keep results balanced
    const perType = new Map<string, number>();
    const out: Result[] = [];
    for (const r of flat) {
      const c = perType.get(r.type) ?? 0;
      if (c >= perTypeLimit) continue;
      perType.set(r.type, c + 1);
      out.push(r);
      if (out.length >= totalLimit) break;
    }
    return out;
  }

  // ============================================
  // ADMIN ALERTS
  // ============================================

  async recordAdminAlert(input: {
    tenantId: string;
    alertType: string;
    fingerprint: string;
    message: string;
    details?: any;
    severity?: string;
  }): Promise<AdminAlert> {
    const severity = input.severity ?? ADMIN_ALERT_SEVERITY.WARNING;
    const [row] = await db.insert(adminAlerts)
      .values({
        tenantId: input.tenantId,
        alertType: input.alertType,
        fingerprint: input.fingerprint,
        severity,
        message: input.message,
        details: input.details ?? null,
      })
      .onConflictDoUpdate({
        target: [adminAlerts.tenantId, adminAlerts.alertType, adminAlerts.fingerprint],
        set: {
          message: input.message,
          details: input.details ?? null,
          severity,
          lastSeenAt: sql`now()`,
          occurrenceCount: sql`${adminAlerts.occurrenceCount} + 1`,
          // Re-open if it fires again after being acknowledged.
          acknowledgedAt: null,
          acknowledgedBy: null,
        },
      })
      .returning();
    return row;
  }

  async getAdminAlertsByTenantId(tenantId: string, includeAcknowledged: boolean = false): Promise<AdminAlert[]> {
    const where = includeAcknowledged
      ? eq(adminAlerts.tenantId, tenantId)
      : and(eq(adminAlerts.tenantId, tenantId), isNull(adminAlerts.acknowledgedAt));
    return await db.select()
      .from(adminAlerts)
      .where(where)
      .orderBy(desc(adminAlerts.lastSeenAt));
  }

  async acknowledgeAdminAlert(id: string, tenantId: string, userId: string): Promise<AdminAlert | undefined> {
    const [row] = await db.update(adminAlerts)
      .set({ acknowledgedAt: sql`now()`, acknowledgedBy: userId })
      .where(and(eq(adminAlerts.id, id), eq(adminAlerts.tenantId, tenantId)))
      .returning();
    return row;
  }

  // ============================================
  // Bulk Reassignment
  // ============================================

  async getOwnedItemsByUser(tenantId: string, userId: string) {
    const tenantFilter = eq(objectives.tenantId, tenantId);

    // Objectives owned (primary) or co-owned or check-in owner
    const objectivesAll = await db
      .select({
        id: objectives.id,
        title: objectives.title,
        ownerId: objectives.ownerId,
        ownerEmail: objectives.ownerEmail,
        coOwnerIds: objectives.coOwnerIds,
        checkInOwnerId: objectives.checkInOwnerId,
      })
      .from(objectives)
      .where(tenantFilter);

    // Look up the user's email so we can also match the email-based ownerEmail field
    const [userRowEarly] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    const userEmailEarly = userRowEarly?.email?.toLowerCase() ?? '';

    const isObjectivePrimary = (o: { ownerId: string | null; ownerEmail: string | null }) =>
      o.ownerId === userId ||
      (!!userEmailEarly && (o.ownerEmail ?? '').toLowerCase() === userEmailEarly);

    const objectivesPrimary = objectivesAll.filter(isObjectivePrimary);
    const objectivesCoOwner = objectivesAll.filter(
      o => Array.isArray(o.coOwnerIds) && o.coOwnerIds.includes(userId) && !isObjectivePrimary(o)
    );
    const objectivesCheckIn = objectivesAll.filter(
      o => o.checkInOwnerId === userId && !isObjectivePrimary(o)
    );

    // Key results
    const keyResultsRows = await db
      .select({ id: keyResults.id, title: keyResults.title })
      .from(keyResults)
      .where(and(eq(keyResults.tenantId, tenantId), eq(keyResults.ownerId, userId)));

    // Big rocks (owner + accountable). Match either by id or email since data uses both.
    const bigRocksAll = await db
      .select({
        id: bigRocks.id,
        title: bigRocks.title,
        ownerId: bigRocks.ownerId,
        ownerEmail: bigRocks.ownerEmail,
        accountableId: bigRocks.accountableId,
        accountableEmail: bigRocks.accountableEmail,
      })
      .from(bigRocks)
      .where(eq(bigRocks.tenantId, tenantId));
    const isBrOwner = (b: { ownerId: string | null; ownerEmail: string | null }) =>
      b.ownerId === userId ||
      (!!userEmailEarly && (b.ownerEmail ?? '').toLowerCase() === userEmailEarly);
    const isBrAccountable = (b: { accountableId: string | null; accountableEmail: string | null }) =>
      b.accountableId === userId ||
      (!!userEmailEarly && (b.accountableEmail ?? '').toLowerCase() === userEmailEarly);
    const bigRocksOwner = bigRocksAll.filter(isBrOwner);
    const bigRocksAccountable = bigRocksAll.filter(b => isBrAccountable(b) && !isBrOwner(b));

    // Foundation ambitions (jsonb array, owner stored by userId)
    const foundation = await db
      .select()
      .from(foundations)
      .where(eq(foundations.tenantId, tenantId));
    const foundationRow = foundation[0];
    const ambitionsOwned = (foundationRow?.ambitions ?? []).filter(
      (a: Ambition) => a.ownerId === userId
    );

    // Look up the user's email so we can search text-based owner fields (strategies / meetings)
    const [userRow] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId));
    const userEmail = userRow?.email?.toLowerCase() ?? '';
    const userName = (userRow?.name ?? '').toLowerCase();

    // Strategies (owner is text - email or name)
    const strategiesAll = await db
      .select({ id: strategies.id, title: strategies.title, owner: strategies.owner })
      .from(strategies)
      .where(eq(strategies.tenantId, tenantId));
    const strategiesOwned = strategiesAll.filter(s => {
      const owner = (s.owner ?? '').toLowerCase();
      return owner && (owner === userEmail || (userName && owner === userName));
    });

    // Meetings (facilitator is text email/name; attendees jsonb of strings)
    const meetingsAll = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        facilitator: meetings.facilitator,
        attendees: meetings.attendees,
      })
      .from(meetings)
      .where(eq(meetings.tenantId, tenantId));
    const meetingsFacilitator = meetingsAll.filter(m => {
      const f = (m.facilitator ?? '').toLowerCase();
      return f && (f === userEmail || (userName && f === userName));
    });
    const meetingsAttendee = meetingsAll.filter(m => {
      if (meetingsFacilitator.some(mf => mf.id === m.id)) return false;
      const list = Array.isArray(m.attendees) ? m.attendees : [];
      return list.some(a => {
        const v = (a ?? '').toLowerCase();
        return v && (v === userEmail || (userName && v === userName));
      });
    });

    // Support tickets (assignedTo)
    const ticketRows = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        ticketNumber: supportTickets.ticketNumber,
      })
      .from(supportTickets)
      .where(and(eq(supportTickets.tenantId, tenantId), eq(supportTickets.assignedTo, userId)));

    const counts: ReassignmentCounts = {
      objectivesPrimary: objectivesPrimary.length,
      objectivesCoOwner: objectivesCoOwner.length,
      objectivesCheckIn: objectivesCheckIn.length,
      keyResults: keyResultsRows.length,
      bigRocksOwner: bigRocksOwner.length,
      bigRocksAccountable: bigRocksAccountable.length,
      ambitions: ambitionsOwned.length,
      strategies: strategiesOwned.length,
      meetingsFacilitator: meetingsFacilitator.length,
      meetingsAttendee: meetingsAttendee.length,
      supportTickets: ticketRows.length,
      total: 0,
    };
    counts.total =
      counts.objectivesPrimary +
      counts.objectivesCoOwner +
      counts.objectivesCheckIn +
      counts.keyResults +
      counts.bigRocksOwner +
      counts.bigRocksAccountable +
      counts.ambitions +
      counts.strategies +
      counts.meetingsFacilitator +
      counts.meetingsAttendee +
      counts.supportTickets;

    const items = {
      objectivesPrimary: objectivesPrimary.map(o => ({ id: o.id, title: o.title })),
      objectivesCoOwner: objectivesCoOwner.map(o => ({ id: o.id, title: o.title })),
      objectivesCheckIn: objectivesCheckIn.map(o => ({ id: o.id, title: o.title })),
      keyResults: keyResultsRows.map(k => ({ id: k.id, title: k.title })),
      bigRocksOwner: bigRocksOwner.map(b => ({ id: b.id, title: b.title })),
      bigRocksAccountable: bigRocksAccountable.map(b => ({ id: b.id, title: b.title })),
      ambitions: ambitionsOwned.map((a: Ambition) => ({ id: a.id, title: a.title })),
      strategies: strategiesOwned.map(s => ({ id: s.id, title: s.title })),
      meetingsFacilitator: meetingsFacilitator.map(m => ({ id: m.id, title: m.title })),
      meetingsAttendee: meetingsAttendee.map(m => ({ id: m.id, title: m.title })),
      supportTickets: ticketRows.map(t => ({
        id: t.id,
        subject: t.subject,
        ticketNumber: t.ticketNumber,
      })),
    };

    return { counts, items };
  }

  async reassignOwnership(params: {
    tenantId: string;
    fromUserId: string;
    fromUserEmail: string;
    fromUserName: string | null;
    toUserId: string;
    toUserEmail: string;
    toUserName: string | null;
    performedById: string;
    performedByEmail: string;
    performedByName: string | null;
    notes?: string | null;
    keepOriginalAsCoOwner?: boolean;
    selection?: ReassignmentSelection;
  }): Promise<{ counts: ReassignmentCounts; auditLog: ReassignmentAuditLog }> {
    const {
      tenantId,
      fromUserId,
      fromUserEmail,
      fromUserName,
      toUserId,
      toUserEmail,
      toUserName,
      performedById,
      performedByEmail,
      performedByName,
      notes,
      keepOriginalAsCoOwner,
      selection,
    } = params;

    // Helper: returns true if the role is being included in the transfer.
    // - selection undefined          → include everything (back-compat)
    // - selection[role] undefined    → include all of that role
    // - selection[role] is array     → include only items whose id is in that array
    const idAllowed = (role: keyof ReassignmentSelection, id: string): boolean => {
      if (!selection) return true;
      const allowed = selection[role];
      if (allowed === undefined) return true;
      return allowed.includes(id);
    };
    const roleEnabled = (role: keyof ReassignmentSelection): boolean => {
      if (!selection) return true;
      const allowed = selection[role];
      if (allowed === undefined) return true;
      return allowed.length > 0;
    };

    return await db.transaction(async (tx) => {
      const fromEmailLc = fromUserEmail.toLowerCase();
      const fromNameLc = (fromUserName ?? '').toLowerCase();

      // 1. Objectives - primary owner (match by id OR by email - data uses both)
      let updatedObjPrimaryCount = 0;
      if (roleEnabled('objectivesPrimary')) {
        const candidates = await tx
          .select({ id: objectives.id, coOwnerIds: objectives.coOwnerIds })
          .from(objectives)
          .where(
            and(
              eq(objectives.tenantId, tenantId),
              or(
                eq(objectives.ownerId, fromUserId),
                sql`lower(${objectives.ownerEmail}) = ${fromEmailLc}`
              )
            )
          );
        const targets = candidates.filter(c => idAllowed('objectivesPrimary', c.id));
        for (const row of targets) {
          const updates: Record<string, any> = {
            ownerId: toUserId,
            ownerEmail: toUserEmail,
            updatedBy: performedById,
            updatedAt: new Date(),
          };
          if (keepOriginalAsCoOwner) {
            const current = Array.isArray(row.coOwnerIds) ? row.coOwnerIds : [];
            const next = Array.from(new Set([...current.filter(id => id !== toUserId), fromUserId]));
            updates.coOwnerIds = next;
          }
          await tx.update(objectives).set(updates).where(eq(objectives.id, row.id));
          updatedObjPrimaryCount++;
        }
      }

      // 2. Objectives - check-in owner
      let updatedObjCheckInCount = 0;
      if (roleEnabled('objectivesCheckIn')) {
        const candidates = await tx
          .select({ id: objectives.id })
          .from(objectives)
          .where(and(eq(objectives.tenantId, tenantId), eq(objectives.checkInOwnerId, fromUserId)));
        const targets = candidates.filter(c => idAllowed('objectivesCheckIn', c.id));
        if (targets.length > 0) {
          const ids = targets.map(t => t.id);
          await tx
            .update(objectives)
            .set({ checkInOwnerId: toUserId, updatedBy: performedById, updatedAt: new Date() })
            .where(inArray(objectives.id, ids));
          updatedObjCheckInCount = targets.length;
        }
      }

      // 3. Objectives - co-owners (jsonb array)
      let updatedObjCoOwnerCount = 0;
      if (roleEnabled('objectivesCoOwner')) {
        const objectivesWithCoOwner = await tx
          .select({ id: objectives.id, coOwnerIds: objectives.coOwnerIds })
          .from(objectives)
          .where(
            and(
              eq(objectives.tenantId, tenantId),
              sql`${objectives.coOwnerIds}::jsonb @> ${JSON.stringify([fromUserId])}::jsonb`
            )
          );
        const targets = objectivesWithCoOwner.filter(c => idAllowed('objectivesCoOwner', c.id));
        for (const row of targets) {
          const current = Array.isArray(row.coOwnerIds) ? row.coOwnerIds : [];
          const next = Array.from(
            new Set(current.map(id => (id === fromUserId ? toUserId : id)))
          );
          await tx
            .update(objectives)
            .set({ coOwnerIds: next, updatedBy: performedById, updatedAt: new Date() })
            .where(eq(objectives.id, row.id));
          updatedObjCoOwnerCount++;
        }
      }

      // 4. Key results
      let updatedKrCount = 0;
      if (roleEnabled('keyResults')) {
        const candidates = await tx
          .select({ id: keyResults.id })
          .from(keyResults)
          .where(and(eq(keyResults.tenantId, tenantId), eq(keyResults.ownerId, fromUserId)));
        const targets = candidates.filter(c => idAllowed('keyResults', c.id));
        if (targets.length > 0) {
          const ids = targets.map(t => t.id);
          await tx
            .update(keyResults)
            .set({ ownerId: toUserId, updatedBy: performedById, updatedAt: new Date() })
            .where(inArray(keyResults.id, ids));
          updatedKrCount = targets.length;
        }
      }

      // 5. Big rocks - owner (match by id OR email)
      let updatedBrOwnerCount = 0;
      if (roleEnabled('bigRocksOwner')) {
        const candidates = await tx
          .select({ id: bigRocks.id })
          .from(bigRocks)
          .where(
            and(
              eq(bigRocks.tenantId, tenantId),
              or(
                eq(bigRocks.ownerId, fromUserId),
                sql`lower(${bigRocks.ownerEmail}) = ${fromEmailLc}`
              )
            )
          );
        const targets = candidates.filter(c => idAllowed('bigRocksOwner', c.id));
        if (targets.length > 0) {
          const ids = targets.map(t => t.id);
          await tx
            .update(bigRocks)
            .set({
              ownerId: toUserId,
              ownerEmail: toUserEmail,
              updatedBy: performedById,
              updatedAt: new Date(),
            })
            .where(inArray(bigRocks.id, ids));
          updatedBrOwnerCount = targets.length;
        }
      }

      // 6. Big rocks - accountable (match by id OR email)
      let updatedBrAccountableCount = 0;
      if (roleEnabled('bigRocksAccountable')) {
        const candidates = await tx
          .select({ id: bigRocks.id })
          .from(bigRocks)
          .where(
            and(
              eq(bigRocks.tenantId, tenantId),
              or(
                eq(bigRocks.accountableId, fromUserId),
                sql`lower(${bigRocks.accountableEmail}) = ${fromEmailLc}`
              )
            )
          );
        const targets = candidates.filter(c => idAllowed('bigRocksAccountable', c.id));
        if (targets.length > 0) {
          const ids = targets.map(t => t.id);
          await tx
            .update(bigRocks)
            .set({
              accountableId: toUserId,
              accountableEmail: toUserEmail,
              updatedBy: performedById,
              updatedAt: new Date(),
            })
            .where(inArray(bigRocks.id, ids));
          updatedBrAccountableCount = targets.length;
        }
      }

      // 7. Foundation ambitions (jsonb)
      let updatedAmbitionsCount = 0;
      if (roleEnabled('ambitions')) {
        const [foundationRow] = await tx
          .select()
          .from(foundations)
          .where(eq(foundations.tenantId, tenantId));
        if (foundationRow?.ambitions && foundationRow.ambitions.length > 0) {
          const next = (foundationRow.ambitions as Ambition[]).map((a) => {
            if (a.ownerId === fromUserId && idAllowed('ambitions', a.id)) {
              updatedAmbitionsCount++;
              return { ...a, ownerId: toUserId };
            }
            return a;
          });
          if (updatedAmbitionsCount > 0) {
            await tx
              .update(foundations)
              .set({ ambitions: next, updatedBy: performedById, updatedAt: new Date() })
              .where(eq(foundations.tenantId, tenantId));
          }
        }
      }

      // 8. Strategies (text owner field)
      let updatedStrategiesCount = 0;
      if (roleEnabled('strategies')) {
        const strategiesAll = await tx
          .select({ id: strategies.id, owner: strategies.owner })
          .from(strategies)
          .where(eq(strategies.tenantId, tenantId));
        for (const s of strategiesAll) {
          const owner = (s.owner ?? '').toLowerCase();
          const matches =
            owner && (owner === fromEmailLc || (fromNameLc && owner === fromNameLc));
          if (matches && idAllowed('strategies', s.id)) {
            await tx
              .update(strategies)
              .set({ owner: toUserEmail, updatedBy: performedById, updatedAt: new Date() })
              .where(eq(strategies.id, s.id));
            updatedStrategiesCount++;
          }
        }
      }

      // 9. Meetings - facilitator + attendees
      let updatedMeetingsFacilitatorCount = 0;
      let updatedMeetingsAttendeeCount = 0;
      const facilitatorEnabled = roleEnabled('meetingsFacilitator');
      const attendeeEnabled = roleEnabled('meetingsAttendee');
      if (facilitatorEnabled || attendeeEnabled) {
        const meetingsAll = await tx
          .select({
            id: meetings.id,
            facilitator: meetings.facilitator,
            attendees: meetings.attendees,
          })
          .from(meetings)
          .where(eq(meetings.tenantId, tenantId));
        for (const m of meetingsAll) {
          const facilitator = (m.facilitator ?? '').toLowerCase();
          const facilitatorMatches =
            facilitatorEnabled &&
            facilitator &&
            (facilitator === fromEmailLc || (fromNameLc && facilitator === fromNameLc)) &&
            idAllowed('meetingsFacilitator', m.id);

          const list = Array.isArray(m.attendees) ? m.attendees : [];
          let nextAttendees = list;
          let attendeeChanged = false;
          if (attendeeEnabled && idAllowed('meetingsAttendee', m.id) && list.length > 0) {
            const seen = new Set<string>();
            const out: string[] = [];
            let mutated = false;
            for (const a of list) {
              const lc = (a ?? '').toLowerCase();
              if (lc && (lc === fromEmailLc || (fromNameLc && lc === fromNameLc))) {
                mutated = true;
                const replacement = toUserEmail;
                if (!seen.has(replacement.toLowerCase())) {
                  seen.add(replacement.toLowerCase());
                  out.push(replacement);
                }
              } else {
                if (!lc || !seen.has(lc)) {
                  if (lc) seen.add(lc);
                  out.push(a);
                }
              }
            }
            if (mutated) {
              nextAttendees = out;
              attendeeChanged = true;
            }
          }

          if (facilitatorMatches || attendeeChanged) {
            const updates: Record<string, any> = {
              updatedBy: performedById,
              updatedAt: new Date(),
            };
            if (facilitatorMatches) {
              updates.facilitator = toUserEmail;
              updatedMeetingsFacilitatorCount++;
            }
            if (attendeeChanged) {
              updates.attendees = nextAttendees;
              if (!facilitatorMatches) updatedMeetingsAttendeeCount++;
            }
            await tx.update(meetings).set(updates).where(eq(meetings.id, m.id));
          }
        }
      }

      // 10. Support tickets - assignedTo
      let updatedTicketsCount = 0;
      if (roleEnabled('supportTickets')) {
        const candidates = await tx
          .select({ id: supportTickets.id })
          .from(supportTickets)
          .where(
            and(eq(supportTickets.tenantId, tenantId), eq(supportTickets.assignedTo, fromUserId))
          );
        const targets = candidates.filter(c => idAllowed('supportTickets', c.id));
        if (targets.length > 0) {
          const ids = targets.map(t => t.id);
          await tx
            .update(supportTickets)
            .set({ assignedTo: toUserId, updatedAt: new Date() })
            .where(inArray(supportTickets.id, ids));
          updatedTicketsCount = targets.length;
        }
      }

      const counts: ReassignmentCounts = {
        objectivesPrimary: updatedObjPrimaryCount,
        objectivesCoOwner: updatedObjCoOwnerCount,
        objectivesCheckIn: updatedObjCheckInCount,
        keyResults: updatedKrCount,
        bigRocksOwner: updatedBrOwnerCount,
        bigRocksAccountable: updatedBrAccountableCount,
        ambitions: updatedAmbitionsCount,
        strategies: updatedStrategiesCount,
        meetingsFacilitator: updatedMeetingsFacilitatorCount,
        meetingsAttendee: updatedMeetingsAttendeeCount,
        supportTickets: updatedTicketsCount,
        total: 0,
      };
      counts.total =
        counts.objectivesPrimary +
        counts.objectivesCoOwner +
        counts.objectivesCheckIn +
        counts.keyResults +
        counts.bigRocksOwner +
        counts.bigRocksAccountable +
        counts.ambitions +
        counts.strategies +
        counts.meetingsFacilitator +
        counts.meetingsAttendee +
        counts.supportTickets;

      // Audit log INSIDE the transaction so it rolls back if any step fails.
      const [auditLog] = await tx
        .insert(reassignmentAuditLogs)
        .values({
          tenantId,
          fromUserId,
          fromUserEmail,
          fromUserName: fromUserName ?? null,
          toUserId,
          toUserEmail,
          toUserName: toUserName ?? null,
          performedById,
          performedByEmail,
          performedByName: performedByName ?? null,
          counts,
          notes: notes ?? null,
          status: 'completed',
        })
        .returning();

      return { counts, auditLog };
    });
  }

  async createReassignmentAuditLog(log: InsertReassignmentAuditLog): Promise<ReassignmentAuditLog> {
    const [created] = await db.insert(reassignmentAuditLogs).values(log).returning();
    return created;
  }

  async getReassignmentAuditLogs(tenantId: string, limit: number = 50): Promise<ReassignmentAuditLog[]> {
    return await db
      .select()
      .from(reassignmentAuditLogs)
      .where(eq(reassignmentAuditLogs.tenantId, tenantId))
      .orderBy(desc(reassignmentAuditLogs.createdAt))
      .limit(limit);
  }

  // ============================================
  // Weekly digest send log (Task #62)
  // ============================================
  async getWeeklyDigestSend(userId: string, periodStart: string): Promise<WeeklyDigestSend | undefined> {
    const [row] = await db.select().from(weeklyDigestSends)
      .where(and(eq(weeklyDigestSends.userId, userId), eq(weeklyDigestSends.periodStart, periodStart)))
      .limit(1);
    return row;
  }

  async recordWeeklyDigestSend(send: InsertWeeklyDigestSend): Promise<WeeklyDigestSend> {
    const [row] = await db.insert(weeklyDigestSends)
      .values(send)
      .onConflictDoUpdate({
        target: [weeklyDigestSends.userId, weeklyDigestSends.periodStart],
        set: {
          status: send.status,
          aiUsed: send.aiUsed ?? false,
          errorMessage: send.errorMessage ?? null,
          sendAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getWeeklyDigestSendsForPeriod(tenantId: string, periodStart: string): Promise<WeeklyDigestSend[]> {
    return await db.select().from(weeklyDigestSends)
      .where(and(eq(weeklyDigestSends.tenantId, tenantId), eq(weeklyDigestSends.periodStart, periodStart)));
  }

  // ============================================
  // CUSTOM FIELDS
  // ============================================

  async getCustomFieldDefs(
    tenantId: string,
    entityType?: CustomFieldEntityType,
    includeArchived = false,
  ): Promise<CustomFieldDef[]> {
    const conds: SQL[] = [eq(customFieldDefs.tenantId, tenantId)];
    if (entityType) conds.push(eq(customFieldDefs.entityType, entityType));
    if (!includeArchived) conds.push(isNull(customFieldDefs.archivedAt));
    return await db
      .select()
      .from(customFieldDefs)
      .where(and(...conds))
      .orderBy(asc(customFieldDefs.sortOrder), asc(customFieldDefs.createdAt));
  }

  async getCustomFieldDefById(id: string): Promise<CustomFieldDef | undefined> {
    const [row] = await db.select().from(customFieldDefs).where(eq(customFieldDefs.id, id));
    return row;
  }

  async createCustomFieldDef(def: InsertCustomFieldDef): Promise<CustomFieldDef> {
    // Enforce active limit
    const active = await this.getCustomFieldDefs(def.tenantId, def.entityType as CustomFieldEntityType, false);
    if (active.length >= MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY) {
      throw new Error(`Maximum of ${MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY} active custom fields per entity reached. Archive a field first.`);
    }
    const sortOrder = def.sortOrder ?? (active.length > 0 ? Math.max(...active.map(d => d.sortOrder ?? 0)) + 1 : 0);
    const [row] = await db
      .insert(customFieldDefs)
      .values({ ...def, sortOrder } as any)
      .returning();
    return row;
  }

  async updateCustomFieldDef(id: string, updates: Partial<InsertCustomFieldDef>): Promise<CustomFieldDef> {
    const existing = await this.getCustomFieldDefById(id);
    if (!existing) throw new Error("Custom field not found");
    // Disallow changing entityType, fieldType, or key after creation
    const safe: any = { ...updates, updatedAt: new Date() };
    delete safe.entityType;
    delete safe.fieldType;
    delete safe.key;
    delete safe.tenantId;
    const [row] = await db
      .update(customFieldDefs)
      .set(safe)
      .where(eq(customFieldDefs.id, id))
      .returning();
    return row;
  }

  async archiveCustomFieldDef(id: string): Promise<CustomFieldDef> {
    const [row] = await db
      .update(customFieldDefs)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(customFieldDefs.id, id))
      .returning();
    return row;
  }

  async restoreCustomFieldDef(id: string): Promise<CustomFieldDef> {
    const def = await this.getCustomFieldDefById(id);
    if (!def) throw new Error("Custom field not found");
    const active = await this.getCustomFieldDefs(def.tenantId, def.entityType as CustomFieldEntityType, false);
    if (active.length >= MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY) {
      throw new Error(`Cannot restore: ${MAX_ACTIVE_CUSTOM_FIELDS_PER_ENTITY} active custom fields already exist for this entity.`);
    }
    const [row] = await db
      .update(customFieldDefs)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(customFieldDefs.id, id))
      .returning();
    return row;
  }

  async reorderCustomFieldDefs(
    tenantId: string,
    entityType: CustomFieldEntityType,
    orderedIds: string[],
  ): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(customFieldDefs)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(
          eq(customFieldDefs.id, orderedIds[i]),
          eq(customFieldDefs.tenantId, tenantId),
          eq(customFieldDefs.entityType, entityType),
        ));
    }
  }

  async getCustomFieldValuesByEntity(
    entityType: CustomFieldEntityType,
    entityId: string,
  ): Promise<CustomFieldValue[]> {
    return await db
      .select()
      .from(customFieldValues)
      .where(and(
        eq(customFieldValues.entityType, entityType),
        eq(customFieldValues.entityId, entityId),
      ));
  }

  async getCustomFieldValuesByEntityIds(
    tenantId: string,
    entityType: CustomFieldEntityType,
    entityIds: string[],
  ): Promise<Record<string, CustomFieldValue[]>> {
    if (entityIds.length === 0) return {};
    const rows = await db
      .select()
      .from(customFieldValues)
      .where(and(
        eq(customFieldValues.tenantId, tenantId),
        eq(customFieldValues.entityType, entityType),
        inArray(customFieldValues.entityId, entityIds),
      ));
    const out: Record<string, CustomFieldValue[]> = {};
    for (const r of rows) {
      (out[r.entityId] ||= []).push(r);
    }
    return out;
  }

  async setCustomFieldValues(
    tenantId: string,
    entityType: CustomFieldEntityType,
    entityId: string,
    values: { fieldDefId: string; valueJson: any }[],
  ): Promise<void> {
    for (const v of values) {
      if (v.valueJson === null) {
        await db
          .delete(customFieldValues)
          .where(and(
            eq(customFieldValues.entityId, entityId),
            eq(customFieldValues.fieldDefId, v.fieldDefId),
          ));
      } else {
        await db
          .insert(customFieldValues)
          .values({
            tenantId,
            entityType,
            entityId,
            fieldDefId: v.fieldDefId,
            valueJson: v.valueJson,
          })
          .onConflictDoUpdate({
            target: [customFieldValues.entityId, customFieldValues.fieldDefId],
            set: { valueJson: v.valueJson, updatedAt: new Date() },
          });
      }
    }
  }

  // ============================================
  // Saved Views
  // ============================================

  async getSavedViews(tenantId: string, userId: string, page: SavedViewPage): Promise<SavedView[]> {
    return await db
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.tenantId, tenantId),
          eq(savedViews.page, page),
          isNull(savedViews.deletedAt),
          or(
            eq(savedViews.visibility, 'shared'),
            eq(savedViews.ownerUserId, userId),
          ),
        ),
      )
      .orderBy(asc(savedViews.name));
  }

  async getSavedViewById(id: string): Promise<SavedView | undefined> {
    const [view] = await db.select().from(savedViews).where(eq(savedViews.id, id));
    return view;
  }

  async createSavedView(view: InsertSavedView): Promise<SavedView> {
    return await db.transaction(async (tx) => {
      if (view.isDefault) {
        await tx
          .update(savedViews)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(savedViews.tenantId, view.tenantId),
              eq(savedViews.ownerUserId, view.ownerUserId),
              eq(savedViews.page, view.page),
              eq(savedViews.isDefault, true),
            ),
          );
      }
      const [created] = await tx.insert(savedViews).values(view).returning();
      return created;
    });
  }

  async updateSavedView(id: string, updates: Partial<InsertSavedView>): Promise<SavedView> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(savedViews).where(eq(savedViews.id, id));
      if (!existing) throw new Error("Saved view not found");
      if (updates.isDefault) {
        await tx
          .update(savedViews)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(savedViews.tenantId, existing.tenantId),
              eq(savedViews.ownerUserId, existing.ownerUserId),
              eq(savedViews.page, existing.page),
              eq(savedViews.isDefault, true),
            ),
          );
      }
      const [updated] = await tx
        .update(savedViews)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(savedViews.id, id))
        .returning();
      return updated;
    });
  }

  async softDeleteSavedView(id: string): Promise<void> {
    await db
      .update(savedViews)
      .set({ deletedAt: new Date(), isDefault: false, updatedAt: new Date() })
      .where(eq(savedViews.id, id));
  }
}

export const storage = new DatabaseStorage();
