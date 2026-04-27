import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count, sql, gte, and, isNotNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, DollarSign, Users as UsersIcon, CreditCard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

async function getPaymentsData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    subscriptionBreakdown,
    paidUsersWithBilling,
    foundingMembers,
    recentConversions,
    totalUsersCount,
  ] = await Promise.all([
    // Subscription breakdown
    db
      .select({
        status: users.subscriptionStatus,
        count: count(),
      })
      .from(users)
      .groupBy(users.subscriptionStatus),

    // Paid users with billing period info (for annual vs monthly detection)
    db
      .select({
        subscriptionStatus: users.subscriptionStatus,
        currentPeriodStart: users.currentPeriodStart,
        currentPeriodEnd: users.currentPeriodEnd,
      })
      .from(users)
      .where(
        sql`${users.subscriptionStatus} IN ('pro', 'team')`
      ),

    // Founding members
    db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.isFoundingMember} = true`),

    // Recent conversions (users who got a polarSubscriptionId in last 30 days)
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        subscriptionStatus: users.subscriptionStatus,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.polarSubscriptionId),
          gte(users.updatedAt, thirtyDaysAgo),
          sql`${users.subscriptionStatus} IN ('pro', 'team')`
        )
      )
      .orderBy(sql`${users.updatedAt} DESC`)
      .limit(20),

    // Total users
    db.select({ count: count() }).from(users),
  ]);

  // Calculate MRR with annual vs monthly detection
  let mrr = 0;
  for (const user of paidUsersWithBilling) {
    const plan = user.subscriptionStatus as "solo" | "growth";
    const monthlyPrice = PLANS[plan]?.price ?? 0;
    const annualPrice = PLANS[plan]?.annualPrice ?? 0;

    // Detect annual billing by checking if billing period is ~1 year
    let isAnnual = false;
    if (user.currentPeriodStart && user.currentPeriodEnd) {
      const periodMs = new Date(user.currentPeriodEnd).getTime() - new Date(user.currentPeriodStart).getTime();
      const periodDays = periodMs / (1000 * 60 * 60 * 24);
      isAnnual = periodDays > 60; // > 60 days = annual billing
    }

    if (isAnnual) {
      mrr += annualPrice / 12;
    } else {
      mrr += monthlyPrice;
    }
  }

  const arr = mrr * 12;

  const subMap: Record<string, number> = {};
  for (const s of subscriptionBreakdown) {
    subMap[s.status] = s.count;
  }

  const totalUsers = totalUsersCount[0]?.count || 0;
  const freeUsers = subMap["free"] || 0;
  const soloUsers = subMap["solo"] || 0;
  const scaleUsers = subMap["scale"] || 0;
  const growthUsers = subMap["growth"] || 0;
  const paidUsers = soloUsers + scaleUsers + growthUsers;
  const churnRate = totalUsers > 0
    ? ((totalUsers - paidUsers - freeUsers) / totalUsers) * 100
    : 0;

  // Fetch recent transactions from Polar API
  let recentTransactions: Array<{
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    productName: string;
    customerEmail: string;
  }> = [];

  let activeSubscriptions = 0;

  try {
    const orgId = process.env.POLAR_ORG_ID;
    const token = process.env.POLAR_ACCESS_TOKEN;
    if (orgId && token) {
      const [ordersRes, subsRes] = await Promise.all([
        fetch(`https://api.polar.sh/v1/orders?organization_id=${orgId}&limit=20&sorting=-created_at`, {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 0 },
        }),
        fetch(`https://api.polar.sh/v1/subscriptions?organization_id=${orgId}&active=true&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 0 },
        }),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        recentTransactions = (ordersData.items || []).map((o: Record<string, unknown>) => ({
          id: o.id as string,
          amount: (o.amount as number) / 100,
          currency: (o.currency as string) || "usd",
          createdAt: o.created_at as string,
          productName: ((o.product as Record<string, unknown>)?.name as string) || "Unknown",
          customerEmail: ((o.customer as Record<string, unknown>)?.email as string) || "N/A",
        }));
      }

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        activeSubscriptions = subsData.pagination?.total_count ?? (subsData.items?.length || 0);
      }
    }
  } catch {
    // Silently fail - we'll show DB data
  }

  return {
    mrr,
    arr,
    freeUsers,
    soloUsers,
    scaleUsers,
    growthUsers,
    paidUsers,
    totalUsers,
    churnRate,
    foundingMemberCount: foundingMembers[0]?.count || 0,
    recentConversions,
    recentTransactions,
    activeSubscriptions,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PaymentsPage() {
  // Auth + admin check handled by /manage/layout.tsx
  const data = await getPaymentsData();

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Polar financials, subscriptions, and revenue</p>
          </div>
        </div>
        <Badge variant="outline" className="border-green-500 text-green-500">
          Operational
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(data.mrr)}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.arr)}</div>
            <p className="text-xs text-muted-foreground">Annual recurring revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.paidUsers}</div>
            <p className="text-xs text-muted-foreground">
              Polar: {data.activeSubscriptions} active subs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalUsers > 0 ? ((data.paidUsers / data.totalUsers) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.paidUsers} of {data.totalUsers} users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Subscription Breakdown
          </CardTitle>
          <CardDescription>User distribution by plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Monthly Price</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Badge variant="secondary">Free</Badge>
                </TableCell>
                <TableCell className="text-right">{data.freeUsers}</TableCell>
                <TableCell className="text-right">$0</TableCell>
                <TableCell className="text-right">
                  {data.totalUsers > 0 ? ((data.freeUsers / data.totalUsers) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge className="bg-primary">Solo</Badge>
                </TableCell>
                <TableCell className="text-right">{data.soloUsers}</TableCell>
                <TableCell className="text-right">${PLANS.solo.price}/mo</TableCell>
                <TableCell className="text-right">
                  {data.totalUsers > 0 ? ((data.soloUsers / data.totalUsers) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge className="bg-purple-500">Scale</Badge>
                </TableCell>
                <TableCell className="text-right">{data.scaleUsers}</TableCell>
                <TableCell className="text-right">${PLANS.scale.price}/mo</TableCell>
                <TableCell className="text-right">
                  {data.totalUsers > 0 ? ((data.scaleUsers / data.totalUsers) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Badge className="bg-amber-500">Growth</Badge>
                </TableCell>
                <TableCell className="text-right">{data.growthUsers}</TableCell>
                <TableCell className="text-right">${PLANS.growth.price}/mo</TableCell>
                <TableCell className="text-right">
                  {data.totalUsers > 0 ? ((data.growthUsers / data.totalUsers) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Founding Members */}
      <Card className="border-amber-500/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Founding Members
          </CardTitle>
          <CardDescription>First 1,000 Pro/Team subscribers with locked-in pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold">{data.foundingMemberCount}</div>
            <div className="text-muted-foreground">/ 1,000</div>
            <div className="flex-1 h-3 bg-muted rounded-full">
              <div
                className="h-3 rounded-full bg-amber-500"
                style={{ width: `${Math.min((data.foundingMemberCount / 1000) * 100, 100)}%` }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {((data.foundingMemberCount / 1000) * 100).toFixed(1)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions from Polar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Recent Transactions (Polar)
          </CardTitle>
          <CardDescription>Latest orders from Polar.sh</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{tx.customerEmail}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tx.productName}</code>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-500">
                      ${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No recent transactions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Conversions (30d)</CardTitle>
          <CardDescription>Users who upgraded to paid plans</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentConversions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentConversions.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.subscriptionStatus === "growth" ? "bg-amber-500" : "bg-primary"}>
                        {user.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No recent conversions</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
