"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import Link from "next/link";

const platforms = [
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews" },
];

export default function NewMonitorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [error, setError] = useState("");

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a monitor name");
      return;
    }
    if (keywords.length === 0) {
      setError("Please add at least one keyword");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          keywords,
          platforms: selectedPlatforms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create monitor");
      }

      router.push("/dashboard/monitors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/monitors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Monitor</h1>
          <p className="text-muted-foreground">
            Set up a new keyword monitor to track mentions.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Monitor Details</CardTitle>
            <CardDescription>
              Configure what you want to track across platforms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monitor Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Monitor Name</Label>
              <Input
                id="name"
                placeholder="e.g., Brand Mentions, Competitor Tracking"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <div className="flex gap-2">
                <Input
                  id="keywords"
                  placeholder="Add a keyword and press Enter"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="gap-1">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Add keywords or phrases to monitor. We'll track mentions across selected platforms.
              </p>
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="grid gap-3">
                {platforms.map((platform) => (
                  <div
                    key={platform.id}
                    className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => togglePlatform(platform.id)}
                  >
                    <Checkbox
                      id={platform.id}
                      checked={selectedPlatforms.includes(platform.id)}
                      onCheckedChange={() => togglePlatform(platform.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={platform.id} className="cursor-pointer font-medium">
                        {platform.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {platform.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Monitor
              </Button>
              <Link href="/dashboard/monitors">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
