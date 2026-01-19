import { db } from "@/lib/db";
import { users, monitors, usage } from "@/lib/db/schema";
import { eq, count, desc, like, or, sql, and, gte } from "drizzle-orm";
import { UsersManagement } from "@/components/admin/users-management";

interface SearchParams {
  search?: string;
  plan?: string;
  page?: string;
}

async function getUsers(searchParams: SearchParams) {
  const search = searchParams.search?.trim() || "";
  const planFilter = searchParams.plan || "all";
  const page = parseInt(searchParams.page || "1");
  const perPage = 20;
  const offset = (page - 1) * perPage;

  // Build where conditions
  const whereConditions = [];

  if (search) {
    whereConditions.push(
      or(
        like(users.email, `%${search}%`),
        like(users.name, `%${search}%`),
        like(users.id, `%${search}%`)
      )
    );
  }

  if (planFilter !== "all") {
    whereConditions.push(eq(users.subscriptionStatus, planFilter as "free" | "pro" | "enterprise"));
  }

  const whereClause = whereConditions.length > 0
    ? and(...whereConditions)
    : undefined;

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause);

  const total = totalResult?.count || 0;

  // Get paginated users with their stats
  const usersList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscriptionStatus: users.subscriptionStatus,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      banReason: users.banReason,
      bannedAt: users.bannedAt,
      polarCustomerId: users.polarCustomerId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(perPage)
    .offset(offset);

  // Get monitor counts for each user
  const userIds = usersList.map(u => u.id);
  const monitorCounts = userIds.length > 0 ? await db
    .select({
      userId: monitors.userId,
      count: count(),
    })
    .from(monitors)
    .where(sql`${monitors.userId} = ANY(${userIds})`)
    .groupBy(monitors.userId) : [];

  // Get current month usage for each user
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageData = userIds.length > 0 ? await db
    .select({
      userId: usage.userId,
      resultsCount: sql<number>`COALESCE(SUM(${usage.resultsCount}), 0)`,
      aiCallsCount: sql<number>`COALESCE(SUM(${usage.aiCallsCount}), 0)`,
    })
    .from(usage)
    .where(and(
      sql`${usage.userId} = ANY(${userIds})`,
      gte(usage.periodStart, startOfMonth)
    ))
    .groupBy(usage.userId) : [];

  // Combine data
  const usersWithStats = usersList.map(user => {
    const monitorCount = monitorCounts.find(m => m.userId === user.id)?.count || 0;
    const userUsage = usageData.find(u => u.userId === user.id);

    return {
      ...user,
      monitorsCount: monitorCount,
      resultsThisMonth: Number(userUsage?.resultsCount) || 0,
      aiCallsThisMonth: Number(userUsage?.aiCallsCount) || 0,
    };
  });

  return {
    users: usersWithStats,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

async function getPlanCounts() {
  const counts = await db
    .select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus);

  return {
    all: counts.reduce((sum, c) => sum + c.count, 0),
    free: counts.find(c => c.status === "free")?.count || 0,
    pro: counts.find(c => c.status === "pro")?.count || 0,
    enterprise: counts.find(c => c.status === "enterprise")?.count || 0,
  };
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [usersData, planCounts] = await Promise.all([
    getUsers(params),
    getPlanCounts(),
  ]);

  return (
    <UsersManagement
      users={usersData.users}
      total={usersData.total}
      page={usersData.page}
      totalPages={usersData.totalPages}
      perPage={usersData.perPage}
      planCounts={planCounts}
      currentSearch={params.search || ""}
      currentPlan={params.plan || "all"}
    />
  );
}
