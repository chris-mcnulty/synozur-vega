import { db } from "./db";
import { tenants, foundations, strategies, okrs, kpis, rocks, meetings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Insert tenants
  await db.insert(tenants).values([
    {
      name: "Acme Corporation",
      color: "hsl(220, 85%, 38%)",
    },
    {
      name: "The Synozur Alliance LLC",
      color: "hsl(277, 98%, 53%)",
    },
    {
      name: "TechStart Inc",
      color: "hsl(328, 94%, 45%)",
    },
    {
      name: "Global Ventures",
      color: "hsl(200, 75%, 45%)",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded tenants");

  // Get Acme Corporation tenant ID
  const [acmeTenant] = await db.select().from(tenants).where(eq(tenants.name, "Acme Corporation"));
  
  if (!acmeTenant) {
    throw new Error("Acme Corporation tenant not found");
  }

  const acmeTenantId = acmeTenant.id;
  console.log(`Found Acme Corporation tenant with ID: ${acmeTenantId}`);

  // Insert Foundation
  await db.insert(foundations).values({
    tenantId: acmeTenantId,
    mission: "Empower organizations with AI-driven insights and transform strategy into actionable results",
    vision: "A world where every organization operates with clarity through data-driven decision-making at every level",
    values: [
      "Innovation",
      "Integrity",
      "Collaboration",
      "Excellence",
      "Customer Success"
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

  // Insert Strategies
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
    {
      tenantId: acmeTenantId,
      title: "Improve Customer Retention",
      description: "Implement customer success program to reduce churn",
      priority: "high",
      linkedGoals: ["Improve customer satisfaction"],
      status: "in-progress",
      owner: "Customer Success Team",
      timeline: "Q1 2025",
      updatedBy: "Alex Kim",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded strategies");

  // Insert OKRs
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
    {
      tenantId: acmeTenantId,
      objective: "Improve Customer Retention",
      progress: 72,
      linkedGoals: ["Improve customer satisfaction"],
      linkedStrategies: ["Improve Customer Retention"],
      keyResults: [
        "Reduce churn to <2%",
        "Increase NPS to 70+",
        "Launch loyalty program"
      ],
      department: "Customer Success",
      assignedTo: "Alex Kim",
      quarter: 1,
      year: 2025,
      updatedBy: "Alex Kim",
    },
    {
      tenantId: acmeTenantId,
      objective: "Scale Marketing Operations",
      progress: 58,
      linkedGoals: ["Expand to new markets", "Increase revenue by 30%"],
      linkedStrategies: ["Expand Market Presence"],
      keyResults: [
        "Generate 10K qualified leads",
        "Achieve 5% conversion rate",
        "Launch 3 campaigns"
      ],
      department: "Marketing",
      assignedTo: "Jordan Lee",
      quarter: 1,
      year: 2025,
      updatedBy: "Jordan Lee",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded OKRs");

  // Insert KPIs
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
    {
      tenantId: acmeTenantId,
      label: "Net Promoter Score",
      value: 68,
      change: 5,
      target: 70,
      linkedGoals: ["Improve customer satisfaction"],
      quarter: 1,
      year: 2025,
      updatedBy: "Customer Success Team",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded KPIs");

  // Insert Rocks
  await db.insert(rocks).values([
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
      title: "Hire 5 Engineers",
      status: "completed",
      linkedGoals: ["Build high-performing teams"],
      linkedStrategies: [],
      owner: "HR Team",
      quarter: 1,
      year: 2025,
      updatedBy: "HR Lead",
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
    {
      tenantId: acmeTenantId,
      title: "Integrate Payment Gateway",
      status: "completed",
      linkedGoals: ["Achieve operational excellence"],
      linkedStrategies: [],
      owner: "Engineering Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Engineering Lead",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded rocks");

  // Insert Meetings
  await db.insert(meetings).values([
    {
      tenantId: acmeTenantId,
      meetingType: "weekly",
      title: "Strategic Planning Review",
      date: new Date("2025-01-20T09:00:00Z"),
      attendees: ["Sarah Chen", "Michael Torres", "Alex Kim", "Jordan Lee", "Product Team", "Sales Team", "Engineering Team", "Customer Success Team"],
      summary: "Weekly review of strategic initiatives and OKR progress. Focus on Q1 2025 objectives and key results alignment.",
      decisions: [
        "Approved expansion into German market",
        "Allocated additional $50K budget for Q1 marketing",
        "Prioritized product redesign for Q1 completion"
      ],
      actionItems: [
        "Finalize Germany go-to-market plan by Jan 22 - Sarah Chen",
        "Schedule customer interviews in UK market - Michael Torres",
        "Complete product redesign mockups - Design Team"
      ],
      nextMeetingDate: new Date("2025-01-27T09:00:00Z"),
      updatedBy: "Sarah Chen",
    },
    {
      tenantId: acmeTenantId,
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

  console.log("✓ Seeded meetings");

  // Get The Synozur Alliance LLC tenant ID and seed the same data
  const [synozurTenant] = await db.select().from(tenants).where(eq(tenants.name, "The Synozur Alliance LLC"));
  
  if (!synozurTenant) {
    throw new Error("The Synozur Alliance LLC tenant not found");
  }

  const synozurTenantId = synozurTenant.id;
  console.log(`Found The Synozur Alliance LLC tenant with ID: ${synozurTenantId}`);

  // Insert Foundation for Synozur
  await db.insert(foundations).values({
    tenantId: synozurTenantId,
    mission: "Empower organizations with AI-driven insights and transform strategy into actionable results",
    vision: "A world where every organization operates with clarity through data-driven decision-making at every level",
    values: [
      "Innovation",
      "Integrity",
      "Collaboration",
      "Excellence",
      "Customer Success"
    ],
    annualGoals: [
      "Increase revenue by 30%",
      "Expand to new markets",
      "Improve customer satisfaction"
    ],
    fiscalYearStartMonth: 1,
    updatedBy: "System",
  }).onConflictDoNothing();

  console.log("✓ Seeded foundation for Synozur");

  // Insert Strategies for Synozur
  await db.insert(strategies).values([
    {
      tenantId: synozurTenantId,
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
      tenantId: synozurTenantId,
      title: "Expand Market Presence",
      description: "Enter three new geographic markets in EMEA region",
      priority: "high",
      linkedGoals: ["Expand to new markets", "Strengthen brand presence"],
      status: "in-progress",
      owner: "Sales Team",
      timeline: "2025",
      updatedBy: "Michael Torres",
    },
    {
      tenantId: synozurTenantId,
      title: "Improve Customer Retention",
      description: "Implement customer success program to reduce churn",
      priority: "high",
      linkedGoals: ["Improve customer satisfaction"],
      status: "in-progress",
      owner: "Customer Success Team",
      timeline: "Q1 2025",
      updatedBy: "Alex Kim",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded strategies for Synozur");

  // Insert OKRs for Synozur
  await db.insert(okrs).values([
    {
      tenantId: synozurTenantId,
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
      tenantId: synozurTenantId,
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
    {
      tenantId: synozurTenantId,
      objective: "Improve Customer Retention",
      progress: 72,
      linkedGoals: ["Improve customer satisfaction"],
      linkedStrategies: ["Improve Customer Retention"],
      keyResults: [
        "Reduce churn to <2%",
        "Increase NPS to 70+",
        "Launch loyalty program"
      ],
      department: "Customer Success",
      assignedTo: "Alex Kim",
      quarter: 1,
      year: 2025,
      updatedBy: "Alex Kim",
    },
    {
      tenantId: synozurTenantId,
      objective: "Scale Marketing Operations",
      progress: 58,
      linkedGoals: ["Expand to new markets", "Increase revenue by 30%"],
      linkedStrategies: ["Expand Market Presence"],
      keyResults: [
        "Generate 10K qualified leads",
        "Achieve 5% conversion rate",
        "Launch 3 campaigns"
      ],
      department: "Marketing",
      assignedTo: "Jordan Lee",
      quarter: 1,
      year: 2025,
      updatedBy: "Jordan Lee",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded OKRs for Synozur");

  // Insert KPIs for Synozur
  await db.insert(kpis).values([
    {
      tenantId: synozurTenantId,
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
      tenantId: synozurTenantId,
      label: "Customer Churn Rate",
      value: 23,
      change: -5,
      target: 20,
      linkedGoals: ["Improve customer satisfaction"],
      quarter: 1,
      year: 2025,
      updatedBy: "Customer Success Team",
    },
    {
      tenantId: synozurTenantId,
      label: "Net Promoter Score",
      value: 68,
      change: 5,
      target: 70,
      linkedGoals: ["Improve customer satisfaction"],
      quarter: 1,
      year: 2025,
      updatedBy: "Customer Success Team",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded KPIs for Synozur");

  // Insert Rocks for Synozur
  await db.insert(rocks).values([
    {
      tenantId: synozurTenantId,
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
      tenantId: synozurTenantId,
      title: "Hire 5 Engineers",
      status: "completed",
      linkedGoals: ["Build high-performing teams"],
      linkedStrategies: [],
      owner: "HR Team",
      quarter: 1,
      year: 2025,
      updatedBy: "HR Lead",
    },
    {
      tenantId: synozurTenantId,
      title: "Launch Marketing Campaign",
      status: "in-progress",
      linkedGoals: ["Expand to new markets"],
      linkedStrategies: ["Expand Market Presence"],
      owner: "Marketing Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Marketing Lead",
    },
    {
      tenantId: synozurTenantId,
      title: "Integrate Payment Gateway",
      status: "completed",
      linkedGoals: ["Achieve operational excellence"],
      linkedStrategies: [],
      owner: "Engineering Team",
      quarter: 1,
      year: 2025,
      updatedBy: "Engineering Lead",
    },
  ]).onConflictDoNothing();

  console.log("✓ Seeded rocks for Synozur");

  // Insert Meetings for Synozur
  await db.insert(meetings).values([
    {
      tenantId: synozurTenantId,
      meetingType: "weekly",
      title: "Strategic Planning Review",
      date: new Date("2025-01-20T09:00:00Z"),
      attendees: ["Sarah Chen", "Michael Torres", "Alex Kim", "Jordan Lee", "Product Team", "Sales Team", "Engineering Team", "Customer Success Team"],
      summary: "Weekly review of strategic initiatives and OKR progress. Focus on Q1 2025 objectives and key results alignment.",
      decisions: [
        "Approved expansion into German market",
        "Allocated additional $50K budget for Q1 marketing",
        "Prioritized product redesign for Q1 completion"
      ],
      actionItems: [
        "Finalize Germany go-to-market plan by Jan 22 - Sarah Chen",
        "Schedule customer interviews in UK market - Michael Torres",
        "Complete product redesign mockups - Design Team"
      ],
      nextMeetingDate: new Date("2025-01-27T09:00:00Z"),
      updatedBy: "Sarah Chen",
    },
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
  process.exit(0);
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
