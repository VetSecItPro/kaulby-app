"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  Check,
  Monitor,
  Users,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  error?: string;
  timestamp: Date;
}

interface CreatedItem {
  type: "monitor" | "audience";
  name: string;
  id?: string;
}

interface OnboardingChatProps {
  userPlan: "free" | "pro" | "team";
  userName?: string;
}

// ---------------------------------------------------------------------------
// Welcome message
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE = `Hi! I'm Kaulby AI, and I'll help you get set up in a few minutes.

To get started — **what's your business or product about?** Tell me what you do and I'll suggest what to monitor.`;

// ---------------------------------------------------------------------------
// Simple markdown renderer (no framer-motion, no external deps)
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
// Loading dots
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
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

      <div className={cn("flex-1 max-w-[80%]", isUser && "flex justify-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {message.isLoading ? (
            <LoadingDots />
          ) : message.error ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {renderMarkdown(message.content)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Sidebar
// ---------------------------------------------------------------------------

function ProgressSidebar({
  createdItems,
  isComplete,
  onGoToDashboard,
}: {
  createdItems: CreatedItem[];
  isComplete: boolean;
  onGoToDashboard: () => void;
}) {
  const monitors = createdItems.filter((i) => i.type === "monitor");
  const audiences = createdItems.filter((i) => i.type === "audience");

  return (
    <div className="w-64 border-l flex flex-col shrink-0 bg-muted/20">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold">Setup Progress</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          AI will create your monitors as you chat
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Monitors */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Monitors
            </span>
            {monitors.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {monitors.length}
              </Badge>
            )}
          </div>

          {monitors.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 pl-1">
              None yet — tell me about your business
            </p>
          ) : (
            <div className="space-y-1.5">
              {monitors.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded-md px-2 py-1.5"
                >
                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                  <span className="truncate font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audiences */}
        {audiences.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Audiences
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {audiences.length}
              </Badge>
            </div>

            <div className="space-y-1.5">
              {audiences.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1.5"
                >
                  <Check className="h-3 w-3 text-blue-500 shrink-0" />
                  <span className="truncate font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {monitors.length === 0 && (
          <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
            <p className="text-xs font-medium">How it works</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-violet-500">•</span>
                Tell me about your product
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-violet-500">•</span>
                I&apos;ll suggest what to monitor
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-violet-500">•</span>
                I&apos;ll create monitors instantly
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-violet-500">•</span>
                Results appear within hours
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Go to Dashboard button — shown when at least one monitor is created */}
      {(isComplete || monitors.length > 0) && (
        <div className="p-4 border-t">
          <Button
            className="w-full gap-2"
            onClick={onGoToDashboard}
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            You can keep chatting or go explore
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OnboardingChat Component
// ---------------------------------------------------------------------------

export function OnboardingChat({ userPlan, userName }: OnboardingChatProps) {
  const router = useRouter();

  const welcomeMessage: ChatMessage = {
    id: "welcome",
    role: "assistant",
    content: userName
      ? `Hi ${userName}! I'm Kaulby AI, and I'll help you get set up in a few minutes.\n\nTo get started — **what's your business or product about?** Tell me what you do and I'll suggest what to monitor.`
      : WELCOME_MESSAGE,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Create a conversation in DB
  const ensureConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (conversationId) return conversationId;
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Onboarding: ${firstMessage.slice(0, 80)}` }),
      });
      if (!res.ok) return null;
      const { conversation } = await res.json();
      setConversationId(conversation.id);
      return conversation.id;
    } catch {
      return null;
    }
  }, [conversationId]);

  // Parse AI response for created items (monitors/audiences mentioned in tool results)
  const extractCreatedItems = useCallback((answer: string, toolsUsed?: { name: string; label: string }[]) => {
    const newItems: CreatedItem[] = [];

    if (!toolsUsed) return newItems;

    // Check if create_monitor was called
    if (toolsUsed.some((t) => t.name === "create_monitor")) {
      // Try to extract monitor name from the response
      const monitorMatch = answer.match(/monitor[^"]*[""]([^""]+)[""]/i)
        || answer.match(/created[^"]*[""]([^""]+)[""][^m]*monitor/i)
        || answer.match(/\*\*([^*]+)\*\*[^m]*monitor/i);
      const name = monitorMatch ? monitorMatch[1] : "New Monitor";
      newItems.push({ type: "monitor", name });
    }

    // Check if create_audience was called
    if (toolsUsed.some((t) => t.name === "create_audience")) {
      const audienceMatch = answer.match(/audience[^"]*[""]([^""]+)[""]/i)
        || answer.match(/created[^"]*[""]([^""]+)[""][^a]*audience/i);
      const name = audienceMatch ? audienceMatch[1] : "New Audience";
      newItems.push({ type: "audience", name });
    }

    return newItems;
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const userContent = input.trim();
      if (!userContent || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userContent,
        timestamp: new Date(),
      };

      const loadingMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isLoading: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // Ensure we have a conversation to save to
        const convId = await ensureConversation(userContent);

        // Build conversation history from non-loading, non-error messages (skip welcome for API)
        const history = messages
          .filter((m) => !m.isLoading && !m.error && m.id !== "welcome")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userContent,
            conversationHistory: history,
            conversationType: "onboarding",
            monitorIds: [],
            audienceIds: [],
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to get response");
        }

        const data = await response.json();

        const assistantMessage: ChatMessage = {
          id: loadingMessage.id,
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMessage.id ? assistantMessage : m))
        );

        // Extract any created items from the AI response
        const newItems = extractCreatedItems(data.answer, data.toolsUsed);
        if (newItems.length > 0) {
          setCreatedItems((prev) => [...prev, ...newItems]);
        }

        // Detect completion phrases
        const completionPhrases = [
          "you're all set",
          "youre all set",
          "go to dashboard",
          "setup is complete",
          "all set up",
          "you are all set",
        ];
        const isCompletionMessage = completionPhrases.some((phrase) =>
          data.answer.toLowerCase().includes(phrase)
        );
        if (isCompletionMessage) {
          setIsComplete(true);
        }

        // Save messages to DB if we have a conversation
        if (convId) {
          fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: convId,
              messages: [
                { role: "user", content: userContent },
                { role: "assistant", content: data.answer, toolsUsed: data.toolsUsed || null },
              ],
            }),
          }).catch(() => {});
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sorry, something went wrong. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMessage.id
              ? { ...m, error: errorMessage, isLoading: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, ensureConversation, extractCreatedItems]
  );

  const handleGoToDashboard = useCallback(() => {
    // Mark onboarding as complete
    fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => {});
    router.push("/dashboard");
    router.refresh();
  }, [router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex h-full">
      {/* Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b px-6 py-3 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              AI Setup Assistant
            </h1>
            <p className="text-xs text-muted-foreground">
              Tell me about your business and I&apos;ll set up your monitors
            </p>
          </div>
          <Link
            href="/dashboard/monitors/new"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Set up manually
          </Link>
        </div>

        {/* Plan badge */}
        <div className="px-6 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Your plan:</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium capitalize",
                userPlan === "team" && "border-purple-500/50 text-purple-400",
                userPlan === "pro" && "border-primary/50 text-primary",
                userPlan === "free" && "border-muted-foreground/30"
              )}
            >
              {userPlan}
            </Badge>
            {userPlan === "free" && (
              <span className="text-xs text-muted-foreground">
                Reddit monitoring included
              </span>
            )}
            {userPlan === "pro" && (
              <span className="text-xs text-muted-foreground">
                9 platforms available
              </span>
            )}
            {userPlan === "team" && (
              <span className="text-xs text-muted-foreground">
                All 17 platforms available
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about your business…"
              disabled={isLoading}
              className="flex-1"
              aria-label="Chat message"
            />
            <Button type="submit" disabled={!input.trim() || isLoading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Kaulby AI will create your monitors automatically based on your answers.
          </p>
        </div>
      </div>

      {/* Progress Sidebar */}
      <ProgressSidebar
        createdItems={createdItems}
        isComplete={isComplete}
        onGoToDashboard={handleGoToDashboard}
      />
    </div>
  );
}
