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
  Copy,
  Check,
  Lightbulb,
  AlertCircle,
  Bot,
  User,
  AlertTriangle,
  Wrench,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  History,
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

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
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

        {/* Pending confirmation — A11Y-KB-001: aria-live announces the
            inline confirmation card to screen readers when it appears. */}
        {!isUser && message.pendingConfirmation && onConfirm && (
          <div
            role="alertdialog"
            aria-live="assertive"
            aria-labelledby={`confirm-title-${message.id}`}
            aria-describedby={`confirm-msg-${message.id}`}
            className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 w-full"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-500" />
              <p id={`confirm-title-${message.id}`} className="text-sm font-medium text-amber-500">Confirmation Required</p>
            </div>
            <p id={`confirm-msg-${message.id}`} className="text-sm text-muted-foreground mb-3">
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
            {message.toolsUsed.map((tool) => (
              <Badge key={tool.name} variant="secondary" className="text-[10px] gap-1">
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
              {new Date(message.timestamp).toLocaleTimeString()}
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
    // A11Y-ARIA-002: aria-live announces rotating status text to screen readers
    // so they don't miss the progress indication while the AI is thinking.
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <div aria-hidden="true" className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-sm">{LOADING_MESSAGES[messageIndex]}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation Sidebar
// ---------------------------------------------------------------------------

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  collapsed,
  onToggle,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2 border-r w-12 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle} aria-label="Expand chat history">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNew} aria-label="New conversation">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-56 border-r flex flex-col shrink-0">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">History</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNew} aria-label="New conversation">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label="Collapse chat history">
            <PanelLeftClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            // A11Y-STRUCT-001: replaced `<div onClick>` with semantic <div role="button">
            // + tabIndex + onKeyDown so keyboard users can select conversations.
            // Using button role rather than <button> element to keep the nested
            // delete <button> valid (HTML5 disallows nested buttons).
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              aria-current={activeId === conv.id ? "true" : undefined}
              aria-label={`Conversation: ${conv.title}${activeId === conv.id ? " (current)" : ""}`}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeId === conv.id ? "bg-muted" : "hover:bg-muted/50"
              )}
              onClick={() => onSelect(conv.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(conv.id);
                }
              }}
            >
              <MessageSquare aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-xs truncate flex-1">{conv.title}</span>
              <button
                aria-label={`Delete conversation: ${conv.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
              >
                <Trash2 aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))
        )}
      </div>
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [, setConversationsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfirmRef = useRef<PendingConfirmation | null>(null);
  // Track messages that have been saved to DB to avoid re-saving
  const savedMessageCountRef = useRef(0);
  // Skip the message-loading effect when we just created a conversation ourselves
  const skipNextLoadRef = useRef(false);

  // Load conversations list on mount
  useEffect(() => {
    if (!isPro) return;
    fetch("/api/chat/conversations")
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setConversationsLoaded(true);
      })
      .catch(() => setConversationsLoaded(true));
  }, [isPro]);

  // Load messages when active conversation changes (but skip if we just created it)
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      savedMessageCountRef.current = 0;
      return;
    }
    // Skip loading from DB if we just created this conversation — messages are already in state
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    fetch(`/api/chat/messages?conversationId=${activeConversationId}`)
      .then((res) => res.json())
      .then((data) => {
        const loaded: ChatMessage[] = (data.messages || []).map((m: { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; toolsUsed?: ToolUsed[]; createdAt: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations || undefined,
          toolsUsed: m.toolsUsed || undefined,
          timestamp: new Date(m.createdAt),
        }));
        setMessages(loaded);
        savedMessageCountRef.current = loaded.length;
      })
      .catch(() => {});
  }, [activeConversationId]);

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

  // Save new messages to DB
  const saveMessages = useCallback(async (conversationId: string, newMessages: ChatMessage[]) => {
    const unsaved = newMessages.filter(
      (m) => !m.isLoading && !m.error
    );
    if (unsaved.length === 0) return;

    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: unsaved.map((m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations || null,
            toolsUsed: m.toolsUsed || null,
          })),
        }),
      });
      savedMessageCountRef.current += unsaved.length;
    } catch {
      // Silent fail — messages still visible in UI
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    try {
      const title = firstMessage.slice(0, 100) + (firstMessage.length > 100 ? "..." : "");
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create conversation");
      }
      const { conversation } = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      // Skip the useEffect that would wipe messages and reload from (empty) DB
      skipNextLoadRef.current = true;
      setActiveConversationId(conversation.id);
      savedMessageCountRef.current = 0;
      return conversation.id;
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading || !isPro) return;

      const userContent = input.trim();

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userContent,
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
        return updated.length > 100 ? updated.slice(-100) : updated;
      });
      setInput("");
      setIsLoading(true);

      // Create conversation if none active
      let convId = activeConversationId;
      if (!convId) {
        convId = await createConversation(userContent);
        if (!convId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, error: "Failed to create conversation. Please try again.", isLoading: false }
                : m
            )
          );
          setIsLoading(false);
          return;
        }
      }

      try {
        const response = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userContent,
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

        if (data.pendingConfirmation) {
          pendingConfirmRef.current = data.pendingConfirmation;
        }

        const completedAssistant: ChatMessage = {
          ...assistantMessage,
          content: data.answer,
          citations: data.citations,
          toolsUsed: data.toolsUsed,
          pendingConfirmation: data.pendingConfirmation || undefined,
          isLoading: false,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessage.id ? completedAssistant : m))
        );

        // Save both user + assistant messages to DB
        await saveMessages(convId, [userMessage, completedAssistant]);

        // Update conversation title in sidebar if it was the first message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, updatedAt: new Date().toISOString() } : c
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
    [input, isLoading, isPro, monitorIds, audienceIds, messages, activeConversationId, createConversation, saveMessages]
  );

  const handleConfirm = useCallback(
    async (confirmed: boolean) => {
      const pending = pendingConfirmRef.current;
      if (!pending) return;

      pendingConfirmRef.current = null;

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
        if (activeConversationId) {
          await saveMessages(activeConversationId, [cancelMessage]);
        }
        return;
      }

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

        const completedMessage: ChatMessage = {
          ...loadingMessage,
          content: data.answer,
          toolsUsed: data.toolsUsed,
          isLoading: false,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMessage.id ? completedMessage : m))
        );

        if (activeConversationId) {
          await saveMessages(activeConversationId, [completedMessage]);
        }
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
    [activeConversationId, saveMessages]
  );

  const handleSuggestedQuestion = useCallback((question: string) => {
    setInput(question);
    inputRef.current?.focus();
  }, []);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    savedMessageCountRef.current = 0;
    pendingConfirmRef.current = null;
    inputRef.current?.focus();
  }, []);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await fetch("/api/chat/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
        savedMessageCountRef.current = 0;
      }
    } catch {
      // Silent fail
    }
  }, [activeConversationId]);

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
            Unlock AI-powered sentiment analysis, lead scoring, and pain point detection.
            Ask questions about your data and get actionable insights instantly.
          </p>
          <Button>Unlock AI Insights</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <Button variant="ghost" size="sm" onClick={handleNewConversation} className="text-xs">
                <Plus className="h-3 w-3 mr-1" />
                New chat
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
              aria-label="Chat message"
            />
            <Button type="submit" disabled={!input.trim() || isLoading} aria-label="Send message">
              <Send aria-hidden="true" className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Kaulby AI can search, analyze, and take actions on your monitoring data.
          </p>
        </div>
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
