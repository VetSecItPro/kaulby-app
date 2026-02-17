"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { AudienceTemplateGallery } from "./audience-template-gallery";
import type { AudienceTemplate } from "@/lib/audience-templates";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

interface AudienceFormProps {
  audience?: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
  };
}

export function AudienceForm({ audience }: AudienceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(audience?.name || "");
  const [description, setDescription] = useState(audience?.description || "");
  const [color, setColor] = useState(audience?.color || PRESET_COLORS[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<AudienceTemplate | null>(null);
  const [showForm, setShowForm] = useState(!!audience); // Show form immediately if editing

  const isEditing = !!audience;

  const handleTemplateSelect = (template: AudienceTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description);
    setColor(template.color);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/audiences/${audience.id}` : "/api/audiences";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          color,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/dashboard/audiences/${data.id}`);
        router.refresh();
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to save audience", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save audience:", error);
      toast({ title: "Error", description: "Failed to save audience. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show template gallery for new audiences
  if (!showForm) {
    return (
      <AudienceTemplateGallery
        onSelect={handleTemplateSelect}
        onSkip={() => setShowForm(true)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Template badge if selected */}
      {selectedTemplate && (
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            Template: {selectedTemplate.name}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-6"
            onClick={() => {
              setSelectedTemplate(null);
              setShowForm(false);
              setName("");
              setDescription("");
              setColor(PRESET_COLORS[0]);
            }}
          >
            Change template
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Audience" : "Audience Details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Power Users, Enterprise Prospects"
              required
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Give your audience a descriptive name.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this audience segment..."
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === presetColor
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 p-0 border-0 cursor-pointer"
                aria-label="Custom color picker"
              />
            </div>
          </div>

          {/* Suggested keywords hint from template */}
          {selectedTemplate && selectedTemplate.suggestedKeywords.length > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed p-4">
              <Label className="text-muted-foreground">Suggested Keywords for Monitors</Label>
              <p className="text-xs text-muted-foreground">
                After creating this audience, add monitors with these keywords:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedTemplate.suggestedKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs font-normal">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <Link href="/dashboard/audiences">
              <Button type="button" variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Audience"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
