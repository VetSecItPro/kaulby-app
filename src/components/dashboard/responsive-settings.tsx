"use client";

import { useState } from "react";
import { useDevice } from "@/hooks/use-device";
import { MobileSettings } from "@/components/mobile/mobile-settings";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Download, Trash2, Brain, Database, AlertTriangle, Clock } from "lucide-react";
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

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
] as const;

interface Plan {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  current: boolean;
  recommended?: boolean;
}

interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  callCount: number;
  periodStart: Date;
}

interface DataStats {
  monitors: number;
  results: number;
  aiCalls: number;
}

interface ResponsiveSettingsProps {
  email: string;
  name: string;
  subscriptionStatus: string;
  timezone: string;
  plans: Plan[];
  aiUsage: AiUsage;
  dataStats: DataStats;
  userId: string;
}

export function ResponsiveSettings({
  email,
  name,
  subscriptionStatus,
  timezone: initialTimezone,
  plans,
  aiUsage,
  dataStats,
}: ResponsiveSettingsProps) {
  const { isMobile, isTablet } = useDevice();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  const handleTimezoneChange = async (newTimezone: string) => {
    setIsSavingTimezone(true);
    try {
      const response = await fetch("/api/user/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTimezone }),
      });
      if (response.ok) {
        setTimezone(newTimezone);
      }
    } catch (error) {
      console.error("Failed to update timezone:", error);
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/user/export", {
        method: "POST",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kaulby-data-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      });
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isMobile || isTablet) {
    return (
      <MobileSettings
        email={email}
        name={name}
        subscriptionStatus={subscriptionStatus}
        timezone={timezone}
        timezoneOptions={TIMEZONE_OPTIONS}
        onTimezoneChange={handleTimezoneChange}
        isSavingTimezone={isSavingTimezone}
        plans={plans}
        aiUsage={aiUsage}
        dataStats={dataStats}
        onExportData={handleExportData}
        onDeleteAccount={handleDeleteAccount}
        isExporting={isExporting}
        isDeleting={isDeleting}
      />
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Desktop view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and subscription.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{email}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{name}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={subscriptionStatus === "free" ? "secondary" : "default"}
                className="capitalize"
              >
                {subscriptionStatus}
              </Badge>
            </div>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Timezone
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={timezone}
                onValueChange={handleTimezoneChange}
                disabled={isSavingTimezone}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSavingTimezone && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Digest emails will be sent at 9 AM in your timezone
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Team Settings - Enterprise only */}
      <TeamSettings subscriptionStatus={subscriptionStatus} />

      {/* AI Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Usage
          </CardTitle>
          <CardDescription>
            Token usage and costs for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-2xl font-bold">{formatNumber(aiUsage.totalTokens)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Input Tokens</p>
              <p className="text-2xl font-bold">{formatNumber(aiUsage.promptTokens)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Output Tokens</p>
              <p className="text-2xl font-bold">{formatNumber(aiUsage.completionTokens)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">AI Cost</p>
              <p className="text-2xl font-bold">${aiUsage.totalCost.toFixed(4)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {aiUsage.callCount} AI calls since {new Date(aiUsage.periodStart).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Data & Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data & Storage
          </CardTitle>
          <CardDescription>
            Your data usage and management options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Monitors</p>
              <p className="text-2xl font-bold">{dataStats.monitors}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Results Stored</p>
              <p className="text-2xl font-bold">{formatNumber(dataStats.results)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">AI Analyses</p>
              <p className="text-2xl font-bold">{formatNumber(dataStats.aiCalls)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isExporting}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export All Data"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex items-center gap-2">
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
                    account and remove all your data including monitors, results,
                    and AI analysis history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Subscription Plans</h2>
          <p className="text-sm text-muted-foreground">
            Choose the plan that best fits your needs.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.recommended ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.recommended && (
                    <Badge variant="default" className="gap-1">
                      <Zap className="h-3 w-3" />
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button className="w-full">Upgrade to {plan.name}</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
