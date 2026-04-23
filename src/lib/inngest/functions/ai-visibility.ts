import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { users, monitors, aiVisibilityChecks } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { checkAIVisibility } from "@/lib/ai/ai-visibility";
import { flushAI } from "@/lib/ai/openrouter";

/**
 * Weekly AI Visibility Check
 *
 * Runs every Sunday at 8 AM UTC. For each Team tier user with monitors
 * that have a companyName set, queries AI models to check whether the
 * brand appears in AI-generated responses.
 */
export const checkAIVisibilityJob = inngest.createFunction(
  {
    id: "check-ai-visibility",
    name: "Check AI Visibility",
    retries: 2,
    timeouts: { finish: "15m" },
    concurrency: {
      limit: 2, // Limit concurrent runs to control AI costs
    },
  },
  { cron: "0 8 1 * *" }, // Monthly on the 1st at 8 AM UTC (AI model responses don't shift weekly)
  async ({ step }) => {
    // Get all Team tier users
    const teamUsers = await step.run("get-team-users", async () => {
      return pooledDb.query.users.findMany({
        where: eq(users.subscriptionStatus, "growth"),
        columns: { id: true },
      });
    });

    if (teamUsers.length === 0) {
      logger.info("AI visibility check: no team users found");
      return { checked: 0, brands: 0, results: 0 };
    }

    let totalBrands = 0;
    let totalResults = 0;

    for (const user of teamUsers) {
      const userMonitors = await step.run(
        `get-monitors-${user.id}`,
        async () => {
          return pooledDb.query.monitors.findMany({
            where: and(
              eq(monitors.userId, user.id),
              eq(monitors.isActive, true),
              isNotNull(monitors.companyName)
            ),
            columns: {
              id: true,
              companyName: true,
              name: true,
              keywords: true,
            },
          });
        }
      );

      // Deduplicate brands across monitors
      const brandMap = new Map<string, { monitorId: string; companyName: string; keywords: string[] }>();
      for (const m of userMonitors) {
        if (m.companyName) {
          const key = m.companyName.toLowerCase();
          if (!brandMap.has(key)) {
            brandMap.set(key, { monitorId: m.id, companyName: m.companyName, keywords: m.keywords ?? [] });
          }
        }
      }

      for (const [, brand] of brandMap) {
        const visibilityResults = await step.run(
          `check-visibility-${user.id}-${brand.monitorId}`,
          async () => {
            // Derive industry from monitor keywords as a heuristic
            const industry = brand.keywords?.slice(0, 3).join(", ") || "software";
            const results = await checkAIVisibility(brand.companyName, industry);

            // Save results to the database
            if (results.length > 0) {
              await pooledDb.insert(aiVisibilityChecks).values(
                results.map((r) => ({
                  userId: user.id,
                  monitorId: brand.monitorId,
                  brandName: brand.companyName,
                  model: r.model,
                  query: r.query,
                  mentioned: r.mentioned,
                  position: r.position,
                  context: r.context,
                  competitors: r.competitors,
                  checkedAt: r.checkedAt,
                }))
              );
            }

            return results.length;
          }
        );

        totalBrands++;
        totalResults += visibilityResults;
      }
    }

    // Flush Langfuse traces
    await step.run("flush-ai", async () => {
      await flushAI();
    });

    logger.info("AI visibility check completed", {
      teamUsers: teamUsers.length,
      brands: totalBrands,
      results: totalResults,
    });

    return {
      checked: teamUsers.length,
      brands: totalBrands,
      results: totalResults,
    };
  }
);
