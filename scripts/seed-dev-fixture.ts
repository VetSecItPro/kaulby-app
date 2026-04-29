/**
 * Seed dev fixture: populates the dashboard with realistic test data so
 * visual reviews and AI integration testing have something to render against
 * (instead of empty states everywhere).
 *
 * Idempotent: clears existing test data for the target user, then re-inserts.
 * Targets the same user the dev-auth bypass picks (first admin, falling back
 * to first user in DB).
 *
 * Run:  pnpm tsx scripts/seed-dev-fixture.ts
 *
 * What it creates (per run):
 *   - 3 monitors covering different platforms and use cases
 *   - 15 results spread across the monitors (mixed sentiment + categories +
 *     lead scores + recency, so every dashboard filter has something to show)
 *   - 1 audience with 5 communities
 *   - 2 chat conversations with messages and citations
 *   - 1 bookmark collection with 5 bookmarks
 *   - 5 ai_logs entries for cost-tracking display
 *   - 4 notifications (mix of read/unread, types)
 *
 * Run it BEFORE doing dashboard visual review or AI testing.
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL required");
}

const sql = neon(DATABASE_URL);

async function getTargetUser(): Promise<{ id: string; email: string }> {
  // Match dev-auth bypass logic: prefer admin, fall back to any user.
  const admin = await sql`
    SELECT id, email FROM users WHERE is_admin = true LIMIT 1
  `;
  if (admin.length > 0) return admin[0] as { id: string; email: string };

  const any = await sql`SELECT id, email FROM users LIMIT 1`;
  if (any.length === 0) {
    throw new Error("No users in DB. Sign up first via /sign-up.");
  }
  return any[0] as { id: string; email: string };
}

async function getOrCreateWorkspace(userId: string): Promise<string> {
  const existing = await sql`
    SELECT id FROM workspaces WHERE owner_id = ${userId} LIMIT 1
  `;
  if (existing.length > 0) return existing[0].id as string;

  const created = await sql`
    INSERT INTO workspaces (name, owner_id, seat_limit)
    VALUES ('Dev Fixture Workspace', ${userId}, 3)
    RETURNING id
  `;
  return created[0].id as string;
}

async function clearExistingFixture(userId: string): Promise<void> {
  // Use the same cascade order as scripts/clear-test-data.ts. Monitors cascade
  // to results+alerts, audiences cascade to communities, etc.
  const monitorRows = await sql`SELECT id FROM monitors WHERE user_id = ${userId}`;
  const monitorIds = monitorRows.map((m: any) => m.id);

  if (monitorIds.length > 0) {
    await sql`DELETE FROM results WHERE monitor_id = ANY(${monitorIds})`;
    await sql`DELETE FROM alerts WHERE monitor_id = ANY(${monitorIds})`;
    await sql`DELETE FROM audience_monitors WHERE monitor_id = ANY(${monitorIds})`;
  }

  const audienceRows = await sql`SELECT id FROM audiences WHERE user_id = ${userId}`;
  const audienceIds = audienceRows.map((a: any) => a.id);
  if (audienceIds.length > 0) {
    await sql`DELETE FROM communities WHERE audience_id = ANY(${audienceIds})`;
    await sql`DELETE FROM audiences WHERE id = ANY(${audienceIds})`;
  }

  await sql`DELETE FROM bookmarks WHERE user_id = ${userId}`;
  await sql`DELETE FROM bookmark_collections WHERE user_id = ${userId}`;
  await sql`DELETE FROM chat_conversations WHERE user_id = ${userId}`; // cascades to chat_messages
  await sql`DELETE FROM ai_logs WHERE user_id = ${userId}`;
  await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
  await sql`DELETE FROM monitors WHERE user_id = ${userId}`;
}

async function seedMonitors(userId: string, workspaceId: string): Promise<string[]> {
  // platforms is NOT NULL on monitors. Each monitor seeds a different breadth
  // so the dashboard's per-monitor platform breakdown shows variety.
  const monitor1 = await sql`
    INSERT INTO monitors (user_id, workspace_id, name, company_name, keywords, platforms, monitor_type, is_active, last_checked_at)
    VALUES (
      ${userId},
      ${workspaceId},
      'Trellis Brand Mentions',
      'Trellis',
      ARRAY['trellis', 'trellis app', 'trellis pm']::text[],
      ARRAY['reddit','hackernews','producthunt','trustpilot','x','g2','indiehackers']::platform[],
      'keyword',
      true,
      NOW() - INTERVAL '30 minutes'
    )
    RETURNING id
  `;

  const monitor2 = await sql`
    INSERT INTO monitors (user_id, workspace_id, name, company_name, keywords, platforms, monitor_type, is_active, last_checked_at)
    VALUES (
      ${userId},
      ${workspaceId},
      'Competitor Watch (Asana, Monday, Linear)',
      'Asana',
      ARRAY['asana alternative', 'monday.com vs', 'linear vs', 'project management tool']::text[],
      ARRAY['reddit','hackernews','x','g2']::platform[],
      'keyword',
      true,
      NOW() - INTERVAL '1 hour'
    )
    RETURNING id
  `;

  const monitor3 = await sql`
    INSERT INTO monitors (user_id, workspace_id, name, company_name, keywords, platforms, monitor_type, is_active, last_checked_at)
    VALUES (
      ${userId},
      ${workspaceId},
      'Feature Requests & Roadmap Signals',
      'Trellis',
      ARRAY['trellis feature', 'trellis roadmap', 'trellis integration', 'wish trellis']::text[],
      ARRAY['github','reddit','producthunt']::platform[],
      'keyword',
      true,
      NOW() - INTERVAL '4 hours'
    )
    RETURNING id
  `;

  return [monitor1[0].id, monitor2[0].id, monitor3[0].id];
}

async function seedResults(monitorIds: string[]): Promise<string[]> {
  const [m1, m2, m3] = monitorIds;
  type Seed = {
    monitor_id: string;
    platform: string;
    source_url: string;
    title: string;
    content: string;
    author: string;
    posted_offset_hours: number;
    sentiment: "positive" | "negative" | "neutral";
    sentiment_score: number;
    pain_point_category: string | null;
    conversation_category:
      | "pain_point"
      | "solution_request"
      | "advice_request"
      | "money_talk"
      | "hot_discussion";
    engagement_score: number;
    lead_score: number | null;
  };

  const seeds: Seed[] = [
    {
      monitor_id: m1,
      platform: "reddit",
      source_url: "https://reddit.com/r/productivity/seed1",
      title: "Just switched from Asana to Trellis - the AI task prioritization is actually useful",
      content: "We migrated our 15-person team last week. The AI prioritization engine cut our missed-deadline rate by 30%. Best onboarding experience I've seen in this category.",
      author: "u/productivitynerd",
      posted_offset_hours: 2,
      sentiment: "positive",
      sentiment_score: 0.82,
      pain_point_category: "positive_feedback",
      conversation_category: "solution_request",
      engagement_score: 95,
      lead_score: 87,
    },
    {
      monitor_id: m1,
      platform: "trustpilot",
      source_url: "https://trustpilot.com/review/seed2",
      title: "Great tool but the mobile app needs work",
      content: "4-star: desktop is excellent but the mobile app is slow and has no offline mode. Crashes randomly on iOS 17.",
      author: "James K.",
      posted_offset_hours: 6,
      sentiment: "negative",
      sentiment_score: -0.42,
      pain_point_category: "negative_experience",
      conversation_category: "pain_point",
      engagement_score: 18,
      lead_score: 35,
    },
    {
      monitor_id: m1,
      platform: "producthunt",
      source_url: "https://producthunt.com/posts/seed3",
      title: "Trellis 3.0 - AI-powered project management for modern teams",
      content: "Launch day. 340+ upvotes, lots of enterprise interest in SSO and SOC 2.",
      author: "trellis_team",
      posted_offset_hours: 18,
      sentiment: "positive",
      sentiment_score: 0.78,
      pain_point_category: "positive_feedback",
      conversation_category: "hot_discussion",
      engagement_score: 340,
      lead_score: 91,
    },
    {
      monitor_id: m1,
      platform: "x",
      source_url: "https://x.com/sarahbuilds/status/seed4",
      title: "Been using @trellis_app for 2 months and the AI prioritization has genuinely changed how our team works",
      content: "Specifically the way it surfaces blocked tasks before standup. 12K followers, 45 likes, 12 retweets.",
      author: "@sarahbuilds",
      posted_offset_hours: 3,
      sentiment: "positive",
      sentiment_score: 0.71,
      pain_point_category: "positive_feedback",
      conversation_category: "solution_request",
      engagement_score: 57,
      lead_score: 78,
    },
    {
      monitor_id: m1,
      platform: "g2",
      source_url: "https://g2.com/products/trellis/reviews/seed5",
      title: "Enterprise pricing is steep but the ROI is there",
      content: "We compared with Monday.com - Trellis costs 30% more but the automation features pay for themselves.",
      author: "Verified User in SaaS",
      posted_offset_hours: 48,
      sentiment: "positive",
      sentiment_score: 0.45,
      pain_point_category: "pricing_concern",
      conversation_category: "money_talk",
      engagement_score: 24,
      lead_score: 63,
    },
    {
      monitor_id: m2,
      platform: "reddit",
      source_url: "https://reddit.com/r/projectmanagement/seed6",
      title: "Looking for an alternative to Asana - need API + Slack integration",
      content: "We've outgrown Asana. Their API is limited and Slack integration is broken. What are people using?",
      author: "u/buildingremote",
      posted_offset_hours: 1,
      sentiment: "neutral",
      sentiment_score: 0.05,
      pain_point_category: "competitor_mention",
      conversation_category: "solution_request",
      engagement_score: 67,
      lead_score: 91,
    },
    {
      monitor_id: m2,
      platform: "hackernews",
      source_url: "https://news.ycombinator.com/item?id=seed7",
      title: "Ask HN: Best PM tool for remote engineering teams?",
      content: "Looking for honest comparisons of Asana, Linear, Monday, Trellis, Notion. Care about API and offline.",
      author: "devlead_sarah",
      posted_offset_hours: 4,
      sentiment: "neutral",
      sentiment_score: 0.0,
      pain_point_category: "competitor_mention",
      conversation_category: "advice_request",
      engagement_score: 142,
      lead_score: 82,
    },
    {
      monitor_id: m2,
      platform: "reddit",
      source_url: "https://reddit.com/r/SaaS/seed8",
      title: "Frustrated by Asana's pricing tiers - looking for alternatives",
      content: "We're a 25-person team and Asana wants $1300/mo for their Business tier. Anyone moved off?",
      author: "u/saas_founder",
      posted_offset_hours: 5,
      sentiment: "negative",
      sentiment_score: -0.55,
      pain_point_category: "pricing_concern",
      conversation_category: "money_talk",
      engagement_score: 38,
      lead_score: 88,
    },
    {
      monitor_id: m2,
      platform: "hackernews",
      source_url: "https://news.ycombinator.com/item?id=seed9",
      title: "Monday's automations break weekly. Anyone tried Trellis?",
      content: "Spent 4 hours debugging a Monday automation today. There has to be something better.",
      author: "throwaway_pm",
      posted_offset_hours: 7,
      sentiment: "negative",
      sentiment_score: -0.6,
      pain_point_category: "competitor_mention",
      conversation_category: "pain_point",
      engagement_score: 89,
      lead_score: 84,
    },
    {
      monitor_id: m2,
      platform: "x",
      source_url: "https://x.com/dev_observer/status/seed10",
      title: "Linear is great for engineering but no support for design teams",
      content: "We need cross-functional. Linear feels like it was built for ICs only.",
      author: "@dev_observer",
      posted_offset_hours: 9,
      sentiment: "negative",
      sentiment_score: -0.3,
      pain_point_category: "feature_request",
      conversation_category: "pain_point",
      engagement_score: 31,
      lead_score: 76,
    },
    {
      monitor_id: m3,
      platform: "github",
      source_url: "https://github.com/trellis/app/issues/seed11",
      title: "Feature request: Slack import for existing channels",
      content: "Currently we have to recreate every channel as a Trellis project. An import tool would save days.",
      author: "github_user_42",
      posted_offset_hours: 12,
      sentiment: "neutral",
      sentiment_score: 0.1,
      pain_point_category: "feature_request",
      conversation_category: "advice_request",
      engagement_score: 23,
      lead_score: 58,
    },
    {
      monitor_id: m3,
      platform: "reddit",
      source_url: "https://reddit.com/r/trellis/seed12",
      title: "Wish Trellis had Linear-style cycles built in",
      content: "Sprints are great but we want lighter-weight 2-week cycles without the JIRA-ish ceremony.",
      author: "u/sprint_hater",
      posted_offset_hours: 15,
      sentiment: "neutral",
      sentiment_score: -0.05,
      pain_point_category: "feature_request",
      conversation_category: "advice_request",
      engagement_score: 41,
      lead_score: 49,
    },
    {
      monitor_id: m3,
      platform: "producthunt",
      source_url: "https://producthunt.com/posts/seed13",
      title: "Trellis roadmap update: AI standup notes coming Q2",
      content: "Roadmap thread comments mention demand for AI summarization of standups.",
      author: "trellis_team",
      posted_offset_hours: 36,
      sentiment: "positive",
      sentiment_score: 0.55,
      pain_point_category: "feature_request",
      conversation_category: "hot_discussion",
      engagement_score: 78,
      lead_score: 52,
    },
    {
      monitor_id: m1,
      platform: "indiehackers",
      source_url: "https://indiehackers.com/post/seed14",
      title: "Is Trellis worth $39/mo for a solo founder?",
      content: "Just hit MRR milestone. Need to upgrade my project tooling. Trellis Solo or Linear free?",
      author: "founder_indie",
      posted_offset_hours: 8,
      sentiment: "neutral",
      sentiment_score: 0.15,
      pain_point_category: "pricing_concern",
      conversation_category: "money_talk",
      engagement_score: 19,
      lead_score: 71,
    },
    {
      monitor_id: m2,
      platform: "g2",
      source_url: "https://g2.com/discussions/seed15",
      title: "Asana support response times are getting worse",
      content: "Used to get replies in 4 hours. Now it's 3+ days. Can anyone vouch for Trellis support?",
      author: "Verified User in Marketing",
      posted_offset_hours: 11,
      sentiment: "negative",
      sentiment_score: -0.7,
      pain_point_category: "support_need",
      conversation_category: "pain_point",
      engagement_score: 14,
      lead_score: 79,
    },
  ];

  const ids: string[] = [];
  for (const s of seeds) {
    const inserted = await sql`
      INSERT INTO results (
        monitor_id, platform, source_url, title, content, author,
        posted_at, sentiment, sentiment_score,
        pain_point_category, conversation_category,
        engagement_score, lead_score
      ) VALUES (
        ${s.monitor_id}, ${s.platform}::platform, ${s.source_url}, ${s.title}, ${s.content}, ${s.author},
        NOW() - (${s.posted_offset_hours} * INTERVAL '1 hour'),
        ${s.sentiment}::sentiment, ${s.sentiment_score},
        ${s.pain_point_category ? sql`${s.pain_point_category}::pain_point_category` : null},
        ${s.conversation_category}::conversation_category,
        ${s.engagement_score}, ${s.lead_score}
      )
      RETURNING id
    `;
    ids.push(inserted[0].id);
  }
  return ids;
}

async function seedAudience(userId: string, workspaceId: string, monitorIds: string[]): Promise<string> {
  const audience = await sql`
    INSERT INTO audiences (user_id, workspace_id, name, description, color, icon)
    VALUES (
      ${userId}, ${workspaceId},
      'Indie SaaS Founders',
      'Solo founders and small teams in the SaaS space - the core ICP for Trellis Solo and Scale tiers.',
      '#06b6d4',
      'rocket'
    )
    RETURNING id
  `;
  const audienceId = audience[0].id as string;

  const communities = [
    { platform: "reddit", identifier: "SaaS" },
    { platform: "reddit", identifier: "Entrepreneur" },
    { platform: "reddit", identifier: "indiehackers" },
    { platform: "indiehackers", identifier: "main-feed" },
    { platform: "hackernews", identifier: "front-page" },
  ];
  for (const c of communities) {
    await sql`
      INSERT INTO communities (audience_id, platform, identifier)
      VALUES (${audienceId}, ${c.platform}::platform, ${c.identifier})
    `;
  }

  // Wire all monitors to this audience so the dashboard's audience-monitor
  // links view shows something.
  for (const mid of monitorIds) {
    await sql`
      INSERT INTO audience_monitors (audience_id, monitor_id)
      VALUES (${audienceId}, ${mid})
      ON CONFLICT DO NOTHING
    `;
  }

  return audienceId;
}

async function seedChatConversations(userId: string): Promise<void> {
  // Conversation 1: Pain point analysis
  const conv1 = await sql`
    INSERT INTO chat_conversations (user_id, title)
    VALUES (${userId}, 'What pain points came up this week?')
    RETURNING id
  `;
  const c1id = conv1[0].id;
  await sql`
    INSERT INTO chat_messages (conversation_id, role, content) VALUES
    (${c1id}, 'user', 'What are the top pain points my customers mentioned this week?'),
    (${c1id}, 'assistant', 'Three clusters surfaced this week:

1. **Mobile app experience** (14 mentions, +8 vs last week) - users report slow load, missing offline mode, iOS crashes. Severity: HIGH.
2. **Enterprise pricing concerns** (11 mentions) - comparisons against Monday.com, ROI questions on the Business tier.
3. **Missing integrations** (7 mentions) - top requests are Slack import, Linear sync, GitHub.

Mobile is the most actionable - 8 net-new complaints in 7 days suggests a regression worth investigating.')
  `;

  // Conversation 2: Competitor question
  const conv2 = await sql`
    INSERT INTO chat_conversations (user_id, title)
    VALUES (${userId}, 'Asana churn signals')
    RETURNING id
  `;
  const c2id = conv2[0].id;
  await sql`
    INSERT INTO chat_messages (conversation_id, role, content) VALUES
    (${c2id}, 'user', 'How many people are looking to leave Asana?'),
    (${c2id}, 'assistant', 'I see 5 high-intent posts in the last 24 hours from people explicitly looking to migrate off Asana. Lead scores 79-91. Most cite pricing tiers and API limitations as the reason. Three of them mention "alternatives" with no incumbent loyalty - those are warm targets.')
  `;
}

async function seedBookmarks(userId: string, resultIds: string[]): Promise<void> {
  const collection = await sql`
    INSERT INTO bookmark_collections (user_id, name, color)
    VALUES (${userId}, 'High-intent leads', '#06b6d4')
    RETURNING id
  `;
  const collectionId = collection[0].id;

  // Bookmark the 5 highest lead-score results
  const topResults = resultIds.slice(0, 5);
  for (const rid of topResults) {
    await sql`
      INSERT INTO bookmarks (user_id, result_id, collection_id, note)
      VALUES (${userId}, ${rid}, ${collectionId}, 'Follow up - high intent')
    `;
  }
}

async function seedAiLogs(userId: string, monitorIds: string[]): Promise<void> {
  // Realistic spread of AI calls over the past week so the cost-tracking UI
  // has data to chart.
  const calls = [
    { model: "google/gemini-2.5-flash", prompt: 850, completion: 240, cost: 0.0012, latency: 980, hours_ago: 1, monitor: monitorIds[0] },
    { model: "google/gemini-2.5-flash", prompt: 1200, completion: 320, cost: 0.0018, latency: 1100, hours_ago: 3, monitor: monitorIds[0] },
    { model: "google/gemini-2.5-flash", prompt: 740, completion: 180, cost: 0.0009, latency: 870, hours_ago: 8, monitor: monitorIds[1] },
    { model: "anthropic/claude-sonnet-4-5", prompt: 2400, completion: 680, cost: 0.022, latency: 2300, hours_ago: 14, monitor: monitorIds[2] },
    { model: "google/gemini-2.5-flash", prompt: 980, completion: 220, cost: 0.0014, latency: 920, hours_ago: 26, monitor: monitorIds[1] },
  ];
  for (const c of calls) {
    await sql`
      INSERT INTO ai_logs (
        user_id, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, monitor_id, created_at
      ) VALUES (
        ${userId}, ${c.model}, ${c.prompt}, ${c.completion}, ${c.cost}, ${c.latency}, ${c.monitor},
        NOW() - (${c.hours_ago} * INTERVAL '1 hour')
      )
    `;
  }
}

async function seedNotifications(userId: string, monitorIds: string[], resultIds: string[]): Promise<void> {
  const notifs = [
    {
      title: "High-intent post from u/buildingremote",
      message: "Lead score 91 - 'Looking for an alternative to Asana - need API + Slack integration'",
      type: "alert",
      monitor: monitorIds[1],
      result: resultIds[5],
      is_read: false,
      hours_ago: 1,
    },
    {
      title: "Spike on Mobile App Experience pain points",
      message: "8 new complaints this week (+57% vs last week). Severity: high.",
      type: "crisis",
      monitor: monitorIds[0],
      result: null,
      is_read: false,
      hours_ago: 4,
    },
    {
      title: "Trellis 3.0 launch trending on Product Hunt",
      message: "340+ upvotes, enterprise inbound on SSO and SOC 2.",
      type: "alert",
      monitor: monitorIds[0],
      result: resultIds[2],
      is_read: true,
      hours_ago: 18,
    },
    {
      title: "Weekly digest delivered",
      message: "5 new high-intent leads, 14 net-new pain points, 2 buying-signal posts.",
      type: "system",
      monitor: null,
      result: null,
      is_read: true,
      hours_ago: 30,
    },
  ];

  for (const n of notifs) {
    await sql`
      INSERT INTO notifications (
        user_id, title, message, type, monitor_id, result_id, is_read, read_at, created_at
      ) VALUES (
        ${userId}, ${n.title}, ${n.message}, ${n.type},
        ${n.monitor}, ${n.result}, ${n.is_read},
        ${n.is_read ? sql`NOW() - INTERVAL '1 hour'` : null},
        NOW() - (${n.hours_ago} * INTERVAL '1 hour')
      )
    `;
  }
}

async function main() {
  console.log("Resolving target user...");
  const user = await getTargetUser();
  console.log(`Target: ${user.email} (${user.id})`);

  console.log("\nGetting/creating workspace...");
  const workspaceId = await getOrCreateWorkspace(user.id);
  console.log(`Workspace: ${workspaceId}`);

  console.log("\nClearing existing fixture data...");
  await clearExistingFixture(user.id);

  console.log("\nSeeding monitors (3)...");
  const monitorIds = await seedMonitors(user.id, workspaceId);
  console.log(`Monitors: ${monitorIds.length}`);

  console.log("Seeding results (15)...");
  const resultIds = await seedResults(monitorIds);
  console.log(`Results: ${resultIds.length}`);

  console.log("Seeding audience + 5 communities...");
  await seedAudience(user.id, workspaceId, monitorIds);

  console.log("Seeding chat conversations (2)...");
  await seedChatConversations(user.id);

  console.log("Seeding bookmarks (5)...");
  await seedBookmarks(user.id, resultIds);

  console.log("Seeding ai_logs (5)...");
  await seedAiLogs(user.id, monitorIds);

  console.log("Seeding notifications (4, mix of read/unread)...");
  await seedNotifications(user.id, monitorIds, resultIds);

  console.log("\n✅ Done. Reload the dashboard to see populated state.");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
