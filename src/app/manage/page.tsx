import { db } from "@/lib/db";
import { users, monitors, results, aiLogs } from "@/lib/db/schema";
import { count, sum, desc, sql, gte } from "drizzle-orm";
import { ResponsiveManage } from "@/components/admin/responsive-manage";

async function getAdminStats() {
  const [
    totalUsers,
    totalMonitors,
    totalResults,
    totalAiCost,
    activeMonitors,
    usersToday,
    resultsToday,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(monitors),
    db.select({ count: count() }).from(results),
    db.select({ total: sum(aiLogs.costUsd) }).from(aiLogs),
    db.select({ count: count() }).from(monitors).where(sql`${monitors.isActive} = true`),
    db.select({ count: count() }).from(users).where(
      gte(users.createdAt, sql`NOW() - INTERVAL '24 hours'`)
    ),
    db.select({ count: count() }).from(results).where(
      gte(results.createdAt, sql`NOW() - INTERVAL '24 hours'`)
    ),
  ]);

  return {
    totalUsers: totalUsers[0]?.count || 0,
    totalMonitors: totalMonitors[0]?.count || 0,
    totalResults: totalResults[0]?.count || 0,
    totalAiCost: Number(totalAiCost[0]?.total) || 0,
    activeMonitors: activeMonitors[0]?.count || 0,
    usersToday: usersToday[0]?.count || 0,
    resultsToday: resultsToday[0]?.count || 0,
  };
}

async function getSubscriptionBreakdown() {
  const breakdown = await db
    .select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus);

  return breakdown;
}

async function getRecentUsers() {
  const recentUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10);

  return recentUsers;
}

async function getAiCostsByDay() {
  const costs = await db
    .select({
      date: sql<string>`DATE(${aiLogs.createdAt})`,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, sql`NOW() - INTERVAL '30 days'`))
    .groupBy(sql`DATE(${aiLogs.createdAt})`)
    .orderBy(desc(sql`DATE(${aiLogs.createdAt})`))
    .limit(30);

  return costs;
}

async function getUserGrowth() {
  const growth = await db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, sql`NOW() - INTERVAL '30 days'`))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);

  return growth;
}

async function getPlatformDistribution() {
  const distribution = await db
    .select({
      platform: results.platform,
      count: count(),
    })
    .from(results)
    .groupBy(results.platform);

  return distribution;
}

async function getSentimentBreakdown() {
  const breakdown = await db
    .select({
      sentiment: results.sentiment,
      count: count(),
    })
    .from(results)
    .groupBy(results.sentiment);

  return breakdown;
}

export default async function ManagePage() {
  // Auth is handled by the layout - in dev mode, no auth required
  const [stats, subscriptionBreakdown, recentUsers, aiCosts, userGrowth, platformDist, sentimentDist] = await Promise.all([
    getAdminStats(),
    getSubscriptionBreakdown(),
    getRecentUsers(),
    getAiCostsByDay(),
    getUserGrowth(),
    getPlatformDistribution(),
    getSentimentBreakdown(),
  ]);

  const freeUsers = subscriptionBreakdown.find(s => s.status === "free")?.count || 0;
  const proUsers = subscriptionBreakdown.find(s => s.status === "pro")?.count || 0;
  const enterpriseUsers = subscriptionBreakdown.find(s => s.status === "enterprise")?.count || 0;

  return (
    <ResponsiveManage
      stats={stats}
      freeUsers={freeUsers}
      proUsers={proUsers}
      enterpriseUsers={enterpriseUsers}
      userGrowth={userGrowth}
      aiCosts={aiCosts}
      platformDist={platformDist}
      sentimentDist={sentimentDist}
      recentUsers={recentUsers}
    />
  );
}
