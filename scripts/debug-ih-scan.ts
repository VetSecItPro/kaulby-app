#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { includesTokenized } from "@/lib/content-matcher";

async function main() {
  const companyName = "GitHub Copilot";
  const keywords = ["GitHub Copilot", "Copilot"];
  const apiKey = process.env.SERPER_API_KEY!;

  // Exact same Serper flow as scan-on-demand's IH path
  const searchTerms = keywords.slice(0, 3);
  const posts: Array<{ url: string; title: string; content_text: string }> = [];

  for (const term of searchTerms) {
    const query = `site:indiehackers.com "${term}"`;
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 15 }),
    });
    const d = await r.json();
    console.log(`Serper "${term}": organic=${(d.organic || []).length}`);
    for (const entry of (d.organic || []) as Array<{ title: string; link: string; snippet: string }>) {
      if (entry.link.includes("indiehackers.com")) {
        posts.push({
          url: entry.link,
          title: entry.title.replace(/ - Indie Hackers$/i, "").trim(),
          content_text: entry.snippet,
        });
      }
    }
  }
  console.log(`\ntotal posts: ${posts.length}`);

  // Matcher loop (mimics scan-on-demand contentMatchesMonitor)
  let matched = 0;
  for (const post of posts.slice(0, 50)) {
    const text = `${post.title} ${post.content_text || ""}`.toLowerCase();
    let isMatch = false;
    if (includesTokenized(text, companyName)) isMatch = true;
    else if (keywords.some((k) => includesTokenized(text, k))) isMatch = true;
    if (isMatch) matched++;
    else {
      console.log(`  REJECT: "${post.title.slice(0, 60)}" | text="${text.slice(0, 100)}"`);
    }
  }
  console.log(`\nMATCHED: ${matched}/${posts.length}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
