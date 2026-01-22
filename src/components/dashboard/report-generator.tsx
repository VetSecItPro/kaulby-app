"use client";

import { useState, memo } from "react";
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
} from "lucide-react";

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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <Button variant="outline" size="icon">
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
