"use client";

import { motion } from "framer-motion";
import { Check, Zap, User, CreditCard, Database, Download, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  current: boolean;
  recommended?: boolean;
}

interface DataStats {
  monitors: number;
  results: number;
  aiCalls: number;
}

interface TimezoneOption {
  value: string;
  label: string;
}

interface MobileSettingsProps {
  email: string;
  name: string;
  subscriptionStatus: string;
  timezone: string;
  timezoneOptions: readonly TimezoneOption[];
  onTimezoneChange: (timezone: string) => void;
  isSavingTimezone: boolean;
  plans: Plan[];
  dataStats: DataStats;
  onExportData: () => void;
  onDeleteAccount: () => void;
  isExporting: boolean;
  isDeleting: boolean;
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

// Helper to convert internal plan names to display names
function getPlanDisplayName(status: string): string {
  const displayNames: Record<string, string> = {
    enterprise: "Team",
    pro: "Pro",
    free: "Free",
  };
  return displayNames[status] || status;
}

export function MobileSettings({
  email,
  name,
  subscriptionStatus,
  timezone,
  timezoneOptions,
  onTimezoneChange,
  isSavingTimezone,
  plans,
  dataStats,
  onExportData,
  onDeleteAccount,
  isExporting,
  isDeleting,
}: MobileSettingsProps) {
  const planDisplayName = getPlanDisplayName(subscriptionStatus);
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account
        </p>
      </motion.div>

      {/* Account Section */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Account
        </h2>
        <Card>
          <CardContent className="p-0 divide-y">
            <div className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-muted">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Current Plan</p>
                <Badge
                  variant={subscriptionStatus === "free" ? "secondary" : "default"}
                  className="mt-1"
                >
                  {planDisplayName}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-2">Timezone</p>
                <Select
                  value={timezone}
                  onValueChange={onTimezoneChange}
                  disabled={isSavingTimezone}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Digest emails sent at 9 AM local time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data & Storage Section */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Database className="h-4 w-4" />
          Your Data
        </h2>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Monitors</p>
                <p className="text-lg font-bold">{dataStats.monitors}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Results Stored</p>
                <p className="text-lg font-bold">{formatNumber(dataStats.results)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onExportData}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting..." : "Export All Data"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete Account
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and all your data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteAccount}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plans Section */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Subscription Plans
        </h2>
        <div className="space-y-3">
          {plans.map((plan) => (
            <MobilePlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MobilePlanCard({ plan }: { plan: Plan }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Card className={plan.recommended ? "border-primary" : ""}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                {plan.recommended && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Zap className="h-3 w-3" />
                    Best
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>
            </div>
            {plan.current && (
              <Badge variant="outline" className="shrink-0">Current</Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>

          {/* Features */}
          <ul className="space-y-2 mb-4">
            {plan.features.slice(0, 4).map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
            {plan.features.length > 4 && (
              <li className="text-sm text-muted-foreground pl-6">
                +{plan.features.length - 4} more features
              </li>
            )}
          </ul>

          {/* Action */}
          {plan.current ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : (
            <Button className="w-full">
              Upgrade to {plan.name}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
