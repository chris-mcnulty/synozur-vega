import { db } from "./db";
import { tenants, foundations, strategies, okrs, kpis, meetings, users, big_rocks } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

/**
 * Initialize database with essential admin users and optionally seed demo data.
 * This runs automatically on server startup.
 */
export async function initializeDatabase() {
  try {
    // Always ensure global admin users exist (safe with existing data)
    await ensureGlobalAdmins();

    // Check if database is completely empty - if so, seed demo data
    const existingTenants = await db.select().from(tenants).limit(1);
    
    if (existingTenants.length === 0) {
      console.log("Empty database detected. Initializing with seed data...");
      await seedDatabase();
      console.log("✓ Database initialization complete");
    }
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

/**
 * Ensure global admin users exist with correct credentials.
 * Safe to run on existing databases - upserts users with current password and role.
 * Global admins are not tied to any specific tenant (tenantId = null).
 */
async function ensureGlobalAdmins() {
  try {
    console.log("Ensuring global admin users...");
    
    // Hash the admin password once
    const hashedPassword = await hashPassword("NorthStar2025!");
    
    // Upsert consultant@synozur.com (global consultant - no tenant)
    const consultantResult = await db
      .insert(users)
      .values({
        email: "consultant@synozur.com",
        password: hashedPassword,
        name: "Synozur Consultant",
        role: "vega_consultant",
        tenantId: null, // Global user - not tied to specific tenant
        emailVerified: true, // Pre-verified admin account
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: hashedPassword,
          role: "vega_consultant",
          tenantId: null,
          name: "Synozur Consultant",
          emailVerified: true, // Ensure always verified
        },
      })
      .returning();
    console.log("  ✓ Verified consultant@synozur.com", consultantResult.length > 0 ? "(updated/created)" : "(no change)");
    
    // Upsert superadmin@vega.com (global admin - no tenant)
    const superadminResult = await db
      .insert(users)
      .values({
        email: "superadmin@vega.com",
        password: hashedPassword,
        name: "Vega Administrator",
        role: "vega_admin",
        tenantId: null, // Global user - not tied to specific tenant
        emailVerified: true, // Pre-verified admin account
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: hashedPassword,
          role: "vega_admin",
          tenantId: null,
          name: "Vega Administrator",
          emailVerified: true, // Ensure always verified
        },
      })
      .returning();
    console.log("  ✓ Verified superadmin@vega.com", superadminResult.length > 0 ? "(updated/created)" : "(no change)");

    // Verify users were created by querying them back
    const verifyConsultant = await db.select().from(users).where(eq(users.email, "consultant@synozur.com")).limit(1);
    const verifySuperadmin = await db.select().from(users).where(eq(users.email, "superadmin@vega.com")).limit(1);
    
    if (verifyConsultant.length === 0 || verifySuperadmin.length === 0) {
      console.error("⚠️ WARNING: Admin users not found in database after initialization!");
      console.error(`  consultant@synozur.com: ${verifyConsultant.length > 0 ? 'EXISTS' : 'MISSING'}`);
      console.error(`  superadmin@vega.com: ${verifySuperadmin.length > 0 ? 'EXISTS' : 'MISSING'}`);
    } else {
      console.log("✓ Global admin users initialized and verified in database");
    }
  } catch (error) {
    console.error("❌ Error ensuring global admins:", error);
    console.error("   Database initialization may have failed - check production database connection");
  }
}

/**
 * Seed database with demo data.
 * Can be called during initialization or manually via npm run db:seed
 */
export async function seedDatabase() {
  console.log("Seeding database...");

  // Insert tenants with explicit IDs and allowed domains
  await db.insert(tenants).values([
    {
      id: "f7229583-c9c9-4e80-88cf-5bbfd2819770",
      name: "Acme Corporation",
      color: "#3B82F6",
      allowedDomains: ["acme.com", "acme.org"],
    },
    {
      id: "f328cd4e-0fe1-4893-a637-941684749c55",
      name: "The Synozur Alliance LLC",
      color: "#810FFB",
      allowedDomains: ["synozur.com", "synozuralliance.com"],
    },
    {
      id: "33c48024-917b-4045-a1ef-0542c2da57ca",
      name: "TechStart Inc",
      color: "#E60CB3",
      allowedDomains: ["techstart.io", "techstart.com"],
    },
    {
      id: "f689f005-63ff-40d8-ac04-79e476615c9b",
      name: "Global Ventures",
      color: "#06B6D4",
      allowedDomains: ["globalventures.com", "gv.com"],
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded tenants");

  // Use explicit tenant IDs
  const acmeTenantId = "f7229583-c9c9-4e80-88cf-5bbfd2819770";
  const synozurTenantId = "f328cd4e-0fe1-4893-a637-941684749c55";

  // Create demo users for each tenant
  const demoPassword = "demo123";
  
  await db.insert(users).values([
    {
      email: "demo@acme.com",
      password: await hashPassword(demoPassword),
      name: "Bob Smith",
      role: "tenant_user",
      tenantId: acmeTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "admin@acme.com",
      password: await hashPassword("admin123"),
      name: "Acme Admin",
      role: "tenant_admin",
      tenantId: acmeTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "consultant@synozur.com",
      password: await hashPassword("consultant123"),
      name: "Synozur Consultant",
      role: "vega_consultant",
      tenantId: synozurTenantId,
      emailVerified: true,
      verificationToken: null,
    },
    {
      email: "superadmin@vega.com",
      password: await hashPassword("vega123"),
      name: "Vega Administrator",
      role: "vega_admin",
      tenantId: null,
      emailVerified: true,
      verificationToken: null,
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded users");

  // Insert Foundation for Acme
  await db.insert(foundations).values({
    tenantId: acmeTenantId,
    mission: "Empower organizations with AI-driven insights and transform strategy into actionable results",
    vision: "A world where every organization operates with clarity through data-driven decision-making at every level",
    values: [
      { title: "Innovation", description: "We embrace new ideas and continuously improve through creative problem-solving" },
      { title: "Integrity", description: "We act with honesty and transparency in everything we do" },
      { title: "Collaboration", description: "We work together to achieve shared goals and mutual success" },
      { title: "Excellence", description: "We strive for the highest quality in our products and services" },
      { title: "Customer Success", description: "We prioritize our customers' needs and help them achieve their goals" }
    ],
    annualGoals: [
      "Increase revenue by 30%",
      "Expand to new markets",
      "Improve customer satisfaction"
    ],
    fiscalYearStartMonth: 1,
    updatedBy: "System",
  }).onConflictDoNothing();

  console.log("✓ Seeded foundation");

  // Insert Strategies for Acme
  await db.insert(strategies).values([
    {
      tenantId: acmeTenantId,
      title: "Launch New Product Line",
      description: "Develop and launch innovative AI-powered analytics suite",
      priority: "critical",
      linkedGoals: ["Launch innovative products", "Increase revenue by 30%"],
      status: "in-progress",
      owner: "Product Team",
      timeline: "Q1-Q2 2025",
      updatedBy: "Sarah Chen",
    },
    {
      tenantId: acmeTenantId,
      title: "Expand Market Presence",
      description: "Enter three new geographic markets in EMEA region",
      priority: "high",
      linkedGoals: ["Expand to new markets", "Strengthen brand presence"],
      status: "in-progress",
      owner: "Sales Team",
      timeline: "2025",
      updatedBy: "Michael Torres",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded strategies");

  // Insert OKRs for Acme
  await db.insert(okrs).values([
    {
      tenantId: acmeTenantId,
      objective: "Increase Market Share",
      progress: 65,
      linkedGoals: ["Increase revenue by 30%", "Expand to new markets"],
      linkedStrategies: ["Expand Market Presence"],
      keyResults: [
        "Acquire 500 new customers",
        "Achieve 95% customer satisfaction",
        "Launch in 3 new markets"
      ],
      department: "Sales",
      assignedTo: "Sarah Chen",
      quarter: 1,
      year: 2025,
      updatedBy: "Sarah Chen",
    },
    {
      tenantId: acmeTenantId,
      objective: "Build World-Class Product",
      progress: 45,
      linkedGoals: ["Launch innovative products", "Achieve operational excellence"],
      linkedStrategies: ["Launch New Product Line"],
      keyResults: [
        "Ship 5 major features",
        "Reduce bugs by 50%",
        "Improve performance by 30%"
      ],
      department: "Engineering",
      assignedTo: "Michael Torres",
      quarter: 1,
      year: 2025,
      updatedBy: "Michael Torres",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded OKRs");

  // Insert KPIs for Acme
  await db.insert(kpis).values([
    {
      tenantId: acmeTenantId,
      label: "Monthly Recurring Revenue",
      value: 285000,
      change: 12,
      target: 300000,
      linkedGoals: ["Increase revenue by 30%"],
      quarter: 1,
      year: 2025,
      updatedBy: "Finance Team",
    },
    {
      tenantId: acmeTenantId,
      label: "Customer Churn Rate",
      value: 23,
      change: -5,
      target: 20,
      linkedGoals: ["Improve customer satisfaction"],
      quarter: 1,
      year: 2025,
      updatedBy: "Customer Success Team",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded KPIs");

  // Insert Rocks (Big Rocks) for Acme
  await db.insert(big_rocks).values([
    {
      tenantId: acmeTenantId,
      title: "Complete Product Redesign",
      status: "in-progress",
      linkedGoals: ["Launch innovative products"],
      linkedStrategies: ["Launch New Product Line"],
      owner: "Design Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Design Lead",
    },
    {
      tenantId: acmeTenantId,
      title: "Launch Marketing Campaign",
      status: "in-progress",
      linkedGoals: ["Expand to new markets"],
      linkedStrategies: ["Expand Market Presence"],
      owner: "Marketing Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Marketing Lead",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded big rocks");

  // Insert Meetings for Acme
  await db.insert(meetings).values([
    {
      tenantId: acmeTenantId,
      meetingType: "quarterly",
      title: "Q1 Strategic Planning",
      date: new Date("2025-01-15T10:00:00Z"),
      attendees: ["Executive Team", "Department Heads", "Product Team", "Sales Team"],
      summary: "Reviewed Q1 objectives and key results. Discussed product launch timeline and market expansion plans.",
      decisions: [
        "Approved Q1 budget allocation",
        "Greenlit AI Analytics Platform launch for March",
        "Decided to prioritize EMEA market expansion"
      ],
      actionItems: [
        "Finalize product roadmap by Jan 20 - Product Team",
        "Complete hiring plan for sales team - HR",
        "Schedule customer interviews in UK market - Sales Team"
      ],
      nextMeetingDate: new Date("2025-04-15T10:00:00Z"),
      updatedBy: "Executive Team",
    },
    {
      tenantId: acmeTenantId,
      meetingType: "weekly",
      title: "Weekly Leadership Sync",
      date: new Date("2025-01-20T09:00:00Z"),
      attendees: ["Sarah Chen", "Michael Torres", "Tech Lead", "Marketing Director"],
      summary: "Progress update on Q1 initiatives. Product team reported 75% completion on MVP. Sales pipeline growing steadily.",
      decisions: [
        "Moved beta launch date to Feb 15",
        "Approved additional marketing budget",
        "Decided to add two more customer success representatives"
      ],
      actionItems: [
        "Complete final UI polish by Feb 1 - Product Team",
        "Launch beta signup page - Marketing Team",
        "Schedule customer interviews in UK market - Michael Torres",
        "Complete product redesign mockups - Design Team"
      ],
      nextMeetingDate: new Date("2025-01-27T09:00:00Z"),
      updatedBy: "Sarah Chen",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded meetings for Acme");

  // Insert Foundation for Synozur
  await db.insert(foundations).values({
    tenantId: synozurTenantId,
    mission: "Transform organizations through strategic consulting and innovative technology solutions",
    vision: "Become the trusted partner for organizational excellence and digital transformation",
    values: [
      { title: "Client Success", description: "We measure our success by our clients' achievements and growth" },
      { title: "Innovation", description: "We bring fresh thinking and creative solutions to every challenge" },
      { title: "Expertise", description: "We deliver deep knowledge and proven methodologies to drive results" },
      { title: "Integrity", description: "We build trust through honest communication and ethical practices" },
      { title: "Partnership", description: "We collaborate closely with clients as trusted long-term partners" }
    ],
    annualGoals: [
      "Grow client portfolio by 40%",
      "Launch new consulting service lines",
      "Achieve 95% client satisfaction"
    ],
    fiscalYearStartMonth: 1,
    updatedBy: "System",
  }).onConflictDoNothing();

  console.log("✓ Seeded foundation for Synozur");

  // Insert Meetings for Synozur
  await db.insert(meetings).values([
    {
      tenantId: synozurTenantId,
      meetingType: "weekly",
      title: "Weekly Team Sync",
      date: new Date("2025-01-22T14:00:00Z"),
      attendees: ["Engineering Team", "Product Team", "QA Team", "Design Team"],
      summary: "Engineering and product team sync covering sprint progress, bug triage, and customer feedback review.",
      decisions: [
        "Approved feature scope for next sprint",
        "Decision to focus on performance improvements",
        "Prioritized bug fixes for production release"
      ],
      actionItems: [
        "Complete performance profiling by Jan 20 - Engineering Lead",
        "Schedule design review for new dashboard - Product Manager",
        "Deploy bug fixes to production - DevOps Team"
      ],
      nextMeetingDate: new Date("2025-01-29T14:00:00Z"),
      updatedBy: "Alex Kim",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded meetings for Synozur");
  console.log("Database seeding complete!");
}
