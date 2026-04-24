#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { searchHashnode } from "@/lib/inngest/functions/monitor-hashnode";

async function main() {
  console.log("=== Hashnode ===");
  const cases: Array<{ label: string; kws: string[] }> = [
    { label: "anthropic", kws: ["Anthropic Claude", "Claude API", "claude.ai"] },
    { label: "copilot", kws: ["GitHub Copilot", "Copilot"] },
    { label: "general-ai", kws: ["ai", "llm"] },
  ];
  for (const c of cases) {
    try {
      const r = await searchHashnode(c.kws, 30);
      console.log(`  ${c.label} (${c.kws.join(",")}): ${r.length} articles`);
      r.slice(0, 2).forEach((a) => console.log(`    • ${a.title?.slice(0, 70)}`));
    } catch (e) {
      console.log(`  ${c.label}: ERR ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n=== IndieHackers Serper ===");
  const apiKey = process.env.SERPER_API_KEY!;
  const ihCases = [
    { label: "copilot", q: 'site:indiehackers.com "Copilot"' },
    { label: "claude", q: 'site:indiehackers.com "Claude"' },
    { label: "saas", q: 'site:indiehackers.com "SaaS"' },
  ];
  for (const c of ihCases) {
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: c.q, num: 10 }),
    });
    const d = await r.json();
    const hits = (d.organic || []).filter((h: { link: string }) => h.link.includes("indiehackers.com"));
    console.log(`  ${c.label}: ${hits.length} IH results`);
    hits.slice(0, 2).forEach((h: { title: string }) => console.log(`    • ${h.title?.slice(0, 70)}`));
  }

  console.log("\n=== IH JSON feed ===");
  try {
    const fr = await fetch("https://www.indiehackers.com/feed.json", { headers: { "User-Agent": "Kaulby/1.0" } });
    const fd = await fr.json();
    const items = fd.items || [];
    console.log(`  feed items: ${items.length}`);
  } catch (e) {
    console.log(`  feed err: ${e instanceof Error ? e.message : e}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
