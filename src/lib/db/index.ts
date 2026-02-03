import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { neon, neonConfig, Pool, type NeonQueryFunction } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// HTTP driver (stateless, for serverless API routes / server components)
// ---------------------------------------------------------------------------

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlInstance: NeonQueryFunction<false, false> | null = null;

function getDb() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    // TODO(FIX-114): Database connection does not explicitly enforce SSL. Consider adding sslmode=require to connection string for production.
    sqlInstance = neon(process.env.DATABASE_URL);
    dbInstance = drizzle(sqlInstance, { schema });
  }
  return dbInstance;
}

// Proxy to enable lazy initialization while maintaining API compatibility
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof typeof dbInstance];
  },
});

// ---------------------------------------------------------------------------
// WebSocket pooled driver (persistent connections, for Inngest batch operations)
//
// Use `pooledDb` in Inngest functions that issue 10-50+ sequential queries.
// The pool reuses connections, eliminating per-query TLS handshakes.
// Falls back to the HTTP driver if Pool creation fails.
// ---------------------------------------------------------------------------

let pooledDbInstance: ReturnType<typeof drizzleWs<typeof schema>> | null = null;

function getPooledDb() {
  if (!pooledDbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    // ws is required for Node.js environments (Inngest runs in Node, not Edge)
    neonConfig.webSocketConstructor = ws;

    // TODO(FIX-114): Pooled database connection does not explicitly enforce SSL. Consider adding sslmode=require to connection string for production.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pooledDbInstance = drizzleWs(pool, { schema });
  }
  return pooledDbInstance;
}

export const pooledDb = new Proxy({} as ReturnType<typeof drizzleWs<typeof schema>>, {
  get(_, prop) {
    return getPooledDb()[prop as keyof typeof pooledDbInstance];
  },
});

export * from "./schema";
