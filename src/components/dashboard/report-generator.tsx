"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Download,
  Loader2,
  BarChart3,
  MessageSquare,
  TrendingUp,
  PieChart,
  Eye,
  Upload,
  Palette,
  Calendar,
  Clock,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

interface ReportSection {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
  enabled: boolean;
}

interface ReportConfig {
  title: string;
  dateRange: "7d" | "30d" | "90d" | "custom";
  customStartDate?: string;
  customEndDate?: string;
  sections: ReportSection[];
  branding: {
    logoUrl?: string;
    primaryColor: string;
    companyName: string;
  };
  format: "pdf" | "html";
}

interface ReportGeneratorProps {
  /** Whether user has Team tier */
  isTeam: boolean;
  /** Monitor IDs to include */
  monitorIds?: string[];
  /** Callback when report is generated */
  onGenerate?: (config: ReportConfig) => Promise<string>;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  {
    id: "executive_summary",
    name: "Executive Summary",
    description: "High-level overview of key metrics and trends",
    icon: FileText,
    enabled: true,
  },
  {
    id: "mention_volume",
    name: "Mention Volume & Trends",
    description: "Time-series chart of mention counts",
    icon: TrendingUp,
    enabled: true,
  },
  {
    id: "sentiment_analysis",
    name: "Sentiment Analysis",
    description: "Breakdown of positive, neutral, and negative mentions",
    icon: BarChart3,
    enabled: true,
  },
  {
    id: "platform_breakdown",
    name: "Platform Breakdown",
    description: "Mentions by platform with engagement metrics",
    icon: PieChart,
    enabled: true,
  },
  {
    id: "category_analysis",
    name: "Category Analysis",
    description: "Pain points, solution requests, and other categories",
    icon: MessageSquare,
    enabled: true,
  },
  {
    id: "top_posts",
    name: "Top Posts",
    description: "Highest engagement posts from the period",
    icon: TrendingUp,
    enabled: true,
  },
];

/**
 * Section Toggle Component
 */
const SectionToggle = memo(function SectionToggle({
  section,
  onToggle,
}: {
  section: ReportSection;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const Icon = section.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
      <Checkbox
        id={section.id}
        checked={section.enabled}
        onCheckedChange={(checked) => onToggle(section.id, !!checked)}
      />
      <div className="flex-1">
        <label
          htmlFor={section.id}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{section.name}</span>
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">
          {section.description}
        </p>
      </div>
    </div>
  );
});

/**
 * Report Preview Component
 */
const ReportPreview = memo(function ReportPreview({
  config,
}: {
  config: ReportConfig;
}) {
  const enabledSections = config.sections.filter((s) => s.enabled);

  return (
    <div
      className="border rounded-lg p-4 bg-white dark:bg-gray-900"
      style={{ borderTopColor: config.branding.primaryColor, borderTopWidth: "4px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div>
          <h3 className="font-bold text-lg">{config.title || "Analytics Report"}</h3>
          <p className="text-xs text-muted-foreground">
            {config.branding.companyName || "Your Company"}
          </p>
        </div>
        {config.branding.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={config.branding.logoUrl} alt="Logo" className="h-8" />
        ) : (
          <div className="h-8 w-20 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
            Logo
          </div>
        )}
      </div>

      {/* Section previews */}
      <div className="space-y-2">
        {enabledSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="flex items-center gap-2 py-1">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{section.name}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t text-center">
        <p className="text-[10px] text-muted-foreground">
          Generated with Kaulby
        </p>
      </div>
    </div>
  );
});

/**
 * Report Generator Component
 */
export function ReportGenerator({
  isTeam,
  onGenerate,
}: ReportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    title: "Monthly Analytics Report",
    dateRange: "30d",
    sections: DEFAULT_SECTIONS,
    branding: {
      primaryColor: "#6366f1",
      companyName: "",
    },
    format: "pdf",
  });

  const handleToggleSection = (id: string, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, enabled } : s
      ),
    }));
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;

    setIsGenerating(true);
    try {
      const url = await onGenerate(config);
      // Download the report
      window.open(url, "_blank");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isTeam) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-1">White-Label Reports</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate branded PDF reports for clients and stakeholders.
          </p>
          <Badge variant="outline">Team Plan Feature</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FileText className="h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Analytics Report</DialogTitle>
          <DialogDescription>
            Create a branded report to share with your team or clients.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Report Title</Label>
                <Input
                  value={config.title}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Monthly Analytics Report"
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select
                  value={config.dateRange}
                  onValueChange={(value) =>
                    setConfig((prev) => ({ ...prev, dateRange: value as ReportConfig["dateRange"] }))
                  }
                >
                  <SelectTrigger aria-label="Date range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={config.format}
                  onValueChange={(value) =>
                    setConfig((prev) => ({ ...prev, format: value as "pdf" | "html" }))
                  }
                >
                  <SelectTrigger aria-label="Report format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="html">Interactive HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Branding */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Branding</h3>
              </div>

              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={config.branding.companyName}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, companyName: e.target.value },
                    }))
                  }
                  placeholder="Your Company"
                />
              </div>

              <div className="space-y-2">
                <Label>Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={config.branding.primaryColor}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: e.target.value },
                      }))
                    }
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={config.branding.primaryColor}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: e.target.value },
                      }))
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo URL (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={config.branding.logoUrl || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, logoUrl: e.target.value },
                      }))
                    }
                    placeholder="https://your-logo.com/logo.png"
                  />
                  <Button variant="outline" size="icon" aria-label="Upload logo">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Sections</h3>
              </div>
              <div className="border rounded-lg divide-y">
                {config.sections.map((section) => (
                  <SectionToggle
                    key={section.id}
                    section={section}
                    onToggle={handleToggleSection}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Preview</h3>
            </div>
            <ReportPreview config={config} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Report History Component
 */
export const ReportHistory = memo(function ReportHistory({
  reports,
}: {
  reports: Array<{
    id: string;
    title: string;
    createdAt: Date;
    format: string;
    downloadUrl: string;
  }>;
}) {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No reports generated yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Report History</CardTitle>
        <CardDescription>Previously generated reports</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{report.title}</p>
                <p className="text-xs text-muted-foreground">
                  {report.createdAt.toLocaleDateString()} &bull; {report.format.toUpperCase()}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={report.downloadUrl} download>
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Report Management Component
 *
 * Shows report scheduling controls, recent report history with regeneration,
 * and upcoming schedule information. Team-tier only.
 */

interface ReportScheduleInfo {
  reportSchedule: string; // 'off' | 'weekly' | 'monthly'
  reportDay: number;
  reportLastSentAt: string | null;
}

interface ReportManagementProps {
  /** Whether user has Team tier */
  isTeam: boolean;
  /** Current schedule info from user profile */
  scheduleInfo?: ReportScheduleInfo;
  /** Previously generated report configs for quick regeneration */
  recentConfigs?: Array<{
    id: string;
    title: string;
    dateRange: string;
    format: string;
    generatedAt: string;
  }>;
  /** Callback to generate a report with a specific config */
  onGenerate?: (config: ReportConfig) => Promise<string>;
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getNextScheduledDate(schedule: string, day: number): string {
  if (schedule === "off") return "";

  const now = new Date();
  const nextDate = new Date(now);

  if (schedule === "weekly") {
    // day is 1-7 (Mon-Sun), JS getDay() is 0-6 (Sun-Sat)
    const targetDay = day === 7 ? 0 : day; // Convert to JS day
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    nextDate.setDate(now.getDate() + daysUntil);
  } else if (schedule === "monthly") {
    // day is the day of month (1 or 15)
    if (now.getDate() >= day) {
      nextDate.setMonth(now.getMonth() + 1);
    }
    nextDate.setDate(day);
  }

  return nextDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ReportManagement({
  isTeam,
  scheduleInfo,
  recentConfigs = [],
  onGenerate,
}: ReportManagementProps) {
  const [schedule, setSchedule] = useState(scheduleInfo?.reportSchedule ?? "off");
  const [reportDay, setReportDay] = useState(scheduleInfo?.reportDay ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Sync state with props
  useEffect(() => {
    if (scheduleInfo) {
      setSchedule(scheduleInfo.reportSchedule);
      setReportDay(scheduleInfo.reportDay);
    }
  }, [scheduleInfo]);

  const handleScheduleChange = useCallback(async (newSchedule: string, newDay?: number) => {
    setIsSaving(true);
    const updates: Record<string, unknown> = { reportSchedule: newSchedule };
    if (newDay !== undefined) {
      updates.reportDay = newDay;
    }

    try {
      const response = await fetch("/api/user/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setSchedule(newSchedule);
        if (newDay !== undefined) setReportDay(newDay);
        toast.success(
          newSchedule === "off"
            ? "Report scheduling disabled"
            : `Reports scheduled ${newSchedule}`
        );
      } else {
        toast.error("Failed to update schedule");
      }
    } catch (err) {
      console.error("Failed to update report schedule:", err);
      toast.error("Failed to update schedule");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleRegenerate = async (configEntry: typeof recentConfigs[number]) => {
    if (!onGenerate) return;

    setRegeneratingId(configEntry.id);
    try {
      const regenerateConfig: ReportConfig = {
        title: configEntry.title,
        dateRange: (configEntry.dateRange as ReportConfig["dateRange"]) || "30d",
        sections: DEFAULT_SECTIONS,
        branding: {
          primaryColor: "#6366f1",
          companyName: "",
        },
        format: (configEntry.format as "pdf" | "html") || "pdf",
      };

      const url = await onGenerate(regenerateConfig);
      window.open(url, "_blank");
      toast.success("Report regenerated");
    } catch (error) {
      console.error("Failed to regenerate report:", error);
      toast.error("Failed to regenerate report");
    } finally {
      setRegeneratingId(null);
    }
  };

  if (!isTeam) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Report Management
            </CardTitle>
            <CardDescription>
              Schedule automated reports and view report history
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule Section */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Scheduled Reports</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-mgmt-schedule" className="text-sm">
                Frequency
              </Label>
              <Select
                value={schedule}
                onValueChange={(value) => handleScheduleChange(value)}
                disabled={isSaving}
              >
                <SelectTrigger id="report-mgmt-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {schedule !== "off" && (
              <div className="space-y-2">
                <Label htmlFor="report-mgmt-day" className="text-sm">
                  {schedule === "weekly" ? "Day of Week" : "Day of Month"}
                </Label>
                <Select
                  value={reportDay.toString()}
                  onValueChange={(value) => handleScheduleChange(schedule, parseInt(value))}
                  disabled={isSaving}
                >
                  <SelectTrigger id="report-mgmt-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {schedule === "weekly" ? (
                      <>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                        <SelectItem value="7">Sunday</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="1">1st</SelectItem>
                        <SelectItem value="15">15th</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {schedule !== "off" && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Sent at 6 AM UTC every {schedule === "weekly" ? DAY_NAMES[reportDay] || "Monday" : `${reportDay === 1 ? "1st" : "15th"} of the month`}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Next: {getNextScheduledDate(schedule, reportDay)}
              </Badge>
            </div>
          )}

          {scheduleInfo?.reportLastSentAt && (
            <p className="text-xs text-muted-foreground">
              Last report sent: {new Date(scheduleInfo.reportLastSentAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Recent Reports / Quick Regenerate */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Recent Reports</h3>
          </div>

          {recentConfigs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No reports generated yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Use the &quot;Generate Report&quot; button above to create your first branded analytics report.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead className="hidden sm:table-cell">Range</TableHead>
                    <TableHead className="hidden sm:table-cell">Format</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentConfigs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{config.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(config.generatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {config.dateRange === "7d" ? "7 days" : config.dateRange === "30d" ? "30 days" : config.dateRange === "90d" ? "90 days" : config.dateRange}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground uppercase">
                          {config.format}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleRegenerate(config)}
                          disabled={regeneratingId === config.id}
                        >
                          {regeneratingId === config.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">Regenerate</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
