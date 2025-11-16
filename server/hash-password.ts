#!/usr/bin/env tsx
import { hashPassword } from "./auth";

async function hashMyPassword() {
  const password = process.argv[2];
  
  if (!password) {
    console.log("Usage: npx tsx server/hash-password.ts 'your-password-here'");
    process.exit(1);
  }
  
  try {
    const hash = await hashPassword(password);
    console.log("\n🔐 Bcrypt Hash:");
    console.log(hash);
    console.log("\n✅ You can use this hash in your database");
  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

hashMyPassword();