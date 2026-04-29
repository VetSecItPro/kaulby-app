"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, RefreshCw, ExternalLink, Wand2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SuggestReplyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: {
    id: string;
    title: string;
    content: string | null;
    platform: string;
    sourceUrl: string;
    conversationCategory?: string | null;
  };
}

interface SuggestedReply {
  text: string;
  tone: "helpful" | "professional" | "casual";
  confidence: number;
}

const TONE_LABELS: Record<SuggestedReply["tone"], string> = {
  helpful: "Helpful",
  professional: "Professional",
  casual: "Casual",
};

const TONE_COLORS: Record<SuggestedReply["tone"], string> = {
  helpful: "bg-emerald-500/15 text-emerald-400",
  professional: "bg-blue-500/15 text-blue-400",
  casual: "bg-amber-500/15 text-amber-400",
};

export function SuggestReplyDrawer({ open, onOpenChange, result }: SuggestReplyDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch suggestions on first open or refresh.
  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: result.id,
          title: result.title,
          content: result.content,
          platform: result.platform,
          conversationCategory: result.conversationCategory,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { suggestions: SuggestedReply[] };
      if (!data.suggestions?.length) {
        throw new Error("No suggestions returned");
      }
      setSuggestions(data.suggestions);
      setActiveIdx(0);
      setEditedText(data.suggestions[0].text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch when the drawer opens for a fresh result.
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next && suggestions.length === 0 && !loading) {
      void generate();
    }
  }

  function selectSuggestion(idx: number) {
    setActiveIdx(idx);
    setEditedText(suggestions[idx].text);
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(editedText);
    setCopied(true);
    toast.success("Reply copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Suggest reply
          </SheetTitle>
          <SheetDescription className="text-left line-clamp-2">
            {result.title}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Sparkles className="h-6 w-6 animate-pulse text-primary" />
              <p className="text-sm">Drafting platform-appropriate replies...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
              <Button variant="link" className="px-0 mt-1 h-auto" onClick={generate}>
                Try again
              </Button>
            </div>
          )}

          {suggestions.length > 0 && (
            <>
              {/* Tone selector */}
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(i)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                      activeIdx === i
                        ? `${TONE_COLORS[s.tone]} border-transparent`
                        : "bg-muted/40 text-muted-foreground border-border hover:border-foreground/20",
                    )}
                  >
                    {TONE_LABELS[s.tone]}
                    <span className="ml-1.5 opacity-60">{Math.round(s.confidence * 100)}%</span>
                  </button>
                ))}
              </div>

              {/* Editable draft */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Edit before posting
                </label>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={10}
                  className="font-mono text-sm leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Suggestions are platform-aware (Reddit prefers personal stories,
                  HN prefers technical accuracy, Product Hunt prefers supportive
                  feedback). Always edit before posting; AI drafts are starting
                  points, not final copy.
                </p>
              </div>
            </>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="border-t p-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={generate}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Regenerate
            </Button>
            <Button onClick={copyToClipboard} className="gap-2 flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy reply"}
            </Button>
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:flex-1"
            >
              <Button variant="secondary" className="gap-2 w-full">
                <ExternalLink className="h-4 w-4" />
                Open post
              </Button>
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
