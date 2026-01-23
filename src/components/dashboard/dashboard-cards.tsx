"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Target,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  Flame,
  AlertCircle,
  Zap,
  Trophy,
  ArrowRight,
  ExternalLink,
  Inbox,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformDisplayName } from "@/lib/platform-utils";

// Types for the actionable dashboard data
export interface ActionableInsight {
  // Actionable items
  respondNow: ActionableResult[];
  respondNowCount: number;

  highIntentLeads: (ActionableResult & { leadScore: number | null })[];
  highIntentCount: number;

  negativeAttention: ActionableResult[];
  negativeCount: number;

  engageToday: (ActionableResult & { engagement: number })[];
  engageTodayCount: number;

  painPoints: ActionableResult[];
  painPointCount: number;

  // Summary
  unreadCount: number;
  todayCount: number;

  // Spike
  hasSpike: boolean;
  spikeMessage: string | null;

  // Top opportunity
  topOpportunity: {
    id: string;
    title: string;
    platform: string;
    sourceUrl: string;
    reason: string;
  } | null;

  // Gamification
  engagedThisWeek: number;
}

interface ActionableResult {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  createdAt: string;
}

interface DashboardCardsProps {
  data: ActionableInsight;
}

// Action card component for consistent styling with aligned buttons
const ActionCard = memo(function ActionCard({
  icon: Icon,
  iconBg,
  iconColor,
  count,
  label,
  sublabel,
  items,
  href,
  alert = false,
}: {
  icon: typeof Target;
  iconBg: string;
  iconColor: string;
  count: number;
  label: string;
  sublabel: string;
  items?: ActionableResult[];
  href: string;
  alert?: boolean;
}) {
  return (
    <Card
      className={cn(
        "h-full flex flex-col transition-all hover:shadow-md",
        alert && "border-amber-500/50 bg-amber-500/5"
      )}
    >
      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2 rounded-lg", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          {count > 0 && (
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                alert && "bg-amber-500 text-black hover:bg-amber-600"
              )}
            >
              {count}
            </Badge>
          )}
        </div>

        <p className="font-semibold text-sm mb-0.5">{label}</p>
        <p className="text-xs text-muted-foreground mb-3">{sublabel}</p>

        {/* Show top item preview if available - flex-1 to push button down */}
        <div className="flex-1 min-h-[48px]">
          {items && items.length > 0 ? (
            <div className="space-y-1.5">
              {items.slice(0, 2).map((item) => (
                <a
                  key={item.id}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  <span className="text-muted-foreground/60">
                    {getPlatformDisplayName(item.platform)}:
                  </span>{" "}
                  {item.title}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">None right now</p>
          )}
        </div>

        {/* Button always at bottom, aligned across cards */}
        <Link href={href} className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 h-9 text-xs bg-teal-500 text-black border-teal-500 hover:bg-teal-600 hover:border-teal-600 hover:text-black"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
});

export const DashboardCards = memo(function DashboardCards({
  data,
}: DashboardCardsProps) {
  return (
    <div className="space-y-4">
      {/* Top Opportunity - Full width highlight */}
      {data.topOpportunity && (
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20 shrink-0">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-primary uppercase tracking-wide">
                    Top Opportunity
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {data.topOpportunity.reason}
                  </Badge>
                </div>
                <p className="font-semibold truncate">{data.topOpportunity.title}</p>
                <p className="text-xs text-muted-foreground">
                  {getPlatformDisplayName(data.topOpportunity.platform)}
                </p>
              </div>
              <a
                href={data.topOpportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="gap-2 shrink-0 bg-teal-500 text-black hover:bg-teal-600">
                  Engage Now
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spike Alert - Full width if active */}
      {data.hasSpike && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  Activity Spike Detected
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.spikeMessage}
                </p>
              </div>
              <Link href="/dashboard/results">
                <Button className="gap-2 bg-teal-500 text-black hover:bg-teal-600">
                  Investigate
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 8 Action Cards in 2-column, 4-row Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {/* Row 1 */}
        {/* 1. Respond Now - Solution/Advice Requests */}
        <ActionCard
          icon={Target}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
          count={data.respondNowCount}
          label="Respond Now"
          sublabel="Asking for recommendations"
          items={data.respondNow}
          href="/dashboard/results?category=solution_request,advice_request"
        />

        {/* 2. High-Intent Leads */}
        <ActionCard
          icon={DollarSign}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          count={data.highIntentCount}
          label="High-Intent Leads"
          sublabel="Showing buying signals"
          items={data.highIntentLeads}
          href="/dashboard/results?sort=lead_score"
        />

        {/* Row 2 */}
        {/* 3. Negative Attention */}
        <ActionCard
          icon={AlertCircle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          count={data.negativeCount}
          label="Needs Attention"
          sublabel="Negative sentiment"
          items={data.negativeAttention}
          href="/dashboard/results?sentiment=negative"
          alert={data.negativeCount > 2}
        />

        {/* 4. Engage Today - Hot Posts */}
        <ActionCard
          icon={Flame}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
          count={data.engageTodayCount}
          label="Engage Today"
          sublabel="Hot posts (last 24h)"
          items={data.engageToday}
          href="/dashboard/results?sort=engagement"
        />

        {/* Row 3 */}
        {/* 5. Pain Points */}
        <ActionCard
          icon={MessageSquare}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
          count={data.painPointCount}
          label="Pain Points"
          sublabel="Problems to solve"
          items={data.painPoints}
          href="/dashboard/results?category=pain_point"
        />

        {/* 6. Unread Inbox */}
        <Card className="h-full flex flex-col transition-all hover:shadow-md">
          <CardContent className="p-4 flex flex-col flex-1">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Inbox className="h-4 w-4 text-blue-500" />
              </div>
              {data.unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {data.unreadCount}
                </Badge>
              )}
            </div>

            <p className="font-semibold text-sm mb-0.5">Unread Inbox</p>
            <p className="text-xs text-muted-foreground mb-3">Mentions awaiting review</p>

            <div className="flex-1 min-h-[48px]">
              <p className="text-3xl font-bold text-blue-500">{data.unreadCount}</p>
              <p className="text-xs text-muted-foreground">mentions to review</p>
            </div>

            <Link href="/dashboard/results?filter=unread" className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 h-9 text-xs bg-teal-500 text-black border-teal-500 hover:bg-teal-600 hover:border-teal-600 hover:text-black"
              >
                Review all
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Row 4 */}
        {/* 7. Today's Activity */}
        <Card className="h-full flex flex-col transition-all hover:shadow-md">
          <CardContent className="p-4 flex flex-col flex-1">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Calendar className="h-4 w-4 text-cyan-500" />
              </div>
              {data.todayCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {data.todayCount}
                </Badge>
              )}
            </div>

            <p className="font-semibold text-sm mb-0.5">Today&apos;s Activity</p>
            <p className="text-xs text-muted-foreground mb-3">New mentions from today</p>

            <div className="flex-1 min-h-[48px]">
              <p className="text-3xl font-bold text-cyan-500">{data.todayCount}</p>
              <p className="text-xs text-muted-foreground">new today</p>
            </div>

            <Link href="/dashboard/results?date=today" className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 h-9 text-xs bg-teal-500 text-black border-teal-500 hover:bg-teal-600 hover:border-teal-600 hover:text-black"
              >
                View today
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 8. Your Impact (Gamification) */}
        <Card className="h-full flex flex-col transition-all hover:shadow-md">
          <CardContent className="p-4 flex flex-col flex-1">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Trophy className="h-4 w-4 text-teal-500" />
              </div>
            </div>

            <p className="font-semibold text-sm mb-0.5">Your Impact</p>
            <p className="text-xs text-muted-foreground mb-3">This week&apos;s activity</p>

            <div className="flex-1 min-h-[48px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Posts reviewed</span>
                <span className="text-sm font-bold text-teal-500">
                  {data.engagedThisWeek}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Unread remaining</span>
                <span className="text-sm font-medium">{data.unreadCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">New today</span>
                <span className="text-sm font-medium">{data.todayCount}</span>
              </div>
            </div>

            <Link href="/dashboard/analytics" className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 h-9 text-xs bg-teal-500 text-black border-teal-500 hover:bg-teal-600 hover:border-teal-600 hover:text-black"
              >
                View analytics
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
