"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Wand2, Send, Loader2, ExternalLink, X, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    title: string;
    platform: string;
    sourceUrl: string;
    snippet?: string;
  }>;
}

/**
 * Quick-Ask widget. A floating action button (lower-right on every dashboard
 * page) that opens a slideover chat. Calls the existing /api/ai/ask endpoint
 * with a context hint derived from the current pathname so the assistant
 * knows where the user is.
 *
 * For deep multi-turn conversations or history browsing, the widget links
 * out to /dashboard/ask. This is the inline copilot, not a replacement.
 *
 * Keyboard: cmd/ctrl+K toggles the panel.
 */
export function FloatingAskKaulby() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // cmd/ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when sheet opens
  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay so Sheet's open animation doesn't steal focus
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Page-scoped context. Tells the AI where the user is so it can return
  // page-relevant answers. The actual prompt is in /api/ai/ask; we pass
  // the hint as a prefix in the user message.
  const contextHint = derivePageContext(pathname);

  const suggestedPrompts = derivePagePrompts(pathname);

  const send = useCallback(
    async (questionOverride?: string) => {
      const question = (questionOverride ?? input).trim();
      if (!question || loading) return;

      const userMessage: Message = { role: "user", content: question };
      setMessages((m) => [...m, userMessage]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: contextHint ? `[${contextHint}] ${question}` : question,
            conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as {
          answer?: string;
          citations?: Message["citations"];
        };
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.answer || "(No answer returned)",
            citations: data.citations,
          },
        ]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't reach Ask Kaulby");
        // Don't strip the user's message — they can retry. Just don't show a
        // stale assistant response.
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, contextHint]
  );

  return (
    <>
      {/* Floating action button. Hidden when sheet is open since the FAB
          would render through the overlay anyway. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Ask Kaulby"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg shadow-teal-500/20 bg-primary text-primary-foreground hover:scale-105 transition-transform flex items-center justify-center"
        >
          <Wand2 className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="sr-only">Ask Kaulby (Cmd+K)</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-5 space-y-1">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" />
              Ask Kaulby
              <Badge variant="outline" className="ml-auto text-[10px] font-mono">⌘K</Badge>
            </SheetTitle>
            <SheetDescription className="text-xs flex items-center gap-2">
              {contextHint ? `Context: ${contextHint}` : "Anywhere in your data"}
              <Link
                href="/dashboard/ask"
                className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Open full chat <ExternalLink className="h-3 w-3" />
              </Link>
            </SheetDescription>
          </SheetHeader>

          {/* Message list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Try asking:</span>
                </div>
                <div className="space-y-1.5">
                  {suggestedPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      disabled={loading}
                      className="w-full text-left rounded-lg border border-border/40 bg-muted/20 hover:border-foreground/20 hover:bg-muted/40 px-3 py-2 text-sm transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary/10 border border-primary/20 ml-8"
                    : "bg-muted/30 border border-border/40 mr-8"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sources</p>
                    {msg.citations.slice(0, 5).map((c, j) => (
                      <a
                        key={j}
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary hover:underline truncate"
                      >
                        [{c.platform}] {c.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Thinking...</span>
              </div>
            )}
          </div>

          {/* Input row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="border-t p-3 flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your monitors..."
              disabled={loading}
              maxLength={500}
              className="h-9"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="sm" className="h-9">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                disabled={loading}
                className="h-9 px-2"
                aria-label="Clear thread"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page-aware context derivation
// ---------------------------------------------------------------------------

/**
 * Generates a 1-line context hint based on the current dashboard route. The
 * hint gets prepended to the user's question when calling /api/ai/ask, so
 * the model knows the user is looking at, e.g., the analytics page when
 * they ask "what's the trend".
 */
function derivePageContext(pathname: string | null): string {
  if (!pathname) return "";

  // Specific monitor detail page — extract the ID
  const monitorMatch = pathname.match(/^\/dashboard\/monitors\/([0-9a-f-]+)(?:\/|$)/i);
  if (monitorMatch) return `viewing monitor ${monitorMatch[1].slice(0, 8)}`;

  if (pathname.startsWith("/dashboard/results")) return "viewing results feed";
  if (pathname.startsWith("/dashboard/analytics")) return "viewing analytics";
  if (pathname.startsWith("/dashboard/insights")) return "viewing insights";
  if (pathname.startsWith("/dashboard/audiences")) return "viewing audiences";
  if (pathname.startsWith("/dashboard/competitors")) return "viewing competitors";
  if (pathname.startsWith("/dashboard/discover")) return "viewing discover";
  if (pathname.startsWith("/dashboard/bookmarks")) return "viewing bookmarks";
  if (pathname.startsWith("/dashboard/monitors")) return "viewing monitors list";
  if (pathname.startsWith("/dashboard/settings")) return "viewing settings";
  if (pathname === "/dashboard") return "viewing dashboard overview";
  return "";
}

/**
 * Page-specific suggested prompts. Each route surfaces 3 questions that
 * make sense from where the user is sitting. Keeps the empty state useful
 * instead of a blank input.
 */
function derivePagePrompts(pathname: string | null): string[] {
  if (!pathname) return DEFAULT_PROMPTS;

  if (pathname.match(/^\/dashboard\/monitors\/[0-9a-f-]+$/i)) {
    return [
      "What are the top 3 takeaways from this monitor this week?",
      "Show me the highest-intent posts from this monitor",
      "What pain points keep coming up here?",
    ];
  }
  if (pathname.startsWith("/dashboard/results")) {
    return [
      "Find me the highest lead-score posts from the last 24 hours",
      "Summarize the negative sentiment results this week",
      "Group these results by theme",
    ];
  }
  if (pathname.startsWith("/dashboard/analytics")) {
    return [
      "Why did sentiment shift this week?",
      "Which platform is driving the most negative mentions?",
      "Compare this week to last week",
    ];
  }
  if (pathname.startsWith("/dashboard/insights")) {
    return [
      "What's the most actionable pain point right now?",
      "Show me competitor weakness patterns",
      "Which feature requests are recurring?",
    ];
  }
  if (pathname.startsWith("/dashboard/competitors")) {
    return [
      "Summarize complaints about my top competitor",
      "Where are competitors losing customers?",
      "What features are competitors missing?",
    ];
  }
  if (pathname.startsWith("/dashboard/audiences")) {
    return [
      "Suggest communities for my current audiences",
      "Which audience has the most buying signals?",
      "Show me my audience-monitor coverage",
    ];
  }
  if (pathname.startsWith("/dashboard/bookmarks")) {
    return [
      "Cluster my bookmarks by intent",
      "What patterns do my saved leads share?",
      "Suggest follow-up replies for my saved posts",
    ];
  }
  return DEFAULT_PROMPTS;
}

const DEFAULT_PROMPTS = [
  "What are people saying about my brand this week?",
  "Find me high-intent leads from the last 7 days",
  "Summarize the biggest pain points my customers mentioned",
];
