import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./auth";

async function seedAdminUsers() {
  console.log("Creating admin users...");

  try {
    // Hash the passwords securely
    const chrisPasswordHash = await hashPassword("East2west!");
    const adminPasswordHash = await hashPassword("admin123");

    // Create Chris McNulty admin account
    const chrisUser = await db
      .insert(users)
      .values({
        email: "chris.mcnulty@synozur.com",
        username: "chris.mcnulty",
        password: chrisPasswordHash,
        role: "global_admin",
        tenantId: null, // Global admin doesn't belong to specific tenant
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: chrisPasswordHash,
          role: "global_admin",
          username: "chris.mcnulty",
        },
      })
      .returning();

    console.log("✅ Created/updated user: chris.mcnulty@synozur.com (global_admin)");

    // Create generic admin account
    const adminUser = await db
      .insert(users)
      .values({
        email: "admin@synozur.com",
        username: "admin",
        password: adminPasswordHash,
        role: "global_admin",
        tenantId: null, // Global admin doesn't belong to specific tenant
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          password: adminPasswordHash,
          role: "global_admin",
          username: "admin",
        },
      })
      .returning();

    console.log("✅ Created/updated user: admin@synozur.com (global_admin)");

    console.log("\n🔐 Admin accounts ready:");
    console.log("1. chris.mcnulty@synozur.com / East2west!");
    console.log("2. admin@synozur.com / admin123");
    console.log("\n⚠️  Security Note: Please change these passwords after first login!");

  } catch (error) {
    console.error("❌ Error creating admin users:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedAdminUsers();