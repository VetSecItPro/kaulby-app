/**
 * Test Product Hunt API integration
 * Run with: npx tsx scripts/test-producthunt.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { users, monitors, results } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const PH_API_BASE = "https://api.producthunt.com/v2/api/graphql";
const PH_TOKEN_URL = "https://api.producthunt.com/v2/oauth/token";
const TEST_EMAIL = "airborneshellback@gmail.com";

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.PRODUCTHUNT_API_KEY;
  const clientSecret = process.env.PRODUCTHUNT_API_SECRET;

  console.log("[Auth] Checking credentials...");
  console.log(`  API Key: ${clientId ? clientId.slice(0, 8) + "..." : "MISSING"}`);
  console.log(`  API Secret: ${clientSecret ? clientSecret.slice(0, 8) + "..." : "MISSING"}`);

  if (!clientId || !clientSecret) {
    console.error("❌ Missing Product Hunt credentials");
    return null;
  }

  console.log("\n[Auth] Requesting OAuth token...");

  const response = await fetch(PH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OAuth failed: ${response.status} - ${errorText}`);
    return null;
  }

  const data = await response.json();
  console.log("✓ Got access token");
  return data.access_token;
}

async function fetchPosts(accessToken: string, keywords: string[]) {
  console.log("\n[Query] Fetching recent Product Hunt posts...");

  const query = `
    query {
      posts(first: 20, order: NEWEST) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            createdAt
            user {
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch(PH_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Query failed: ${response.status} - ${errorText}`);
    return { allPosts: [], matchingPosts: [] };
  }

  const data = await response.json();
  const posts = data.data?.posts?.edges?.map((e: any) => e.node) || [];
  console.log(`✓ Fetched ${posts.length} posts`);

  // Filter by keywords
  const matchingPosts = posts.filter((post: any) => {
    const text = `${post.name} ${post.tagline} ${post.description || ""}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });

  return { allPosts: posts, matchingPosts };
}

async function main() {
  console.log("=".repeat(60));
  console.log("PRODUCT HUNT API TEST");
  console.log("=".repeat(60));

  // Step 1: Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    process.exit(1);
  }

  // Step 2: Get test user
  console.log(`\n[User] Finding ${TEST_EMAIL}...`);
  const user = await db.query.users.findFirst({
    where: eq(users.email, TEST_EMAIL),
  });

  if (!user) {
    console.error(`❌ User ${TEST_EMAIL} not found`);
    process.exit(1);
  }
  console.log(`✓ Found user: ${user.name} (${user.id})`);

  // Step 3: Create a test monitor with Product Hunt
  console.log("\n[Monitor] Creating test monitor with Product Hunt...");

  const testKeywords = ["AI", "startup", "productivity"];

  const [testMonitor] = await db
    .insert(monitors)
    .values({
      userId: user.id,
      name: "PH Test Monitor",
      companyName: "Test",
      keywords: testKeywords,
      platforms: ["producthunt"],
      isActive: true,
    })
    .returning();

  console.log(`✓ Created monitor: ${testMonitor.name} (ID: ${testMonitor.id})`);
  console.log(`  Keywords: ${testKeywords.join(", ")}`);

  // Step 4: Fetch and match posts
  const { allPosts, matchingPosts } = await fetchPosts(accessToken, testKeywords);

  console.log("\n[Results] Recent Product Hunt posts:");
  allPosts.slice(0, 5).forEach((post: any, i: number) => {
    console.log(`  ${i + 1}. ${post.name} - ${post.tagline}`);
    console.log(`     Votes: ${post.votesCount} | By: ${post.user?.name}`);
  });

  console.log(`\n[Matches] Found ${matchingPosts.length} posts matching keywords:`);
  if (matchingPosts.length > 0) {
    matchingPosts.slice(0, 5).forEach((post: any, i: number) => {
      console.log(`  ${i + 1}. ${post.name} - ${post.tagline}`);
      console.log(`     URL: ${post.url}`);
    });

    // Save one result as a test
    console.log("\n[Save] Saving first match as result...");
    const firstMatch = matchingPosts[0];
    const [savedResult] = await db
      .insert(results)
      .values({
        monitorId: testMonitor.id,
        platform: "producthunt",
        sourceUrl: firstMatch.url,
        title: `${firstMatch.name} - ${firstMatch.tagline}`,
        content: firstMatch.description || null,
        author: firstMatch.user?.name || null,
        postedAt: new Date(firstMatch.createdAt),
        metadata: {
          phId: firstMatch.id,
          votesCount: firstMatch.votesCount,
        },
      })
      .returning();
    console.log(`✓ Saved result: ${savedResult.id}`);
  } else {
    console.log("  (No matches for current keywords - try broader terms)");
  }

  // Step 5: Cleanup
  console.log("\n[Cleanup] Removing test data...");

  // Delete results for this monitor
  await db.delete(results).where(eq(results.monitorId, testMonitor.id));

  // Delete the test monitor
  await db.delete(monitors).where(eq(monitors.id, testMonitor.id));

  console.log("✓ Cleaned up test monitor and results");

  console.log("\n" + "=".repeat(60));
  console.log("✅ PRODUCT HUNT INTEGRATION TEST PASSED");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
