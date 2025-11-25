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
  groundingDocuments, type GroundingDocument, type InsertGroundingDocument
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, isNull } from "drizzle-orm";
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
  getTeamByName(tenantId: string, name: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  getObjectiveById(id: string): Promise<Objective | undefined>;
  getChildObjectives(parentId: string): Promise<Objective[]>;
  createObjective(objective: InsertObjective): Promise<Objective>;
  updateObjective(id: string, objective: Partial<InsertObjective>): Promise<Objective>;
  deleteObjective(id: string): Promise<void>;
  
  getKeyResultsByObjectiveId(objectiveId: string): Promise<KeyResult[]>;
  getKeyResultById(id: string): Promise<KeyResult | undefined>;
  createKeyResult(keyResult: InsertKeyResult): Promise<KeyResult>;
  updateKeyResult(id: string, keyResult: Partial<InsertKeyResult>): Promise<KeyResult>;
  deleteKeyResult(id: string): Promise<void>;
  promoteKeyResultToKpi(keyResultId: string, userId: string): Promise<Kpi>;
  unpromoteKeyResultFromKpi(keyResultId: string): Promise<KeyResult>;
  
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
  getObjectiveHierarchy(tenantId: string, quarter?: number, year?: number): Promise<any[]>;
  
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
  getActiveGroundingDocuments(): Promise<GroundingDocument[]>;
  getGroundingDocumentById(id: string): Promise<GroundingDocument | undefined>;
  createGroundingDocument(document: InsertGroundingDocument): Promise<GroundingDocument>;
  updateGroundingDocument(id: string, document: Partial<InsertGroundingDocument>): Promise<GroundingDocument>;
  deleteGroundingDocument(id: string): Promise<void>;
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

  async getKeyResultsByObjectiveId(objectiveId: string): Promise<KeyResult[]> {
    return await db.select().from(keyResults).where(eq(keyResults.objectiveId, objectiveId));
  }

  async getKeyResultById(id: string): Promise<KeyResult | undefined> {
    const [keyResult] = await db.select().from(keyResults).where(eq(keyResults.id, id));
    return keyResult || undefined;
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

  async getObjectiveHierarchy(tenantId: string, quarter?: number, year?: number): Promise<any[]> {
    // Get all objectives for the tenant and time period
    const allObjectives = await this.getObjectivesByTenantId(tenantId, quarter, year);
    
    // Build a map of objectives by ID for quick lookup
    const objectiveMap = new Map(allObjectives.map(obj => [obj.id, obj]));
    
    // For each objective, get its key results, child objectives, and linked big rocks
    const enrichedObjectives = await Promise.all(
      allObjectives.map(async (objective) => {
        const [keyResults, childObjectives, linkedBigRocks, latestCheckIn] = await Promise.all([
          this.getKeyResultsByObjectiveId(objective.id),
          this.getChildObjectives(objective.id),
          this.getBigRocksLinkedToObjective(objective.id),
          this.getLatestCheckIn('objective', objective.id),
        ]);

        return {
          ...objective,
          keyResults,
          childObjectives,
          linkedBigRocks,
          lastUpdated: latestCheckIn?.createdAt || objective.updatedAt,
        };
      })
    );

    // Filter to only root-level objectives (no parent)
    return enrichedObjectives.filter(obj => !obj.parentId);
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
    // Direct SQL insert since importHistory table is not in schema yet
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
  }

  async getImportHistory(tenantId: string): Promise<any[]> {
    const results = await db.execute(sql`
      SELECT * FROM import_history
      WHERE tenant_id = ${tenantId}
      ORDER BY imported_at DESC
      LIMIT 50
    `);
    return results.rows || [];
  }

  // Grounding documents methods (for AI context)
  async getAllGroundingDocuments(): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .orderBy(desc(groundingDocuments.priority), groundingDocuments.category);
  }

  async getActiveGroundingDocuments(): Promise<GroundingDocument[]> {
    return await db
      .select()
      .from(groundingDocuments)
      .where(eq(groundingDocuments.isActive, true))
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
}

export const storage = new DatabaseStorage();
