"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X, RotateCcw, Search, Lock } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { DETECTION_CATEGORIES, type DetectionCategory } from "@/lib/detection-defaults";

interface KeywordEntry {
  id: string | null;
  category: string;
  keywords: string[];
  isActive: boolean;
  isDefault: boolean;
}

interface DetectionKeywordsSettingsProps {
  subscriptionStatus: string;
}

const CATEGORY_META: Record<DetectionCategory, { color: string; icon: string }> = {
  solution_request: { color: "bg-green-500/10 text-green-400 border-green-500/20", icon: "🎯" },
  money_talk: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: "💰" },
  pain_point: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: "🔥" },
  advice_request: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "💡" },
  hot_discussion: { color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: "⚡" },
};

export function DetectionKeywordsSettings({ subscriptionStatus }: DetectionKeywordsSettingsProps) {
  const isPro = subscriptionStatus === "pro" || subscriptionStatus === "enterprise";
  const [entries, setEntries] = useState<KeywordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({});

  const fetchKeywords = useCallback(async () => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/user/detection-keywords");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.keywords);
      }
    } catch {
      toast.error("Failed to load detection keywords");
    } finally {
      setLoading(false);
    }
  }, [isPro]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  const handleSave = async (category: string, keywords: string[], isActive: boolean) => {
    setSaving(category);
    try {
      const res = await fetch("/api/user/detection-keywords", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, keywords, isActive }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) =>
          prev.map((e) =>
            e.category === category
              ? { ...e, keywords: data.keywords, isActive, isDefault: false }
              : e
          )
        );
        toast.success(`Updated ${category.replace("_", " ")} keywords`);
      } else {
        toast.error("Failed to save keywords");
      }
    } catch {
      toast.error("Failed to save keywords");
    } finally {
      setSaving(null);
    }
  };

  const handleAddKeyword = (category: string) => {
    const keyword = newKeyword[category]?.trim().toLowerCase();
    if (!keyword) return;

    const entry = entries.find((e) => e.category === category);
    if (!entry) return;

    if (entry.keywords.includes(keyword)) {
      toast.error("Keyword already exists");
      return;
    }

    const updated = [...entry.keywords, keyword];
    handleSave(category, updated, entry.isActive);
    setNewKeyword((prev) => ({ ...prev, [category]: "" }));
  };

  const handleRemoveKeyword = (category: string, keyword: string) => {
    const entry = entries.find((e) => e.category === category);
    if (!entry) return;

    const updated = entry.keywords.filter((k) => k !== keyword);
    handleSave(category, updated, entry.isActive);
  };

  const handleToggleActive = (category: string, isActive: boolean) => {
    const entry = entries.find((e) => e.category === category);
    if (!entry) return;
    handleSave(category, entry.keywords, isActive);
  };

  const handleResetToDefaults = (category: string) => {
    const defaultConfig = DETECTION_CATEGORIES.find((c) => c.category === category);
    if (!defaultConfig) return;
    handleSave(category, defaultConfig.defaultKeywords, true);
  };

  const handleInitialize = async () => {
    setSaving("init");
    try {
      const res = await fetch("/api/user/detection-keywords", { method: "POST" });
      if (res.ok) {
        await fetchKeywords();
        toast.success("Detection keywords initialized with defaults");
      }
    } catch {
      toast.error("Failed to initialize keywords");
    } finally {
      setSaving(null);
    }
  };

  if (!isPro) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Detection Keywords
            <Badge variant="secondary" className="text-xs">Pro</Badge>
          </CardTitle>
          <CardDescription>
            Customize which keywords trigger each conversation category. Reduce AI costs by catching obvious patterns before they hit the AI pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro to customize detection keywords and reduce AI analysis costs.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const allDefault = entries.every((e) => e.isDefault);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Detection Keywords
            </CardTitle>
            <CardDescription className="mt-1.5">
              Customize keywords per category. Matched keywords bypass AI analysis, saving costs.
            </CardDescription>
          </div>
          {allDefault && (
            <Button
              onClick={handleInitialize}
              disabled={saving === "init"}
              size="sm"
            >
              {saving === "init" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Initialize Defaults
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {DETECTION_CATEGORIES.map((config) => {
            const entry = entries.find((e) => e.category === config.category);
            const meta = CATEGORY_META[config.category];
            const keywords = entry?.keywords || config.defaultKeywords;
            const isActive = entry?.isActive ?? true;
            const isSaving = saving === config.category;

            return (
              <AccordionItem
                key={config.category}
                value={config.category}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{meta.icon}</span>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="outline" className={`text-xs ${meta.color}`}>
                          {keywords.length} keywords
                        </Badge>
                        {!isActive && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-2">
                    {/* Toggle + Reset */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => handleToggleActive(config.category, checked)}
                          disabled={isSaving}
                        />
                        <span className="text-sm text-muted-foreground">
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetToDefaults(config.category)}
                        disabled={isSaving}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Reset to Defaults
                      </Button>
                    </div>

                    {/* Add keyword input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add keyword or phrase..."
                        value={newKeyword[config.category] || ""}
                        onChange={(e) =>
                          setNewKeyword((prev) => ({
                            ...prev,
                            [config.category]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddKeyword(config.category);
                          }
                        }}
                        disabled={isSaving}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddKeyword(config.category)}
                        disabled={isSaving || !newKeyword[config.category]?.trim()}
                        className="h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Keyword tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="text-xs py-1 px-2 gap-1 group"
                        >
                          {keyword}
                          <button
                            onClick={() => handleRemoveKeyword(config.category, keyword)}
                            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            disabled={isSaving}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {isSaving && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
