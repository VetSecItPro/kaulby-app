import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { errorLogs, users } from "@/lib/db/schema";
import { eq, desc, and, gte, lte, or, ilike, count, sql } from "drizzle-orm";

/**
 * GET /api/admin/errors
 * Fetch error logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const level = searchParams.get("level"); // error, warning, fatal
  const source = searchParams.get("source"); // api, inngest, ai, webhook, auth
  const resolved = searchParams.get("resolved"); // true, false
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Build filters
  const filters = [];

  if (level) {
    filters.push(eq(errorLogs.level, level));
  }

  if (source) {
    filters.push(eq(errorLogs.source, source));
  }

  if (resolved !== null && resolved !== undefined && resolved !== "") {
    filters.push(eq(errorLogs.resolved, resolved === "true"));
  }

  if (search) {
    filters.push(
      or(
        ilike(errorLogs.message, `%${search}%`),
        ilike(errorLogs.endpoint, `%${search}%`),
        ilike(errorLogs.stack, `%${search}%`)
      )
    );
  }

  if (startDate) {
    filters.push(gte(errorLogs.createdAt, new Date(startDate)));
  }

  if (endDate) {
    filters.push(lte(errorLogs.createdAt, new Date(endDate)));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(errorLogs)
    .where(whereClause);

  const total = totalResult?.count || 0;

  // Get errors with pagination
  const errors = await db.query.errorLogs.findMany({
    where: whereClause,
    orderBy: [desc(errorLogs.createdAt)],
    limit,
    offset: (page - 1) * limit,
  });

  // Get summary stats
  const [stats] = await db
    .select({
      totalErrors: count(),
      unresolvedCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.resolved} = false)`,
      errorCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'error')`,
      warningCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'warning')`,
      fatalCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'fatal')`,
    })
    .from(errorLogs)
    .where(
      and(
        startDate ? gte(errorLogs.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(errorLogs.createdAt, new Date(endDate)) : undefined
      )
    );

  // Get errors by source
  const sourceBreakdown = await db
    .select({
      source: errorLogs.source,
      count: count(),
    })
    .from(errorLogs)
    .where(
      and(
        startDate ? gte(errorLogs.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(errorLogs.createdAt, new Date(endDate)) : undefined
      )
    )
    .groupBy(errorLogs.source);

  return NextResponse.json({
    errors,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      total: Number(stats?.totalErrors) || 0,
      unresolved: Number(stats?.unresolvedCount) || 0,
      byLevel: {
        error: Number(stats?.errorCount) || 0,
        warning: Number(stats?.warningCount) || 0,
        fatal: Number(stats?.fatalCount) || 0,
      },
      bySource: sourceBreakdown.reduce((acc, s) => {
        acc[s.source] = Number(s.count);
        return acc;
      }, {} as Record<string, number>),
    },
  });
}
