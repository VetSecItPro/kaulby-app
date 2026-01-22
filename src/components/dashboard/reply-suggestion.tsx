"use client";

import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  RefreshCcw,
  Loader2,
  ExternalLink,
  Info,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplySuggestionProps {
  /** Result ID */
  resultId: string;
  /** Post title */
  title: string;
  /** Post content */
  content: string | null;
  /** Platform */
  platform: string;
  /** Source URL */
  sourceUrl: string;
  /** User's product/service context (optional) */
  productContext?: string;
  /** Conversation category */
  conversationCategory?: string | null;
  /** Whether user has Pro access */
  isPro: boolean;
  /** Size variant */
  size?: "sm" | "default";
}

interface SuggestedReply {
  text: string;
  tone: "helpful" | "professional" | "casual";
  confidence: number;
}

/**
 * Reply Suggestion Button - Opens dialog with AI-generated replies
 */
export const ReplySuggestionButton = memo(function ReplySuggestionButton({
  resultId,
  title,
  content,
  platform,
  sourceUrl,
  productContext,
  conversationCategory,
  isPro,
  size = "sm",
}: ReplySuggestionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = useCallback(async () => {
    if (!isPro) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId,
          title,
          content,
          platform,
          conversationCategory,
          productContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggestions");
      }

      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch {
      setError("Failed to generate reply suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [resultId, title, content, platform, conversationCategory, productContext, isPro]);

  const handleCopy = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open && suggestions.length === 0) {
      generateSuggestions();
    }
  }, [suggestions.length, generateSuggestions]);

  if (!isPro) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size={size} className="gap-1.5 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {size === "default" && <span>Reply</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-violet-500" />
          <p className="font-medium mb-1">Pro Feature</p>
          <p className="text-sm text-muted-foreground mb-3">
            Get AI-generated reply suggestions to engage with this post.
          </p>
          <Button size="sm">Upgrade to Pro</Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={size} className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {size === "default" && <span>Suggest Reply</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Reply Suggestions
          </DialogTitle>
          <DialogDescription>
            Here are suggested replies to engage with this post. Copy and customize before posting.
          </DialogDescription>
        </DialogHeader>

        {/* Original Post Context */}
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {platform}
              </Badge>
              Original Post
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="font-medium text-sm">{title}</p>
            {content && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {content}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-violet-500" />
              <p className="text-sm text-muted-foreground">Generating thoughtful replies...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-6">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" onClick={generateSuggestions}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Suggestions */}
        {!isLoading && !error && suggestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>Click a reply to select it, then copy and customize before posting</span>
            </div>

            {suggestions.map((suggestion, index) => (
              <Card
                key={index}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedReply === suggestion.text
                    ? "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/20"
                    : "hover:bg-muted/50"
                )}
                onClick={() => setSelectedReply(suggestion.text)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          suggestion.tone === "helpful" && "bg-green-100 text-green-700",
                          suggestion.tone === "professional" && "bg-blue-100 text-blue-700",
                          suggestion.tone === "casual" && "bg-orange-100 text-orange-700"
                        )}
                      >
                        {suggestion.tone}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(suggestion.confidence * 100)}% match
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(suggestion.text, index);
                      }}
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{suggestion.text}</p>
                </CardContent>
              </Card>
            ))}

            {/* Regenerate */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={generateSuggestions}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Generate New Suggestions
              </Button>

              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Open Original Post
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Guidelines */}
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <ThumbsUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Pro tip:</strong> Always personalize your reply and add genuine value. Avoid sounding promotional - focus on being helpful first.
              </span>
            </p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
});

/**
 * Inline Reply Editor - For customizing a selected reply
 */
export const ReplyEditor = memo(function ReplyEditor({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="resize-none"
        placeholder="Customize your reply..."
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <span className="text-xs text-muted-foreground">
            {text.length} characters
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </>
            )}
          </Button>
          <Button size="sm" onClick={() => onSave(text)}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
});

/**
 * Quick feedback buttons for reply quality
 */
export const ReplyFeedback = memo(function ReplyFeedback({
  replyId,
  onFeedback,
}: {
  replyId: string;
  onFeedback: (replyId: string, feedback: "good" | "bad") => void;
}) {
  const [submitted, setSubmitted] = useState<"good" | "bad" | null>(null);

  const handleFeedback = useCallback(
    (feedback: "good" | "bad") => {
      setSubmitted(feedback);
      onFeedback(replyId, feedback);
    },
    [replyId, onFeedback]
  );

  if (submitted) {
    return (
      <span className="text-xs text-muted-foreground">
        Thanks for the feedback!
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground mr-1">Was this helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => handleFeedback("good")}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => handleFeedback("bad")}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
});
