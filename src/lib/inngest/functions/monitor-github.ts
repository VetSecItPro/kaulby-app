import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";
import { isMonitorScheduleActive } from "@/lib/monitor-schedule";

// GitHub search result interfaces
interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  state: string;
  repository_url: string;
  labels: Array<{ name: string }>;
}

interface GitHubDiscussion {
  id: string;
  title: string;
  body: string;
  author: { login: string } | null;
  url: string;
  createdAt: string;
  upvoteCount: number;
  comments: { totalCount: number };
  category: { name: string };
}

interface GitHubSearchResult {
  issues: GitHubIssue[];
  discussions: GitHubDiscussion[];
  source: "api";
}

/**
 * Search GitHub Issues and Discussions via GitHub API
 * Free tier: 5,000 requests/hour authenticated, 60/hour unauthenticated
 */
async function searchGitHub(keywords: string[], maxResults: number = 50): Promise<GitHubSearchResult> {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Kaulby/1.0",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const issues: GitHubIssue[] = [];
  const discussions: GitHubDiscussion[] = [];

  try {
    // Search issues for each keyword
    for (const keyword of keywords.slice(0, 5)) { // Limit to 5 keywords to stay within rate limits
      const query = encodeURIComponent(`${keyword} in:title,body type:issue`);
      const issueResponse = await fetch(
        `https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=${Math.min(maxResults, 30)}`,
        { headers }
      );

      if (issueResponse.ok) {
        const data = await issueResponse.json();
        if (data.items) {
          for (const item of data.items) {
            // Avoid duplicates
            if (!issues.find(i => i.id === item.id)) {
              issues.push(item);
            }
          }
        }
      } else {
        console.warn(`[GitHub] Issue search failed for "${keyword}": ${issueResponse.status}`);
      }

      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Search discussions via GraphQL (if token available)
    if (token) {
      for (const keyword of keywords.slice(0, 3)) { // Limit discussions search
        try {
          const graphqlQuery = `
            query {
              search(query: "${keyword}", type: DISCUSSION, first: 20) {
                nodes {
                  ... on Discussion {
                    id
                    title
                    body
                    author { login }
                    url
                    createdAt
                    upvoteCount
                    comments { totalCount }
                    category { name }
                  }
                }
              }
            }
          `;

          const graphqlResponse = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: graphqlQuery }),
          });

          if (graphqlResponse.ok) {
            const data = await graphqlResponse.json();
            if (data.data?.search?.nodes) {
              for (const node of data.data.search.nodes) {
                if (node && !discussions.find(d => d.id === node.id)) {
                  discussions.push(node);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[GitHub] Discussion search failed for "${keyword}":`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { issues, discussions, source: "api" };
  } catch (error) {
    console.error("[GitHub] Search failed:", error);
    return { issues: [], discussions: [], source: "api" };
  }
}

// Scan GitHub Issues and Discussions for matches
export const monitorGitHub = inngest.createFunction(
  {
    id: "monitor-github",
    name: "Monitor GitHub",
    retries: 3,
  },
  { cron: "*/20 * * * *" }, // Every 20 minutes
  async ({ step }) => {
    // Get all active monitors that include GitHub
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const githubMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("github")
    );

    if (githubMonitors.length === 0) {
      return { message: "No active GitHub monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    const staggerWindow = getStaggerWindow("github");

    for (let i = 0; i < githubMonitors.length; i++) {
      const monitor = githubMonitors[i];

      // Stagger execution
      if (i > 0 && githubMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, githubMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check platform access
      const access = await canAccessPlatform(monitor.userId, "github");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      // Check if monitor is within its active schedule
      if (!isMonitorScheduleActive(monitor)) {
        continue;
      }

      let monitorMatchCount = 0;

      // Search GitHub
      const searchResult = await step.run(`search-github-${monitor.id}`, async () => {
        return searchGitHub(monitor.keywords, 50);
      });

      console.log(`[GitHub] Found ${searchResult.issues.length} issues and ${searchResult.discussions.length} discussions`);

      // Process issues
      for (const issue of searchResult.issues) {
        const matchResult = contentMatchesMonitor(
          {
            title: issue.title,
            body: issue.body || "",
            author: issue.user?.login || "",
          },
          {
            companyName: monitor.companyName,
            keywords: monitor.keywords,
            searchQuery: monitor.searchQuery,
          }
        );

        if (matchResult.matches) {
          // Check if already exists
          const existing = await db.query.results.findFirst({
            where: eq(results.sourceUrl, issue.html_url),
          });

          if (!existing) {
            const [newResult] = await db.insert(results).values({
              monitorId: monitor.id,
              platform: "github",
              sourceUrl: issue.html_url,
              title: `[Issue] ${issue.title}`,
              content: issue.body || "",
              author: issue.user?.login || "Unknown",
              postedAt: new Date(issue.created_at),
              metadata: {
                type: "issue",
                state: issue.state,
                commentCount: issue.comments,
                labels: issue.labels.map(l => l.name),
                repositoryUrl: issue.repository_url,
              },
            }).returning();

            totalResults++;
            monitorMatchCount++;
            await incrementResultsCount(monitor.userId, 1);

            await inngest.send({
              name: "content/analyze",
              data: {
                resultId: newResult.id,
                userId: monitor.userId,
              },
            });
          }
        }
      }

      // Process discussions
      for (const discussion of searchResult.discussions) {
        const matchResult = contentMatchesMonitor(
          {
            title: discussion.title,
            body: discussion.body,
            author: discussion.author?.login || "",
          },
          {
            companyName: monitor.companyName,
            keywords: monitor.keywords,
            searchQuery: monitor.searchQuery,
          }
        );

        if (matchResult.matches) {
          const existing = await db.query.results.findFirst({
            where: eq(results.sourceUrl, discussion.url),
          });

          if (!existing) {
            const [newResult] = await db.insert(results).values({
              monitorId: monitor.id,
              platform: "github",
              sourceUrl: discussion.url,
              title: `[Discussion] ${discussion.title}`,
              content: discussion.body,
              author: discussion.author?.login || "Unknown",
              postedAt: new Date(discussion.createdAt),
              metadata: {
                type: "discussion",
                upvotes: discussion.upvoteCount,
                commentCount: discussion.comments.totalCount,
                category: discussion.category.name,
              },
            }).returning();

            totalResults++;
            monitorMatchCount++;
            await incrementResultsCount(monitor.userId, 1);

            await inngest.send({
              name: "content/analyze",
              data: {
                resultId: newResult.id,
                userId: monitor.userId,
              },
            });
          }
        }
      }

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
      message: `Scanned GitHub, found ${totalResults} new matching items`,
      totalResults,
      monitorResults,
    };
  }
);
