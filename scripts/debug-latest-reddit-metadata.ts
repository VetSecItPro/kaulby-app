#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { and, eq, desc, like, gte, sql } from "drizzle-orm";

async function main() {
  const fifteenMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  // subreddit + count from metadata for recent reddit results
  const rows = await db.execute(sql`
    select m.name, r.metadata->>'subreddit' as sub, count(*) as c
    from results r
    join monitors m on m.id = r.monitor_id
    where r.platform = 'reddit'
      and r.created_at > ${fifteenMinAgo}
      and m.name like '[PLATFORM-TEST]%'
    group by m.name, r.metadata->>'subreddit'
    order by m.name, count(*) desc
  `);
  console.log("reddit results last 30 min by test monitor / subreddit:");
  for (const r of rows.rows) {
    console.log(` ${r.name} | r/${r.sub} → ${r.c}`);
  }

  // Also count which subreddits got scanned (per monitor) via metadata source
  const srcs = await db.execute(sql`
    select m.name, r.metadata->>'source' as src, count(*) as c
    from results r
    join monitors m on m.id = r.monitor_id
    where r.platform = 'reddit'
      and r.created_at > ${fifteenMinAgo}
      and m.name like '[PLATFORM-TEST]%'
    group by m.name, r.metadata->>'source'
  `);
  console.log("\nsource breakdown:");
  for (const r of srcs.rows) {
    console.log(` ${r.name} | source=${r.src} count=${r.c}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
