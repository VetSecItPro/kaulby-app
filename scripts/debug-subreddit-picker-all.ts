#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { findRelevantSubreddits } from "@/lib/ai/analyzers/subreddit-finder";

async function probe(label: string, company: string, keywords: string[]) {
  console.log(`\n=== ${label} / company="${company}" / keywords=${JSON.stringify(keywords)} ===`);
  try {
    const subs = await findRelevantSubreddits(company, keywords, 10);
    console.log("FINAL:", subs);
  } catch (e) {
    console.error("ERR", e instanceof Error ? e.message : e);
  }
}

async function main() {
  await probe("panera", "Panera Bread", ["Panera Bread", "Panera"]);
  await probe("spotify", "Spotify", ["Spotify"]);
  await probe("anthropic", "Anthropic Claude", ["Anthropic Claude", "Claude API", "claude.ai"]);
  await probe("airpods", "AirPods Pro", ["AirPods Pro", "AirPods Pro 2"]);
  await probe("copilot", "GitHub Copilot", ["GitHub Copilot", "Copilot"]);
  await probe("peloton", "Peloton", ["Peloton bike", "Peloton"]);
  await probe("zoom", "Zoom", ["Zoom video", "Zoom meeting"]);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
