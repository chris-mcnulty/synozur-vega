import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// PERFORMANCE: Configure connection pool for optimal performance and stability
// - max: Maximum connections (Neon serverless handles this efficiently)
// - idleTimeoutMillis: Close idle connections after 30 seconds
// - connectionTimeoutMillis: Fail fast if connection takes too long
// - maxUses: Recycle connections after 7500 uses to prevent memory leaks
// - allowExitOnIdle: Allow process to exit when pool is idle
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout of 10s
  maxUses: 7500, // Recycle connections to prevent memory leaks
  allowExitOnIdle: true, // Allow graceful shutdown
});

// STABILITY: Handle pool errors to prevent unhandled exceptions
pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected error on idle client:', err);
  // Don't crash the process - the pool will handle reconnection
});

// STABILITY: Log when connections are acquired (debug only)
if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    console.log('[Database Pool] New connection established');
  });
}

export const db = drizzle({ client: pool, schema });

// STABILITY: Graceful shutdown helper
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('[Database Pool] Pool closed successfully');
  } catch (error) {
    console.error('[Database Pool] Error closing pool:', error);
  }
}
