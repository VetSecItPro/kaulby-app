import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform } from "@/lib/limits";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  type: string;
  title?: string;
  text?: string;
  by: string;
  time: number;
  url?: string;
  score?: number;
  descendants?: number;
}

// Scan Hacker News for new posts matching monitor keywords
export const monitorHackerNews = inngest.createFunction(
  {
    id: "monitor-hackernews",
    name: "Monitor Hacker News",
    retries: 3,
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Get all active monitors that include Hacker News
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const hnMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("hackernews")
    );

    if (hnMonitors.length === 0) {
      return { message: "No active Hacker News monitors" };
    }

    // Get latest stories
    const storyIds = await step.run("fetch-new-stories", async () => {
      const response = await fetch(`${HN_API_BASE}/newstories.json`);
      const ids: number[] = await response.json();
      return ids.slice(0, 100); // Last 100 stories
    });

    // Fetch story details
    const stories = await step.run("fetch-story-details", async () => {
      const storyPromises = storyIds.map(async (id) => {
        const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
        return response.json() as Promise<HNItem>;
      });

      return Promise.all(storyPromises);
    });

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of hnMonitors) {
      // Check if user has access to Hacker News platform
      const access = await canAccessPlatform(monitor.userId, "hackernews");
      if (!access.hasAccess) {
        continue; // Skip monitors for users without platform access
      }

      let monitorMatchCount = 0;

      // Check each story for keyword matches
      const matchingStories = stories.filter((story) => {
        if (!story || !story.title) return false;
        const text = `${story.title} ${story.text || ""}`.toLowerCase();
        return monitor.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      });

      // Save matching stories as results
      if (matchingStories.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const story of matchingStories) {
            if (!story) continue;

            const sourceUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, sourceUrl),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "hackernews",
                sourceUrl,
                title: story.title || "",
                content: story.text || null,
                author: story.by,
                postedAt: new Date(story.time * 1000),
                metadata: {
                  hnId: story.id,
                  score: story.score,
                  numComments: story.descendants,
                },
              }).returning();

              totalResults++;
              monitorMatchCount++;

              // Increment usage count for the user
              await incrementResultsCount(monitor.userId, 1);

              // Trigger content analysis
              await inngest.send({
                name: "content/analyze",
                data: {
                  resultId: newResult.id,
                  userId: monitor.userId,
                },
              });
            }
          }
        });
      }

      // Update monitor stats
      monitorResults[monitor.id] = monitorMatchCount;

      await step.run(`update-monitor-stats-${monitor.id}`, async () => {
        await db
          .update(monitors)
          .set({
            lastCheckedAt: new Date(),
            newMatchCount: monitorMatchCount,
            updatedAt: new Date(),
          })
          .where(eq(monitors.id, monitor.id));
      });
    }

    return {
      message: `Scanned Hacker News, found ${totalResults} new matching stories`,
      totalResults,
      monitorResults,
    };
  }
);
