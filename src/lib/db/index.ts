import { drizzle } from "drizzle-orm/neon-http";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazy initialization to avoid build-time errors
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlInstance: NeonQueryFunction<false, false> | null = null;

function getDb() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
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

export * from "./schema";
