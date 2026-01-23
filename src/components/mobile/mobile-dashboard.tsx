"use client";

import { motion } from "framer-motion";
import { Radio, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MobileDashboardProps {
  monitorsCount: number;
  resultsCount: number;
  limits: {
    monitors: number;
    results: number;
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function MobileDashboard({
  monitorsCount,
  resultsCount,
  limits,
}: MobileDashboardProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Track your brand mentions
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Radio}
          label="Monitors"
          value={monitorsCount}
          subtitle={
            limits.monitors === Infinity
              ? "Unlimited"
              : `of ${limits.monitors}`
          }
          color="bg-teal-500/10 text-teal-500"
        />
        <StatCard
          icon={MessageSquare}
          label="Results"
          value={resultsCount}
          subtitle={
            limits.results === Infinity
              ? "Unlimited"
              : `of ${limits.results.toLocaleString()}`
          }
          color="bg-blue-500/10 text-blue-500"
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-3">
          <QuickActionCard
            href="/dashboard/monitors"
            title="View Monitors"
            description="Manage your active monitors"
            icon={Radio}
          />
          <QuickActionCard
            href="/dashboard/results"
            title="Recent Results"
            description="See latest mentions"
            icon={MessageSquare}
          />
        </div>
      </motion.div>

      {/* Empty State */}
      {monitorsCount === 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Radio className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Get Started</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first monitor to start tracking mentions
              </p>
              <Link href="/dashboard/monitors/new">
                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-black">Create Monitor</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtitle: string;
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
            {label} <span className="opacity-70">{subtitle}</span>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link href={href}>
      <motion.div whileTap={{ scale: 0.98 }}>
        <Card className="hover:bg-accent/50 transition-colors">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
