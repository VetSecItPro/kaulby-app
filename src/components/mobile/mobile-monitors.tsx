"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Radio, ChevronRight, Play, Pause, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  createdAt: Date;
}

interface MobileMonitorsProps {
  monitors: Monitor[];
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
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export function MobileMonitors({ monitors }: MobileMonitorsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold">Monitors</h1>
        <p className="text-muted-foreground text-sm">
          {monitors.length} active monitor{monitors.length !== 1 ? "s" : ""}
        </p>
      </motion.div>

      {/* Monitors List */}
      {monitors.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Radio className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No monitors yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first monitor to start tracking
              </p>
              <Link href="/dashboard/monitors/new">
                <Button className="w-full">Create Monitor</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {monitors.map((monitor, index) => (
              <motion.div
                key={monitor.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <MonitorCard monitor={monitor} index={index} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function MonitorCard({ monitor, index }: { monitor: Monitor; index: number }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link href={`/dashboard/monitors/${monitor.id}`}>
        <Card className="hover:bg-accent/50 transition-colors overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Status Indicator */}
              <div
                className={`mt-1 p-2 rounded-full ${
                  monitor.isActive
                    ? "bg-teal-500/10 text-teal-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {monitor.isActive ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{monitor.name}</h3>
                  <Badge
                    variant={monitor.isActive ? "default" : "secondary"}
                    className="shrink-0 text-xs"
                  >
                    {monitor.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>

                {/* Keywords */}
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {monitor.keywords.slice(0, 3).join(", ")}
                  {monitor.keywords.length > 3 && ` +${monitor.keywords.length - 3} more`}
                </p>

                {/* Platforms */}
                <div className="flex flex-wrap gap-1">
                  {monitor.platforms.map((platform) => (
                    <Badge
                      key={platform}
                      variant="outline"
                      className="text-xs capitalize"
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/monitors/${monitor.id}`}>
                      View Results
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
                      Edit
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
