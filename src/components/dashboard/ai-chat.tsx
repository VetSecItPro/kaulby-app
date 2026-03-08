"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  MessageSquare,
  Sparkles,
  ExternalLink,
  RefreshCcw,
  Copy,
  Check,
  Lightbulb,
  AlertCircle,
  Bot,
  User,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformBadgeColor, getPlatformDisplayName } from "@/lib/platform-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  snippet: string;
  monitorName?: string;
}

interface ToolUsed {
  name: string;
  label: string;
}

interface PendingConfirmation {
  toolCallId: string;
  toolName: string;
  message: string;
  params: Record<string, unknown>;
  conversationState?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  toolsUsed?: ToolUsed[];
  pendingConfirmation?: PendingConfirmation;
  isLoading?: boolean;
  error?: string;
  timestamp: Date;
}

interface AIChatProps {
  isPro: boolean;
  suggestedQuestions?: string[];
  monitorIds?: string[];
  audienceIds?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  "What are people saying about my brand?",
  "Show me high-intent leads from the last 7 days",
  "Which platforms have the most negative sentiment?",
  "Find posts where someone is looking for alternatives",
  "Summarize my monitoring data for this week",
  "Compare my monitors — which one is performing best?",
];

const LOADING_MESSAGES = [
  "Analyzing your data…",
  "Searching across your monitors…",
  "Looking through recent results…",
  "Crunching the numbers…",
];

// ---------------------------------------------------------------------------
// Citation Card
// ---------------------------------------------------------------------------

const CitationCard = memo(function CitationCard({ citation }: { citation: Citation }) {
  return (
    <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer" className="block">
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 shrink-0">
              {citation.monitorName && (
                <Badge variant="secondary" className="text-[10px] font-medium">
                  {citation.monitorName}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("capitalize text-[10px]", getPlatformBadgeColor(citation.platform, "light"))}
              >
                {getPlatformDisplayName(citation.platform)}
              </Badge>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-1">{citation.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{citation.snippet}</p>
            </div>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
});

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");

  return lines.map((line, lineIndex) => {
    const parts: React.ReactNode[] = [];
    let keyIndex = 0;

    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={`bold-${lineIndex}-${keyIndex++}`} className="font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    if (parts.length === 0) {
      parts.push(line);
    }

    return (
      <span key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

const MessageBubble = memo(function MessageBubble({
  message,
  onCopy,
  isCopied,
  onConfirm,
}: {
  message: ChatMessage;
  onCopy: (text: string) => void;
  isCopied: boolean;
  onConfirm?: (confirmed: boolean) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex-1 max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {message.isLoading ? (
            <LoadingIndicator />
          ) : message.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{message.error}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap">{renderMarkdown(message.content)}</div>
          )}
        </div>

        {/* Pending confirmation */}
        {!isUser && message.pendingConfirmation && onConfirm && (
          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 w-full">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium text-amber-500">Confirmation Required</p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {message.pendingConfirmation.message}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => onConfirm(true)}
              >
                Yes, proceed
              </Button>
              <Button size="sm" variant="outline" onClick={() => onConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Tools used badges */}
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {message.toolsUsed.map((tool, i) => (
              <Badge key={`${tool.name}-${i}`} variant="secondary" className="text-[10px] gap-1">
                <Wrench className="h-2.5 w-2.5" />
                {tool.label.replace("…", "")}
              </Badge>
            ))}
          </div>
        )}

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Sources:</p>
            <div className="grid gap-2">
              {message.citations.slice(0, 3).map((citation) => (
                <CitationCard key={citation.id} citation={citation} />
              ))}
              {message.citations.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  + {message.citations.length - 3} more sources
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isUser && !message.isLoading && !message.error && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(message.content)}
            >
              {isCopied ? (
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
            <span className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// Loading indicator with rotating messages
// ---------------------------------------------------------------------------

function LoadingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-sm">{LOADING_MESSAGES[messageIndex]}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Chat Component
// ---------------------------------------------------------------------------

export function AIChat({
  isPro,
  suggestedQuestions = SUGGESTED_QUESTIONS,
  monitorIds,
  audienceIds,
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store the last pending confirmation for handling
  const pendingConfirmRef = useRef<PendingConfirmation | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback((text: string, messageId?: string) => {
    navigator.clipboard.writeText(text);
    if (messageId) {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      setCopiedMessageId(messageId);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId(null);
        copyTimeoutRef.current = null;
      }, 2000);
    }
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading || !isPro) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: input.trim(),
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isLoading: true,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, userMessage, assistantMessage];
        return updated.length > 50 ? updated.slice(-50) : updated;
      });
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userMessage.content,
            monitorIds,
            audienceIds,
            conversationHistory: messages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to get response");
        }

        const data = await response.json();

        // Store pending confirmation if any
        if (data.pendingConfirmation) {
          pendingConfirmRef.current = data.pendingConfirmation;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: data.answer,
                  citations: data.citations,
                  toolsUsed: data.toolsUsed,
                  pendingConfirmation: data.pendingConfirmation || undefined,
                  isLoading: false,
                }
              : m
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sorry, I couldn't process that request. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, error: errorMessage, isLoading: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, isPro, monitorIds, audienceIds, messages]
  );

  const handleConfirm = useCallback(
    async (confirmed: boolean) => {
      const pending = pendingConfirmRef.current;
      if (!pending) return;

      pendingConfirmRef.current = null;

      // Remove pending confirmation from the message
      setMessages((prev) =>
        prev.map((m) =>
          m.pendingConfirmation ? { ...m, pendingConfirmation: undefined } : m
        )
      );

      if (!confirmed) {
        const cancelMessage: ChatMessage = {
          id: `assistant-cancel-${Date.now()}`,
          role: "assistant",
          content: "No problem — action cancelled.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, cancelMessage]);
        return;
      }

      // Show loading for confirmed action
      const loadingMessage: ChatMessage = {
        id: `assistant-confirm-${Date.now()}`,
        role: "assistant",
        content: "",
        isLoading: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, loadingMessage]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "",
            pendingConfirmation: {
              toolCallId: pending.toolCallId,
              toolName: pending.toolName,
              confirmed: true,
              params: pending.params,
            },
          }),
        });

        if (!response.ok) throw new Error("Failed to execute action");

        const data = await response.json();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMessage.id
              ? {
                  ...m,
                  content: data.answer,
                  toolsUsed: data.toolsUsed,
                  isLoading: false,
                }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMessage.id
              ? { ...m, error: "Failed to complete the action. Please try again.", isLoading: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSuggestedQuestion = useCallback((question: string) => {
    setInput(question);
    inputRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    pendingConfirmRef.current = null;
  }, []);

  if (!isPro) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <CardTitle>AI Chat - Pro Feature</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            Ask questions about your data using natural language. Get insights, summaries, and find
            patterns across all your monitored conversations.
          </p>
          <Button>Upgrade to Pro</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ask anything about your data</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              I can search your results, analyze trends, find leads, manage monitors, and more. Just ask in plain English.
            </p>

            {/* Suggested Questions */}
            <div className="space-y-2 w-full max-w-md">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 justify-center">
                <Lightbulb className="h-3 w-3" />
                Try asking:
              </p>
              <div className="grid gap-2">
                {suggestedQuestions.slice(0, 4).map((question, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-start text-left h-auto py-2 px-3 text-sm"
                    onClick={() => handleSuggestedQuestion(question)}
                  >
                    <Sparkles className="h-3 w-3 mr-2 shrink-0 text-violet-500" />
                    <span className="line-clamp-1">{question}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCopy={(text) => handleCopy(text, message.id)}
                isCopied={copiedMessageId === message.id}
                onConfirm={message.pendingConfirmation ? handleConfirm : undefined}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
              <RefreshCcw className="h-3 w-3 mr-1" />
              Clear chat
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything — search results, create monitors, find leads…"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Kaulby AI can search, analyze, and take actions on your monitoring data.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function AIChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>
      </div>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}
