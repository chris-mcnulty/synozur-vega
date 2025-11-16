#!/usr/bin/env tsx
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users, tenants } from "@/shared/schema";
import { hashPassword } from "./auth";
import * as readline from 'readline';

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
};

async function createFirstAdmin() {
  console.log("=== Vega Admin Creation Script ===\n");
  console.log("This script will create the first Vega Administrator in production.\n");

  try {
    // Get database connection from environment
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);

    // Check if any admin already exists
    const existingAdmins = await db
      .select()
      .from(users)
      .where(sql`${users.role} = 'vega_admin'`)
      .limit(1);

    if (existingAdmins.length > 0) {
      console.log("⚠️  A Vega Admin already exists in the system.");
      const continueAnyway = await question("Do you want to create another admin? (yes/no): ");
      
      if (continueAnyway.toLowerCase() !== 'yes') {
        console.log("\nExiting without creating a new admin.");
        rl.close();
        return;
      }
    }

    // Get admin details
    console.log("\nPlease provide the admin details:\n");
    
    const email = await question("Email address: ");
    const name = await question("Full name: ");
    const password = await question("Password (min 8 characters): ");

    // Validate inputs
    if (!email.includes("@")) {
      throw new Error("Invalid email address");
    }
    
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`${users.email} = ${email}`)
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("A user with this email already exists");
    }

    // Optionally create a tenant for the admin
    const createTenant = await question("\nCreate a default tenant for this admin? (yes/no): ");
    
    let tenantId: string | null = null;
    
    if (createTenant.toLowerCase() === 'yes') {
      const tenantName = await question("Tenant name: ");
      const tenantColor = await question("Tenant color (hex, e.g., #3B82F6): ") || "#3B82F6";
      
      // Extract domain from admin email for allowed domains
      const emailDomain = email.split('@')[1];
      
      // Create tenant
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: tenantName,
          color: tenantColor,
          allowedDomains: [emailDomain]
        })
        .returning({ id: tenants.id });
        
      tenantId = newTenant.id;
      console.log(`\n✅ Tenant "${tenantName}" created`);
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the admin user
    const [newAdmin] = await db
      .insert(users)
      .values({
        email,
        name,
        password: hashedPassword,
        role: 'vega_admin',
        tenantId
      })
      .returning({ 
        id: users.id, 
        email: users.email, 
        name: users.name,
        role: users.role 
      });

    console.log("\n✅ Vega Administrator created successfully!");
    console.log("\nAdmin Details:");
    console.log("-------------");
    console.log(`ID: ${newAdmin.id}`);
    console.log(`Email: ${newAdmin.email}`);
    console.log(`Name: ${newAdmin.name}`);
    console.log(`Role: ${newAdmin.role}`);
    if (tenantId) {
      console.log(`Tenant ID: ${tenantId}`);
    }
    
    console.log("\n🔐 You can now login with these credentials at /login");
    console.log("\n⚠️  Important: Store the password securely. It cannot be recovered.");
    
  } catch (error) {
    console.error("\n❌ Error creating admin:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createFirstAdmin().catch(console.error);