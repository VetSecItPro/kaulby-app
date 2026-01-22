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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlatformBadgeColor } from "@/lib/platform-utils";

interface Citation {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isLoading?: boolean;
  error?: string;
  timestamp: Date;
}

interface AIChatProps {
  /** Whether user has Pro access */
  isPro: boolean;
  /** Suggested questions based on user's data */
  suggestedQuestions?: string[];
  /** Monitor IDs to scope the search */
  monitorIds?: string[];
  /** Audience IDs to scope the search */
  audienceIds?: string[];
}

const SUGGESTED_QUESTIONS = [
  "What are the main complaints about [competitor]?",
  "Summarize what people are saying about pricing",
  "Find posts where someone is looking for a CRM alternative",
  "What features do people request most?",
  "Which platforms have the most engagement this week?",
  "Show me high-intent leads from the last 7 days",
];

/**
 * Citation Card - Shows a source reference
 */
const CitationCard = memo(function CitationCard({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={cn("capitalize text-[10px] shrink-0", getPlatformBadgeColor(citation.platform, "light"))}
            >
              {citation.platform}
            </Badge>
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

/**
 * Message Bubble Component
 */
const MessageBubble = memo(function MessageBubble({
  message,
  onCopy,
  isCopied,
}: {
  message: ChatMessage;
  onCopy: (text: string) => void;
  isCopied: boolean;
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
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm">Thinking...</span>
            </div>
          ) : message.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{message.error}</span>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

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

/**
 * AI Chat Component - Chat with your data
 */
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleCopy = useCallback((text: string, messageId?: string) => {
    navigator.clipboard.writeText(text);
    if (messageId) {
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
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

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
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
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: data.answer,
                citations: data.citations,
                isLoading: false,
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                error: "Sorry, I couldn't process that request. Please try again.",
                isLoading: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isPro, monitorIds, audienceIds, messages]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    setInput(question);
    inputRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
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
            Ask questions about your data using natural language. Get insights, summaries, and find patterns across all your monitored conversations.
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
              I can analyze your monitored conversations, find patterns, summarize feedback, and help you discover opportunities.
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
            placeholder="Ask about your data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI responses are generated based on your monitored conversations. Results may vary.
        </p>
      </div>
    </div>
  );
}

/**
 * AI Chat Skeleton - Loading state
 */
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
