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
  checkIns, type CheckIn, type InsertCheckIn,
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
  reviewSnapshots, type ReviewSnapshot, type InsertReviewSnapshot,
  reportTemplates, type ReportTemplate, type InsertReportTemplate,
  reportInstances, type ReportInstance, type InsertReportInstance,
  launchpadSessions, type LaunchpadSession, type InsertLaunchpadSession, type LaunchpadProposal,
  servicePlans, type ServicePlan, type InsertServicePlan,
  blockedDomains, type BlockedDomain, type InsertBlockedDomain
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, isNull, inArray } from "drizzle-orm";
import { hashPassword } from "./auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(tenantId?: string): Promise<User[]>;
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
  deleteStrategy(id: string): Promise<void>;
  
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
  getObjectivesByTenantId(tenantId: string, quarter?: number, year?: number, level?: string, teamId?: string): Promise<Objective[]>;
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
  deleteObjective(id: string): Promise<void>;
  cloneObjective(objectiveId: string, options: {
    targetQuarter: number;
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
  deleteKeyResult(id: string): Promise<void>;
  promoteKeyResultToKpi(keyResultId: string, userId: string): Promise<Kpi>;
  unpromoteKeyResultFromKpi(keyResultId: string): Promise<KeyResult>;
  getAllObjectives(): Promise<Objective[]>;
  
  getBigRocksByTenantId(tenantId: string, quarter?: number, year?: number): Promise<BigRock[]>;
  getBigRockById(id: string): Promise<BigRock | undefined>;
  getBigRocksByObjectiveId(objectiveId: string): Promise<BigRock[]>;
  getBigRocksByKeyResultId(keyResultId: string): Promise<BigRock[]>;
  createBigRock(bigRock: InsertBigRock): Promise<BigRock>;
  updateBigRock(id: string, bigRock: Partial<InsertBigRock>): Promise<BigRock>;
  deleteBigRock(id: string): Promise<void>;
  
  // Objective-BigRock linking methods
  linkObjectiveToBigRock(objectiveId: string, bigRockId: string, tenantId: string): Promise<void>;
  unlinkObjectiveToBigRock(objectiveId: string, bigRockId: string): Promise<void>;
  getBigRocksLinkedToObjective(objectiveId: string): Promise<BigRock[]>;
  
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
  
  getCheckInsByEntityId(entityType: string, entityId: string): Promise<CheckIn[]>;
  getCheckInById(id: string): Promise<CheckIn | undefined>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  updateCheckIn(id: string, data: Partial<CheckIn>): Promise<CheckIn>;
  getLatestCheckIn(entityType: string, entityId: string): Promise<CheckIn | undefined>;
  
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
    const allTenants = await db.select().from(tenants);
    const tenant = allTenants.find(t => 
      t.allowedDomains && Array.isArray(t.allowedDomains) && t.allowedDomains.includes(domain)
    );
    return tenant || undefined;
  }

  async getAllUsers(tenantId?: string): Promise<User[]> {
    if (tenantId) {
      return await db.select().from(users).where(eq(users.tenantId, tenantId));
    }
    return await db.select().from(users);
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
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getFoundationByTenantId(tenantId: string): Promise<Foundation | undefined> {
    const [foundation] = await db
      .select()
      .from(foundations)
      .where(eq(foundations.tenantId, tenantId));
    return foundation || undefined;
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
          annualGoals: insertFoundation.annualGoals ? [...insertFoundation.annualGoals] : null,
        })
        .returning();
      return created;
    }
  }

  async getStrategiesByTenantId(tenantId: string): Promise<Strategy[]> {
    return await db.select().from(strategies).where(eq(strategies.tenantId, tenantId));
  }

  async getStrategyById(id: string): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies).where(eq(strategies.id, id));
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

  async deleteStrategy(id: string): Promise<void> {
    await db.delete(strategies).where(eq(strategies.id, id));
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
      } as any)
      .returning();
    return meeting;
  }

  async updateMeeting(id: string, updateData: Partial<InsertMeeting>): Promise<Meeting> {
    const [meeting] = await db
      .update(meetings)
      .set({
        ...updateData,
        attendees: updateData.attendees ? [...updateData.attendees] : undefined,
        decisions: updateData.decisions ? [...updateData.decisions] : undefined,
        actionItems: updateData.actionItems ? [...updateData.actionItems] : undefined,
      } as any)
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Enhanced OKR Method Implementations
  async getObjectivesByTenantId(tenantId: string, quarter?: number, year?: number, level?: string, teamId?: string): Promise<Objective[]> {
    // Build base conditions
    const conditions: any[] = [eq(objectives.tenantId, tenantId)];
    
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
      // Include both quarterly AND annual objectives (treat both null and 0 as annual)
      conditions.push(or(
        eq(objectives.quarter, quarter),
        isNull(objectives.quarter),
        eq(objectives.quarter, 0)
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
    
    return await db.select().from(objectives).where(and(...conditions));
  }

  async getTeamsByTenantId(tenantId: string): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.tenantId, tenantId));
  }

  async getTeamByName(tenantId: string, name: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(and(eq(teams.tenantId, tenantId), eq(teams.name, name)));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team as any).returning();
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
    return team;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getObjectiveById(id: string): Promise<Objective | undefined> {
    const [objective] = await db.select().from(objectives).where(eq(objectives.id, id));
    return objective || undefined;
  }

  async getChildObjectives(parentId: string): Promise<Objective[]> {
    return await db.select().from(objectives).where(eq(objectives.parentId, parentId));
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
    return objective;
  }

  async deleteObjective(id: string): Promise<void> {
    // Delete child key results and big rocks first
    await db.delete(keyResults).where(eq(keyResults.objectiveId, id));
    await db.delete(bigRocks).where(eq(bigRocks.objectiveId, id));
    // Delete the objective
    await db.delete(objectives).where(eq(objectives.id, id));
  }

  async cloneObjective(objectiveId: string, options: {
    targetQuarter: number;
    targetYear: number;
    keepOriginalOwner: boolean;
    newOwnerId?: string;
    cloneScope: 'objective_only' | 'immediate_children' | 'all_children';
  }): Promise<Objective> {
    const sourceObjective = await this.getObjectiveById(objectiveId);
    if (!sourceObjective) {
      throw new Error('Source objective not found');
    }

    // Build dates for the target quarter
    const startDate = new Date(options.targetYear, (options.targetQuarter - 1) * 3, 1);
    const endDate = new Date(options.targetYear, options.targetQuarter * 3, 0);

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
      targetQuarter: number;
      targetYear: number;
      keepOriginalOwner: boolean;
      newOwnerId?: string;
    }
  ): Promise<void> {
    const childObjectives = await this.getChildObjectives(sourceParentId);
    
    for (const child of childObjectives) {
      const startDate = new Date(options.targetYear, (options.targetQuarter - 1) * 3, 1);
      const endDate = new Date(options.targetYear, options.targetQuarter * 3, 0);

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
    return await db.select().from(keyResults).where(eq(keyResults.objectiveId, objectiveId));
  }

  async getKeyResultsByTenantId(tenantId: string, quarter?: number, year?: number, teamId?: string): Promise<KeyResult[]> {
    // Key results don't have tenant/quarter/year directly - get them through their parent objectives
    const matchingObjectives = await this.getObjectivesByTenantId(tenantId, quarter, year, undefined, teamId);
    const objectiveIds = matchingObjectives.map(o => o.id);
    
    if (objectiveIds.length === 0) {
      return [];
    }
    
    // Fetch all key results for these objectives
    return await db.select().from(keyResults).where(inArray(keyResults.objectiveId, objectiveIds));
  }

  async getKeyResultById(id: string): Promise<KeyResult | undefined> {
    const [keyResult] = await db.select().from(keyResults).where(eq(keyResults.id, id));
    return keyResult || undefined;
  }

  async getAllKeyResults(): Promise<KeyResult[]> {
    return await db.select().from(keyResults);
  }

  async getAllObjectives(): Promise<Objective[]> {
    return await db.select().from(objectives);
  }

  async createKeyResult(insertKeyResult: InsertKeyResult): Promise<KeyResult> {
    const [keyResult] = await db
      .insert(keyResults)
      .values(insertKeyResult as any)
      .returning();
    return keyResult;
  }

  async updateKeyResult(id: string, updateData: Partial<InsertKeyResult>): Promise<KeyResult> {
    const [keyResult] = await db
      .update(keyResults)
      .set(updateData as any)
      .where(eq(keyResults.id, id))
      .returning();
    return keyResult;
  }

  async deleteKeyResult(id: string): Promise<void> {
    // Delete associated big rocks first
    await db.delete(bigRocks).where(eq(bigRocks.keyResultId, id));
    // Delete the key result
    await db.delete(keyResults).where(eq(keyResults.id, id));
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
    // If quarter is 0, fetch only annual big rocks (quarter IS NULL or 0)
    if (quarter === 0 && year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          or(
            isNull(bigRocks.quarter),
            eq(bigRocks.quarter, 0)
          )
        )
      );
    }
    
    // If quarter and year provided, include both quarterly AND annual big rocks (treat both null and 0 as annual)
    if (quarter !== undefined && quarter > 0 && year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year),
          or(
            eq(bigRocks.quarter, quarter),
            isNull(bigRocks.quarter),
            eq(bigRocks.quarter, 0)
          )
        )
      );
    }
    
    // If only year provided, fetch all big rocks for that year
    if (year !== undefined) {
      return await db.select().from(bigRocks).where(
        and(
          eq(bigRocks.tenantId, tenantId),
          eq(bigRocks.year, year)
        )
      );
    }
    
    // No filters, return all
    return await db.select().from(bigRocks).where(eq(bigRocks.tenantId, tenantId));
  }

  async getBigRockById(id: string): Promise<BigRock | undefined> {
    const [bigRock] = await db.select().from(bigRocks).where(eq(bigRocks.id, id));
    return bigRock || undefined;
  }

  async getBigRocksByObjectiveId(objectiveId: string): Promise<BigRock[]> {
    return await db.select().from(bigRocks).where(eq(bigRocks.objectiveId, objectiveId));
  }

  async getBigRocksByKeyResultId(keyResultId: string): Promise<BigRock[]> {
    return await db.select().from(bigRocks).where(eq(bigRocks.keyResultId, keyResultId));
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
    return bigRock;
  }

  async deleteBigRock(id: string): Promise<void> {
    await db.delete(bigRocks).where(eq(bigRocks.id, id));
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
    // Get all objectives for the tenant and time period
    const allObjectives = await this.getObjectivesByTenantId(tenantId, quarter, year, level, teamId);
    
    // Define deterministic sort order for levels: organization → division → team → individual
    const levelOrder: Record<string, number> = {
      organization: 0,
      division: 1,
      team: 2,
      individual: 3,
    };
    
    // Extract leading numeric prefix from title (e.g., "1. Increase..." → 1, "2. Accelerate..." → 2)
    const extractNumericPrefix = (title: string): number | null => {
      const match = title.match(/^\s*(\d+)\./);
      return match ? parseInt(match[1], 10) : null;
    };
    
    // Sort function for objectives: numeric prefix FIRST (if present), then by level, then by title
    // This ensures "1. X", "2. Y", "3. Z" sort together regardless of their org level
    const sortObjectives = <T extends { level?: string | null; title: string }>(objs: T[]): T[] => {
      return [...objs].sort((a, b) => {
        // First: sort by numeric prefix if either has one
        const aPrefix = extractNumericPrefix(a.title || '');
        const bPrefix = extractNumericPrefix(b.title || '');
        
        if (aPrefix !== null && bPrefix !== null) {
          // Both have numeric prefixes - sort numerically
          return aPrefix - bPrefix;
        } else if (aPrefix !== null) {
          // Only a has prefix - it comes first
          return -1;
        } else if (bPrefix !== null) {
          // Only b has prefix - it comes first
          return 1;
        }
        
        // Neither has prefix - sort by level then alphabetically
        const levelDiff = (levelOrder[a.level || 'team'] ?? 4) - (levelOrder[b.level || 'team'] ?? 4);
        if (levelDiff !== 0) return levelDiff;
        
        return (a.title || '').localeCompare(b.title || '');
      });
    };
    
    // Create a set of all objective IDs in the filtered results
    const filteredObjectiveIds = new Set(allObjectives.map(obj => obj.id));
    
    // For each objective, get its key results and linked big rocks
    // Child objectives will be built from the allObjectives array for proper sorting
    const objectiveDataMap = new Map<string, { keyResults: KeyResult[]; linkedBigRocks: BigRock[]; latestCheckIn: CheckIn | undefined }>();
    
    // PERFORMANCE: Use batch queries to avoid N+1 problem
    // This fetches all data in 3 queries instead of N*3 queries
    const objectiveIds = allObjectives.map(obj => obj.id);
    const [keyResultsMap, linkedBigRocksMap, latestCheckInMap] = await Promise.all([
      this.getKeyResultsByObjectiveIds(objectiveIds),
      this.getBigRocksLinkedToObjectives(objectiveIds),
      this.getLatestCheckInsForEntities('objective', objectiveIds),
    ]);
    
    for (const objective of allObjectives) {
      objectiveDataMap.set(objective.id, {
        keyResults: keyResultsMap.get(objective.id) || [],
        linkedBigRocks: linkedBigRocksMap.get(objective.id) || [],
        latestCheckIn: latestCheckInMap.get(objective.id),
      });
    }
    
    // Build a map of parent -> sorted children from allObjectives
    const childrenByParentId = new Map<string, Objective[]>();
    for (const obj of allObjectives) {
      if (obj.parentId) {
        if (!childrenByParentId.has(obj.parentId)) {
          childrenByParentId.set(obj.parentId, []);
        }
        childrenByParentId.get(obj.parentId)!.push(obj);
      }
    }
    
    // Build a map of aligned objectives (objectives that "ladder up" to each objective)
    // These are objectives that have this objective in their alignedToObjectiveIds array
    const alignedChildrenByObjectiveId = new Map<string, Objective[]>();
    for (const obj of allObjectives) {
      const alignedToIds = (obj as any).alignedToObjectiveIds as string[] | null;
      if (alignedToIds && Array.isArray(alignedToIds)) {
        for (const alignedToId of alignedToIds) {
          if (!alignedChildrenByObjectiveId.has(alignedToId)) {
            alignedChildrenByObjectiveId.set(alignedToId, []);
          }
          alignedChildrenByObjectiveId.get(alignedToId)!.push(obj);
        }
      }
    }
    
    // Sort children for each parent
    for (const [parentId, children] of Array.from(childrenByParentId.entries())) {
      childrenByParentId.set(parentId, sortObjectives(children));
    }
    
    // Sort aligned children for each objective
    for (const [objectiveId, children] of Array.from(alignedChildrenByObjectiveId.entries())) {
      alignedChildrenByObjectiveId.set(objectiveId, sortObjectives(children));
    }
    
    // Recursive function to build enriched objective with sorted children
    const buildEnrichedObjective = (objective: Objective, processedIds: Set<string> = new Set()): Objective & {
      keyResults: KeyResult[];
      childObjectives: any[];
      alignedObjectives: any[]; // Objectives that "ladder up" to this one (virtual children)
      linkedBigRocks: BigRock[];
      lastUpdated: Date | null;
    } => {
      // Prevent infinite recursion by tracking processed objectives
      if (processedIds.has(objective.id)) {
        const data = objectiveDataMap.get(objective.id);
        return {
          ...objective,
          keyResults: data?.keyResults || [],
          childObjectives: [],
          alignedObjectives: [],
          linkedBigRocks: data?.linkedBigRocks || [],
          lastUpdated: data?.latestCheckIn?.createdAt || objective.updatedAt,
        };
      }
      processedIds.add(objective.id);
      
      const data = objectiveDataMap.get(objective.id);
      const children = childrenByParentId.get(objective.id) || [];
      const alignedChildren = alignedChildrenByObjectiveId.get(objective.id) || [];
      
      // Sort key results with numeric prefix awareness
      const sortedKeyResults = [...(data?.keyResults || [])].sort((a, b) => {
        const aPrefix = extractNumericPrefix(a.title || '');
        const bPrefix = extractNumericPrefix(b.title || '');
        
        if (aPrefix !== null && bPrefix !== null) {
          return aPrefix - bPrefix;
        } else if (aPrefix !== null) {
          return -1;
        } else if (bPrefix !== null) {
          return 1;
        }
        return (a.title || '').localeCompare(b.title || '');
      });
      
      return {
        ...objective,
        keyResults: sortedKeyResults,
        childObjectives: children.map(child => buildEnrichedObjective(child, new Set(processedIds))),
        alignedObjectives: alignedChildren.map(aligned => ({
          ...buildEnrichedObjective(aligned, new Set(processedIds)),
          isAligned: true, // Mark as aligned (virtual child) for UI differentiation
        })),
        linkedBigRocks: data?.linkedBigRocks || [],
        lastUpdated: data?.latestCheckIn?.createdAt || objective.updatedAt,
      };
    };

    // Filter to root-level objectives OR objectives whose parent is not in the filtered results
    // This ensures filtered objectives appear as "virtual roots" when their parent doesn't match the filter
    const rootObjectives = allObjectives.filter(obj => 
      !obj.parentId || !filteredObjectiveIds.has(obj.parentId)
    );
    
    // Sort root objectives and recursively build the tree with sorted children
    return sortObjectives(rootObjectives).map(obj => buildEnrichedObjective(obj));
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
  // BATCH QUERY METHODS - Performance optimizations
  // These methods fetch data for multiple entities in a single query
  // to avoid N+1 query problems
  // ============================================

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
      .where(inArray(keyResults.objectiveId, objectiveIds));
    
    // Group by objectiveId
    const resultMap = new Map<string, KeyResult[]>();
    for (const kr of allKeyResults) {
      if (!resultMap.has(kr.objectiveId)) {
        resultMap.set(kr.objectiveId, []);
      }
      resultMap.get(kr.objectiveId)!.push(kr);
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

    // Fetch full objects
    const objectivesList = objectiveIds.length > 0 
      ? await db.select().from(objectives).where(
          or(...objectiveIds.map(({ id }) => eq(objectives.id, id)))
        )
      : [];

    const strategiesList = strategyIds.length > 0
      ? await db.select().from(strategies).where(
          or(...strategyIds.map(({ id }) => eq(strategies.id, id)))
        )
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
}

export const storage = new DatabaseStorage();
