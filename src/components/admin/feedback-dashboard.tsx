"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CreditCard,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";

interface FeedbackItem {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackStats {
  total: number;
  open: number;
  inProgress: number;
  bugs: number;
  features: number;
}

interface FeedbackDashboardProps {
  feedback: FeedbackItem[];
  stats: FeedbackStats;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-amber-500/10 text-amber-500 border-amber-500/30", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Loader2 },
  resolved: { label: "Resolved", color: "bg-green-500/10 text-green-500 border-green-500/30", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-muted", icon: XCircle },
};

const categoryConfig: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: "Bug Report", icon: Bug, color: "text-red-500" },
  feature: { label: "Feature Request", icon: Lightbulb, color: "text-purple-500" },
  technical: { label: "Technical Issue", icon: AlertTriangle, color: "text-amber-500" },
  billing: { label: "Billing", icon: CreditCard, color: "text-green-500" },
  other: { label: "Other", icon: MessageSquare, color: "text-muted-foreground" },
};

export function FeedbackDashboard({ feedback, stats }: FeedbackDashboardProps) {
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = feedback.filter((f) => {
    if (filter !== "all" && f.category !== filter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  });

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/manage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Feedback</h1>
            <p className="text-muted-foreground text-sm">Bug reports, feature requests, and support tickets from users</p>
          </div>
        </div>
        <Badge variant="outline" className="text-primary border-primary">Admin</Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <p className="text-sm text-amber-500">Open</p>
            <p className="text-2xl font-bold text-amber-500">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4">
            <p className="text-sm text-blue-500">In Progress</p>
            <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <p className="text-sm text-red-500">Bugs</p>
            <p className="text-2xl font-bold text-red-500">{stats.bugs}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardContent className="p-4">
            <p className="text-sm text-purple-500">Feature Requests</p>
            <p className="text-2xl font-bold text-purple-500">{stats.features}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="bug">Bug Reports</SelectItem>
            <SelectItem value="feature">Feature Requests</SelectItem>
            <SelectItem value="technical">Technical Issues</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground self-center ml-auto">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </p>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No feedback yet</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => {
            const cat = categoryConfig[item.category] || categoryConfig.other;
            const status = statusConfig[item.status] || statusConfig.open;
            const CategoryIcon = cat.icon;

            return (
              <Card key={item.id} className="hover:border-muted-foreground/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <CategoryIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cat.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{item.subject}</h3>
                        <Badge variant="outline" className={status.color}>
                          {status.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {cat.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.userName || "Unknown"}
                        </span>
                        {item.userEmail && (
                          <a
                            href={`mailto:${item.userEmail}?subject=Re: ${encodeURIComponent(item.subject)}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {item.userEmail}
                          </a>
                        )}
                        <span>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                    <Select
                      value={item.status}
                      onValueChange={(val) => updateStatus(item.id, val)}
                      disabled={updatingId === item.id}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
