"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText } from "lucide-react";
import {
  AUDIENCE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type AudienceTemplate,
} from "@/lib/audience-templates";

interface AudienceTemplateGalleryProps {
  onSelect: (template: AudienceTemplate) => void;
  onSkip: () => void;
}

export function AudienceTemplateGallery({ onSelect, onSkip }: AudienceTemplateGalleryProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filtered = categoryFilter
    ? AUDIENCE_TEMPLATES.filter((t) => t.category === categoryFilter)
    : AUDIENCE_TEMPLATES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Start from a Template
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a pre-built template or start from scratch.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          <FileText className="h-4 w-4 mr-2" />
          Start from Scratch
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={categoryFilter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter(null)}
        >
          All
        </Button>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md"
            onClick={() => onSelect(template)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: template.color }}
                  />
                  <h3 className="font-medium text-sm">{template.name}</h3>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {template.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {template.useCase}
              </p>
              <div className="flex flex-wrap gap-1">
                {template.suggestedKeywords.slice(0, 3).map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-[10px] font-normal">
                    {kw}
                  </Badge>
                ))}
                {template.suggestedKeywords.length > 3 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    +{template.suggestedKeywords.length - 3}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
