#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function probeX() {
  console.log("\n━━━ X / xAI probe ━━━");
  const key = process.env.XAI_API_KEY;
  if (!key) {
    console.log("❌ XAI_API_KEY missing");
    return;
  }
  console.log(`   XAI_API_KEY present: prefix=${key.slice(0, 8)}... len=${key.length}`);

  // Match what monitor-x.ts does: chat completions with x_search tool
  const body = {
    model: "grok-4-latest",
    messages: [
      {
        role: "system",
        content: `Return JSON array of posts. Fields: id, text, author, authorUsername, url, createdAt, likes, retweets, replies. ONLY JSON.`,
      },
      { role: "user", content: `Find recent posts about: iPhone 15` },
    ],
    search_parameters: {
      mode: "on",
      return_citations: true,
      sources: [{ type: "x" }],
    },
  };
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - t0;
    console.log(`   status: ${res.status}`);
    console.log(`   elapsed: ${elapsed}ms`);
    const text = await res.text();
    if (!res.ok) {
      console.log(`   ❌ body: ${text.slice(0, 400)}`);
      return;
    }
    const d = JSON.parse(text);
    const content = d.choices?.[0]?.message?.content ?? "";
    console.log(`   model content (first 300): ${content.slice(0, 300)}`);
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*/, "").replace(/\s*```$/, ""));
      const arr = Array.isArray(parsed) ? parsed : parsed.posts || [];
      console.log(`   parsed posts: ${Array.isArray(arr) ? arr.length : "?"}`);
    } catch {
      console.log(`   ⚠️  model did not return parseable JSON`);
    }
    console.log(`   usage: ${JSON.stringify(d.usage)}`);
  } catch (err) {
    console.log(`   ❌ threw: ${err instanceof Error ? err.message : err}`);
  }
}

async function probeHashnode() {
  console.log("\n━━━ Hashnode GraphQL probe ━━━");
  const query = `
    query SearchPosts($query: String!) {
      feed(first: 20, filter: { type: RELEVANT }) {
        edges {
          node {
            id
            title
            brief
            url
            publishedAt
            tags { name }
            author { username }
          }
        }
      }
    }`;
  const t0 = Date.now();
  try {
    const res = await fetch("https://gql.hashnode.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { query: "kubernetes" } }),
    });
    const elapsed = Date.now() - t0;
    console.log(`   status: ${res.status}  elapsed: ${elapsed}ms`);
    const text = await res.text();
    if (!res.ok) {
      console.log(`   ❌ body: ${text.slice(0, 400)}`);
      return;
    }
    const d = JSON.parse(text);
    if (d.errors) {
      console.log(`   ❌ GraphQL errors: ${JSON.stringify(d.errors).slice(0, 500)}`);
      return;
    }
    const edges = d.data?.feed?.edges || [];
    console.log(`   posts returned: ${edges.length}`);
    if (edges.length > 0) {
      console.log(`   sample: "${edges[0].node.title.slice(0, 80)}"`);
    }
  } catch (err) {
    console.log(`   ❌ threw: ${err instanceof Error ? err.message : err}`);
  }

  // Also try what the current monitor-hashnode.ts actually does (its query may differ)
  console.log("\n   --- What monitor-hashnode actually sends ---");
  const actualQuery = `
    query SearchPost($query: String!) {
      searchPostsOfPublication(
        first: 20
        filter: { query: $query, publicationId: "*" }
      ) {
        edges { node { id title brief url publishedAt } }
      }
    }`;
  const res2 = await fetch("https://gql.hashnode.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: actualQuery, variables: { query: "kubernetes" } }),
  });
  const t2 = await res2.text();
  console.log(`   actual-query status: ${res2.status}`);
  console.log(`   actual-query body (first 500): ${t2.slice(0, 500)}`);
}

async function probeReddit() {
  console.log("\n━━━ Reddit via content-matcher probe ━━━");
  // We know the lib fetches posts. The bug is downstream. Simulate what
  // monitor-reddit.ts does: call searchRedditResilient + apply contentMatcher.
  const m = await import("@/lib/reddit");
  const { contentMatchesMonitor } = await import("@/lib/content-matcher");

  const subreddit = "technology";
  const keywords = ["Tesla Model 3", "Tesla Autopilot"];
  const companyName = "Tesla";

  const { posts } = await m.searchRedditResilient(subreddit, keywords, 50);
  console.log(`   r/${subreddit}: fetched ${posts.length} raw posts`);

  let matched = 0;
  for (const post of posts.slice(0, 10)) {
    const result = contentMatchesMonitor(
      { title: post.title, body: post.selftext || "", author: post.author },
      { companyName, keywords, searchQuery: undefined },
    );
    if (result.matches) matched++;
    else {
      // Show a few examples of why they DIDN'T match
      if (matched === 0) {
        console.log(`   no-match: "${post.title.slice(0, 80)}..."`);
      }
    }
  }
  console.log(`   matched by content-matcher: ${matched} / 10`);

  // Second test: subreddit with Tesla-heavy content
  console.log("\n   --- r/teslamotors with Tesla keywords ---");
  const { posts: posts2 } = await m.searchRedditResilient("teslamotors", keywords, 20);
  console.log(`   fetched ${posts2.length} posts`);
  let matched2 = 0;
  for (const post of posts2.slice(0, 10)) {
    const result = contentMatchesMonitor(
      { title: post.title, body: post.selftext || "", author: post.author },
      { companyName, keywords, searchQuery: undefined },
    );
    if (result.matches) matched2++;
  }
  console.log(`   matched: ${matched2} / ${Math.min(10, posts2.length)}`);
}

async function main() {
  await probeX();
  await probeHashnode();
  await probeReddit();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("probe failed:", err);
  process.exit(1);
});
