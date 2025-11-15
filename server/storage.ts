import { users, type User, type InsertUser, foundations, type Foundation, type InsertFoundation } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getFoundationByTenantId(tenantId: string): Promise<Foundation | undefined>;
  upsertFoundation(foundation: InsertFoundation): Promise<Foundation>;
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
}

export const storage = new DatabaseStorage();
