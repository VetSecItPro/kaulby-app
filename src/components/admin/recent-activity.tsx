"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  subscriptionStatus: "free" | "pro" | "enterprise";
  createdAt: Date;
}

interface RecentActivityProps {
  users: User[];
}

export function RecentActivity({ users }: RecentActivityProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pro":
        return "bg-primary text-primary-foreground";
      case "enterprise":
        return "bg-amber-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Recent Signups
        </CardTitle>
        <CardDescription>Latest user registrations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {user.name || user.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${getStatusColor(user.subscriptionStatus)}`}
                  >
                    {user.subscriptionStatus}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {formatTimeAgo(user.createdAt)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No recent signups
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
