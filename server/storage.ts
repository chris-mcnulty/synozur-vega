import { 
  users, type User, type InsertUser,
  tenants, type Tenant, type InsertTenant,
  foundations, type Foundation, type InsertFoundation,
  strategies, type Strategy, type InsertStrategy,
  okrs, type Okr, type InsertOkr,
  kpis, type Kpi, type InsertKpi,
  rocks, type Rock, type InsertRock,
  meetings, type Meeting, type InsertMeeting,
  objectives, type Objective, type InsertObjective,
  keyResults, type KeyResult, type InsertKeyResult,
  bigRocks, type BigRock, type InsertBigRock,
  checkIns, type CheckIn, type InsertCheckIn
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
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
  
  getRocksByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Rock[]>;
  getRockById(id: string): Promise<Rock | undefined>;
  createRock(rock: InsertRock): Promise<Rock>;
  updateRock(id: string, rock: Partial<InsertRock>): Promise<Rock>;
  deleteRock(id: string): Promise<void>;
  
  getMeetingsByTenantId(tenantId: string): Promise<Meeting[]>;
  getMeetingById(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  
  // Enhanced OKR Methods
  getObjectivesByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Objective[]>;
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
  
  getCheckInsByEntityId(entityType: string, entityId: string): Promise<CheckIn[]>;
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getLatestCheckIn(entityType: string, entityId: string): Promise<CheckIn | undefined>;
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
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
  }

  async updateTenant(id: string, updateData: Partial<InsertTenant>): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set(updateData)
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

  async getRocksByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Rock[]> {
    const conditions = [eq(rocks.tenantId, tenantId)];
    if (quarter !== undefined) conditions.push(eq(rocks.quarter, quarter));
    if (year !== undefined) conditions.push(eq(rocks.year, year));
    return await db.select().from(rocks).where(and(...conditions));
  }

  async getRockById(id: string): Promise<Rock | undefined> {
    const [rock] = await db.select().from(rocks).where(eq(rocks.id, id));
    return rock || undefined;
  }

  async createRock(insertRock: InsertRock): Promise<Rock> {
    const [rock] = await db
      .insert(rocks)
      .values({
        ...insertRock,
        linkedGoals: insertRock.linkedGoals ? [...insertRock.linkedGoals] : null,
        linkedStrategies: insertRock.linkedStrategies ? [...insertRock.linkedStrategies] : null,
      })
      .returning();
    return rock;
  }

  async updateRock(id: string, updateData: Partial<InsertRock>): Promise<Rock> {
    const [rock] = await db
      .update(rocks)
      .set({
        ...updateData,
        linkedGoals: updateData.linkedGoals ? [...updateData.linkedGoals] : undefined,
        linkedStrategies: updateData.linkedStrategies ? [...updateData.linkedStrategies] : undefined,
      })
      .where(eq(rocks.id, id))
      .returning();
    return rock;
  }

  async deleteRock(id: string): Promise<void> {
    await db.delete(rocks).where(eq(rocks.id, id));
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
      })
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
      })
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Enhanced OKR Method Implementations
  async getObjectivesByTenantId(tenantId: string, quarter?: number, year?: number): Promise<Objective[]> {
    let query = db.select().from(objectives).where(eq(objectives.tenantId, tenantId));
    
    if (quarter !== undefined && year !== undefined) {
      query = query.where(and(
        eq(objectives.tenantId, tenantId),
        eq(objectives.quarter, quarter),
        eq(objectives.year, year)
      ));
    }
    
    return await query;
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
      })
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
      })
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
      .values(insertKeyResult)
      .returning();
    return keyResult;
  }

  async updateKeyResult(id: string, updateData: Partial<InsertKeyResult>): Promise<KeyResult> {
    const [keyResult] = await db
      .update(keyResults)
      .set(updateData)
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
    let query = db.select().from(bigRocks).where(eq(bigRocks.tenantId, tenantId));
    
    if (quarter !== undefined && year !== undefined) {
      query = query.where(and(
        eq(bigRocks.tenantId, tenantId),
        eq(bigRocks.quarter, quarter),
        eq(bigRocks.year, year)
      ));
    }
    
    return await query;
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
      })
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
      })
      .where(eq(bigRocks.id, id))
      .returning();
    return bigRock;
  }

  async deleteBigRock(id: string): Promise<void> {
    await db.delete(bigRocks).where(eq(bigRocks.id, id));
  }

  async getCheckInsByEntityId(entityType: string, entityId: string): Promise<CheckIn[]> {
    return await db
      .select()
      .from(checkIns)
      .where(and(
        eq(checkIns.entityType, entityType),
        eq(checkIns.entityId, entityId)
      ));
  }

  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db
      .insert(checkIns)
      .values({
        ...insertCheckIn,
        achievements: insertCheckIn.achievements ? [...insertCheckIn.achievements] : null,
        challenges: insertCheckIn.challenges ? [...insertCheckIn.challenges] : null,
        nextSteps: insertCheckIn.nextSteps ? [...insertCheckIn.nextSteps] : null,
      })
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
      .orderBy(checkIns.createdAt)
      .limit(1);
    return checkIn || undefined;
  }
}

export const storage = new DatabaseStorage();
