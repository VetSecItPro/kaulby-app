import { db } from "@/lib/db";
import { users, monitors, results, aiLogs } from "@/lib/db/schema";
import { count, sum, desc, sql, gte, and, lt, eq } from "drizzle-orm";
import { ResponsiveManage } from "@/components/admin/responsive-manage";
import { PLANS } from "@/lib/stripe";

// Force dynamic rendering - this page requires database access
export const dynamic = "force-dynamic";

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

async function getSystemHealth() {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Get AI call stats for last 24h
  const [aiStats, recentAiLogs] = await Promise.all([
    db
      .select({
        totalCalls: count(),
        avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo)),
    db
      .select({
        createdAt: aiLogs.createdAt,
        latencyMs: aiLogs.latencyMs,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo))
      .orderBy(desc(aiLogs.createdAt))
      .limit(100),
  ]);

  // Calculate error rate (assume latency > 10000ms or null latency is an error)
  const errorCount = recentAiLogs.filter(
    (log) => log.latencyMs === null || log.latencyMs > 10000
  ).length;
  const errorRate24h = recentAiLogs.length > 0 ? (errorCount / recentAiLogs.length) * 100 : 0;

  // Simulate job data - in production, this would come from Inngest API
  const jobs = [
    {
      name: "run-monitors",
      lastRun: recentAiLogs[0]?.createdAt || null,
      status: "success" as const,
      runsLast24h: Math.floor((aiStats[0]?.totalCalls || 0) / 10),
      failuresLast24h: errorCount,
    },
    {
      name: "send-daily-digest",
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      status: "success" as const,
      runsLast24h: 1,
      failuresLast24h: 0,
    },
    {
      name: "send-weekly-digest",
      lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: "success" as const,
      runsLast24h: 0,
      failuresLast24h: 0,
    },
  ];

  // Health checks - assume healthy if we can query the database
  const healthChecks = {
    database: true, // If we got this far, database is working
    ai: aiStats[0]?.totalCalls ? aiStats[0].totalCalls > 0 : true,
    email: true, // Assume healthy
    stripe: true, // Assume healthy
  };

  return {
    jobs,
    errorRate24h,
    avgResponseTime: Number(aiStats[0]?.avgLatency) || 0,
    totalApiCalls24h: Number(aiStats[0]?.totalCalls) || 0,
    healthChecks,
  };
}

async function getCostBreakdown() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get cost by plan
  const costByPlanQuery = await db
    .select({
      plan: users.subscriptionStatus,
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      totalCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(users.subscriptionStatus);

  const costByPlan = costByPlanQuery.map((item) => ({
    plan: item.plan || "free",
    userCount: Number(item.userCount) || 0,
    totalCost: Number(item.totalCost) || 0,
    avgCostPerUser:
      Number(item.userCount) > 0
        ? Number(item.totalCost) / Number(item.userCount)
        : 0,
  }));

  // Get top users by cost
  const topUsersByCostQuery = await db
    .select({
      userId: aiLogs.userId,
      email: users.email,
      name: users.name,
      plan: users.subscriptionStatus,
      totalCost: sum(aiLogs.costUsd),
      aiCalls: count(),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(10);

  const topUsersByCost = topUsersByCostQuery.map((user) => ({
    userId: user.userId || "",
    email: user.email,
    name: user.name,
    plan: user.plan || "free",
    totalCost: Number(user.totalCost) || 0,
    aiCalls: Number(user.aiCalls) || 0,
  }));

  // Calculate averages
  const [totalStats, resultsCount] = await Promise.all([
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, thirtyDaysAgo)),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, thirtyDaysAgo)),
  ]);

  const totalCost = Number(totalStats[0]?.totalCost) || 0;
  const totalUsersWithCost = Number(totalStats[0]?.userCount) || 0;
  const totalResults = resultsCount[0]?.count || 0;

  // Paid users cost
  const paidUsersCostQuery = await db
    .select({
      totalCost: sum(aiLogs.costUsd),
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(
      and(
        gte(aiLogs.createdAt, thirtyDaysAgo),
        sql`${users.subscriptionStatus} IN ('pro', 'enterprise')`
      )
    );

  const paidTotalCost = Number(paidUsersCostQuery[0]?.totalCost) || 0;
  const paidUserCount = Number(paidUsersCostQuery[0]?.userCount) || 0;

  return {
    costByPlan,
    topUsersByCost,
    avgCostPerUser: totalUsersWithCost > 0 ? totalCost / totalUsersWithCost : 0,
    avgCostPerPaidUser: paidUserCount > 0 ? paidTotalCost / paidUserCount : 0,
    costPerResult: totalResults > 0 ? totalCost / totalResults : 0,
  };
}

async function getBusinessMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get current subscription counts
  const [currentSubs, lastMonthSubs, monthlySignups] = await Promise.all([
    // Current subscription breakdown
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus),

    // Last month subscription breakdown (users who existed before end of last month)
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(lt(users.createdAt, startOfMonth))
    .groupBy(users.subscriptionStatus),

    // New signups this month
    db.select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, startOfMonth)),
  ]);

  // Calculate current MRR
  const currentProUsers = currentSubs.find(s => s.status === "pro")?.count || 0;
  const currentEnterpriseUsers = currentSubs.find(s => s.status === "enterprise")?.count || 0;
  const currentFreeUsers = currentSubs.find(s => s.status === "free")?.count || 0;
  const totalUsers = currentProUsers + currentEnterpriseUsers + currentFreeUsers;

  const mrr = (currentProUsers * PLANS.pro.price) + (currentEnterpriseUsers * PLANS.enterprise.price);

  // Calculate last month MRR for comparison
  const lastMonthProUsers = lastMonthSubs.find(s => s.status === "pro")?.count || 0;
  const lastMonthEnterpriseUsers = lastMonthSubs.find(s => s.status === "enterprise")?.count || 0;
  const lastMonthMrr = (lastMonthProUsers * PLANS.pro.price) + (lastMonthEnterpriseUsers * PLANS.enterprise.price);

  // MRR change percentage
  const mrrChange = lastMonthMrr > 0 ? ((mrr - lastMonthMrr) / lastMonthMrr) * 100 : (mrr > 0 ? 100 : 0);

  // ARR (Annual Recurring Revenue)
  const arr = mrr * 12;

  // ARPU (Average Revenue Per User) - across all users including free
  const avgRevenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;

  // Paid user percentage
  const paidUserPercentage = totalUsers > 0 ? ((currentProUsers + currentEnterpriseUsers) / totalUsers) * 100 : 0;

  // Conversion metrics
  const proConversions = currentProUsers - lastMonthProUsers;
  const enterpriseConversions = currentEnterpriseUsers - lastMonthEnterpriseUsers;

  // Calculate conversion rate (paid users / total users)
  const conversionRate = totalUsers > 0 ? ((currentProUsers + currentEnterpriseUsers) / totalUsers) * 100 : 0;

  // Last month conversion rate for comparison
  const lastMonthTotalUsers = lastMonthProUsers + lastMonthEnterpriseUsers + (lastMonthSubs.find(s => s.status === "free")?.count || 0);
  const lastMonthConversionRate = lastMonthTotalUsers > 0
    ? ((lastMonthProUsers + lastMonthEnterpriseUsers) / lastMonthTotalUsers) * 100
    : 0;
  const conversionRateChange = conversionRate - lastMonthConversionRate;

  return {
    mrr,
    mrrChange,
    arr,
    conversionRate,
    conversionRateChange,
    avgRevenuePerUser,
    proConversions: Math.max(0, proConversions),
    enterpriseConversions: Math.max(0, enterpriseConversions),
    monthlySignups: monthlySignups[0]?.count || 0,
    paidUserPercentage,
  };
}

export default async function ManagePage() {
  // Auth is handled by the layout - in dev mode, no auth required
  const [stats, subscriptionBreakdown, recentUsers, aiCosts, userGrowth, platformDist, sentimentDist, businessMetrics, costBreakdown, systemHealth] = await Promise.all([
    getAdminStats(),
    getSubscriptionBreakdown(),
    getRecentUsers(),
    getAiCostsByDay(),
    getUserGrowth(),
    getPlatformDistribution(),
    getSentimentBreakdown(),
    getBusinessMetrics(),
    getCostBreakdown(),
    getSystemHealth(),
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
      businessMetrics={businessMetrics}
      costBreakdown={costBreakdown}
      systemHealth={systemHealth}
    />
  );
}
