import { 
  users, type User, type InsertUser, 
  foundations, type Foundation, type InsertFoundation,
  strategies, type Strategy, type InsertStrategy,
  okrs, type Okr, type InsertOkr,
  kpis, type Kpi, type InsertKpi,
  rocks, type Rock, type InsertRock,
  meetings, type Meeting, type InsertMeeting
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./auth";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
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
}

export const storage = new DatabaseStorage();
