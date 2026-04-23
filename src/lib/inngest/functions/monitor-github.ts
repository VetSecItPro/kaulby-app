import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { incrementResultsCount } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { dedupedScan } from "@/lib/shared-scan";

// Dedup window for GitHub per-keyword API calls. 30 min balances freshness
// against overlap: the GitHub search API costs nothing in dollars but burns
// our 5000 req/hr rate limit, so collapsing User A + User B watching the
// same keyword into one call-per-30min is real headroom.
const GITHUB_DEDUP_WINDOW_MINUTES = 30;
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  updateSkippedMonitor,
  applyStagger,
  triggerAiAnalysis,
  updateMonitorStats,
  hasAnyActiveMonitors,
  type MonitorStep,
} from "../utils/monitor-helpers";

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
    // Search issues for each keyword. PR-E.1.2: each keyword query is
    // keyword-scoped (different URL per keyword), so dedup at keyword-level:
    // User A + User B both watching "notion" share one API call per window.
    for (const keyword of keywords.slice(0, 5)) { // Limit to 5 keywords to stay within rate limits
      const { data: items, cached } = await dedupedScan<GitHubIssue[]>(
        "github",
        `issues:${keyword}`,
        GITHUB_DEDUP_WINDOW_MINUTES,
        async () => {
          const query = encodeURIComponent(`${keyword} in:title,body type:issue`);
          const issueResponse = await fetch(
            `https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=${Math.min(maxResults, 30)}`,
            { headers }
          );
          if (!issueResponse.ok) {
            logger.warn("[GitHub] Issue search failed", { keyword, status: issueResponse.status });
            return [];
          }
          const data = await issueResponse.json();
          return (data.items as GitHubIssue[]) || [];
        },
      );

      for (const item of items) {
        // Dedup across keywords within this run too (e.g., same issue surfaces
        // for both "notion" and "notion alternative" lookups).
        if (!issues.find(i => i.id === item.id)) {
          issues.push(item);
        }
      }

      // Only rate-limit on actual API calls, not cache hits
      if (!cached) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Search discussions via GraphQL (if token available). Same dedup logic
    // as issues — each keyword query is keyword-scoped.
    if (token) {
      for (const keyword of keywords.slice(0, 3)) { // Limit discussions search
        try {
          const { data: nodes, cached } = await dedupedScan<GitHubDiscussion[]>(
            "github",
            `discussions:${keyword}`,
            GITHUB_DEDUP_WINDOW_MINUTES,
            async () => {
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
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ query: graphqlQuery }),
              });
              if (!graphqlResponse.ok) return [];
              const data = await graphqlResponse.json();
              return (data.data?.search?.nodes as GitHubDiscussion[]) || [];
            },
          );

          for (const node of nodes) {
            if (node && !discussions.find(d => d.id === node.id)) {
              discussions.push(node);
            }
          }

          if (!cached) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          logger.warn("[GitHub] Discussion search failed", { keyword, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return { issues, discussions, source: "api" };
  } catch (error) {
    logger.error("[GitHub] Search failed", { error: error instanceof Error ? error.message : String(error) });
    return { issues: [], discussions: [], source: "api" };
  }
}

// Scan GitHub Issues and Discussions for matches
export const monitorGitHub = inngest.createFunction(
  {
    id: "monitor-github",
    name: "Monitor GitHub",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "42 */2 * * *" }, // :42 on even hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    const githubMonitors = await getActiveMonitors("github", step);
    if (githubMonitors.length === 0) {
      return { message: "No active GitHub monitors" };
    }

    const planMap = await prefetchPlans(githubMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < githubMonitors.length; i++) {
      const monitor = githubMonitors[i];

      await applyStagger(i, githubMonitors.length, "github", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "github")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

      // Search GitHub
      const searchResult = await step.run(`search-github-${monitor.id}`, async () => {
        return searchGitHub(monitor.keywords, 50);
      });

      logger.info("[GitHub] Found results", { issueCount: searchResult.issues.length, discussionCount: searchResult.discussions.length });

      // Filter matching issues
      const matchingIssues = searchResult.issues.filter(issue => {
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
        return matchResult.matches;
      });

      // Filter matching discussions
      const matchingDiscussions = searchResult.discussions.filter(discussion => {
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
        return matchResult.matches;
      });

      // Save matching issues and discussions as results (manual combined batch)
      if (matchingIssues.length > 0 || matchingDiscussions.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          // Collect all URLs for batch duplicate check
          const allUrls = [
            ...matchingIssues.map(issue => issue.html_url),
            ...matchingDiscussions.map(discussion => discussion.url),
          ];

          if (allUrls.length === 0) return;

          const existing = await pooledDb.query.results.findMany({
            where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, allUrls)),
            columns: { sourceUrl: true },
          });
          const existingUrls = new Set(existing.map(r => r.sourceUrl));

          // Build batch of new results from issues and discussions
          const newIssueValues = matchingIssues
            .filter(issue => !existingUrls.has(issue.html_url))
            .map(issue => ({
              monitorId: monitor.id,
              platform: "github" as const,
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
            }));

          const newDiscussionValues = matchingDiscussions
            .filter(discussion => !existingUrls.has(discussion.url))
            .map(discussion => ({
              monitorId: monitor.id,
              platform: "github" as const,
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
            }));

          const allNewValues = [...newIssueValues, ...newDiscussionValues];

          if (allNewValues.length === 0) return;

          // Batch insert all new results
          const inserted = await pooledDb.insert(results).values(allNewValues).returning();

          // Track new result IDs
          for (const result of inserted) {
            totalResults++;
            monitorMatchCount++;
            newResultIds.push(result.id);
          }

          // Single batch usage increment
          await incrementResultsCount(monitor.userId, inserted.length);
        });
      }

      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "github", step);

      monitorResults[monitor.id] = monitorMatchCount;
      await updateMonitorStats(monitor.id, monitorMatchCount, step, { userId: monitor.userId, platform: "github" });
    }

    return {
      message: `Scanned GitHub, found ${totalResults} new matching items`,
      totalResults,
      monitorResults,
    };
  }
);
