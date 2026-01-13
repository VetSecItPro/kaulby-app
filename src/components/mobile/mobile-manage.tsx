"use client";

import { motion } from "framer-motion";
import {
  Users,
  Radio,
  MessageSquare,
  DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalUsers: number;
  totalMonitors: number;
  totalResults: number;
  totalAiCost: number;
  activeMonitors: number;
  usersToday: number;
  resultsToday: number;
}

interface PlatformDist {
  platform: string;
  count: number;
}

interface SentimentDist {
  sentiment: string | null;
  count: number;
}

interface RecentUser {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionStatus: string | null;
  createdAt: Date | null;
}

interface MobileManageProps {
  stats: Stats;
  freeUsers: number;
  proUsers: number;
  enterpriseUsers: number;
  platformDist: PlatformDist[];
  sentimentDist: SentimentDist[];
  recentUsers: RecentUser[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const platformColors: Record<string, string> = {
  reddit: "bg-orange-500",
  hackernews: "bg-amber-500",
  producthunt: "bg-red-500",
  twitter: "bg-sky-500",
  devto: "bg-violet-500",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-gray-500",
};

export function MobileManage({
  stats,
  freeUsers,
  proUsers,
  enterpriseUsers,
  platformDist,
  sentimentDist,
  recentUsers,
}: MobileManageProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-muted-foreground text-sm">Platform analytics</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Admin
        </Badge>
      </motion.div>

      {/* Quick Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <MobileStatCard
          icon={Users}
          label="Users"
          value={stats.totalUsers}
          sublabel={`+${stats.usersToday} today`}
          color="bg-blue-500/10 text-blue-500"
        />
        <MobileStatCard
          icon={Radio}
          label="Monitors"
          value={stats.activeMonitors}
          sublabel={`${stats.totalMonitors} total`}
          color="bg-teal-500/10 text-teal-500"
        />
        <MobileStatCard
          icon={MessageSquare}
          label="Results"
          value={stats.totalResults}
          sublabel={`+${stats.resultsToday} today`}
          color="bg-purple-500/10 text-purple-500"
        />
        <MobileStatCard
          icon={DollarSign}
          label="AI Costs"
          value={`$${stats.totalAiCost.toFixed(2)}`}
          sublabel="All time"
          color="bg-amber-500/10 text-amber-500"
        />
      </motion.div>

      {/* Subscription Breakdown */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Subscriptions
        </h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <SubscriptionBar
              label="Free"
              value={freeUsers}
              total={stats.totalUsers}
              color="bg-muted-foreground/50"
            />
            <SubscriptionBar
              label="Pro"
              value={proUsers}
              total={stats.totalUsers}
              color="bg-primary"
            />
            <SubscriptionBar
              label="Enterprise"
              value={enterpriseUsers}
              total={stats.totalUsers}
              color="bg-amber-500"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Platform Distribution */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Platforms
        </h2>
        <Card>
          <CardContent className="p-4 space-y-3">
            {platformDist.length > 0 ? (
              platformDist.map((p) => {
                const total = platformDist.reduce((sum, x) => sum + x.count, 0);
                const percentage = total > 0 ? (p.count / total) * 100 : 0;
                return (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{p.platform}</span>
                      <span className="text-muted-foreground">
                        {p.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${platformColors[p.platform] || "bg-primary"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No data yet
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sentiment Distribution */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Sentiment
        </h2>
        <Card>
          <CardContent className="p-4 space-y-3">
            {sentimentDist.filter((s) => s.sentiment).length > 0 ? (
              sentimentDist
                .filter((s) => s.sentiment)
                .map((s) => {
                  const total = sentimentDist.reduce((sum, x) => sum + x.count, 0);
                  const percentage = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.sentiment} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{s.sentiment}</span>
                        <span className="text-muted-foreground">
                          {s.count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${sentimentColors[s.sentiment || ""] || "bg-primary"}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No data yet
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Users */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Users
        </h2>
        <Card>
          <CardContent className="p-0 divide-y">
            {recentUsers.length > 0 ? (
              recentUsers.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant={user.subscriptionStatus === "free" ? "secondary" : "default"}
                    className="capitalize shrink-0 text-xs"
                  >
                    {user.subscriptionStatus || "free"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-6 text-sm">
                No users yet
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function MobileStatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel: string;
  color: string;
}) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Card>
        <CardContent className="p-4">
          <div className={`p-2 rounded-full w-fit ${color} mb-3`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">
            {label} <span className="opacity-70">{sublabel}</span>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SubscriptionBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
