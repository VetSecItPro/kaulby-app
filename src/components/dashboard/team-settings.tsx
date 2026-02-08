"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, Trash2, Crown, User, Loader2, Building2, Radio, ArrowRightLeft, Activity, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { permissions, getAssignableRoles, getRoleDescription, type WorkspaceRole } from "@/lib/permissions";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  isCurrentUser: boolean;
}

interface Invite {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

interface Workspace {
  id: string;
  name: string;
  seatCount: number;
  seatLimit: number;
  members: Member[];
}

interface WorkspaceMonitor {
  id: string;
  name: string;
  companyName: string | null;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  newMatchCount: number;
  lastCheckedAt: string | null;
  createdAt: string;
  assignee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ActivityLogItem {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface TeamSettingsProps {
  subscriptionStatus: string;
}

export function TeamSettings({ subscriptionStatus }: TeamSettingsProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  // Team monitors state
  const [workspaceMonitors, setWorkspaceMonitors] = useState<WorkspaceMonitor[]>([]);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const isEnterprise = subscriptionStatus === "enterprise";

  // Fetch activity logs
  const fetchActivityLogs = useCallback(async (cursor?: string | null) => {
    setLoadingActivity(true);
    try {
      const url = cursor
        ? `/api/workspace/activity?cursor=${encodeURIComponent(cursor)}&limit=10`
        : "/api/workspace/activity?limit=10";
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        if (cursor) {
          setActivityLogs((prev) => [...prev, ...data.items]);
        } else {
          setActivityLogs(data.items);
        }
        setActivityCursor(data.nextCursor);
        setHasMoreActivity(data.hasMore);
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  // Fetch workspace data
  useEffect(() => {
    if (!isEnterprise) return;

    async function fetchData() {
      try {
        // Fetch workspace
        const wsRes = await fetch("/api/workspace");
        const wsData = await wsRes.json();

        if (wsRes.ok && wsData.workspace) {
          setWorkspace(wsData.workspace);
          setRole(wsData.role);

          // Fetch invites if admin+
          if (wsData.role === "owner" || wsData.role === "admin") {
            const invRes = await fetch("/api/workspace/invite");
            const invData = await invRes.json();
            if (invRes.ok) {
              setInvites(invData.invites || []);
            }
          }

          // Fetch workspace monitors
          const monitorsRes = await fetch("/api/workspace/monitors");
          const monitorsData = await monitorsRes.json();
          if (monitorsRes.ok) {
            setWorkspaceMonitors(monitorsData.monitors || []);
          }

          // Fetch activity logs
          fetchActivityLogs();
        }
      } catch (err) {
        console.error("Failed to fetch workspace:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isEnterprise, fetchActivityLogs]);

  // Only show for Enterprise users
  if (!isEnterprise) {
    return null;
  }

  // Create workspace
  async function handleCreateWorkspace() {
    if (!workspaceName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        return;
      }

      // Refresh the page to show the new workspace
      window.location.reload();
    } catch {
      setError("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  // Send invite
  async function handleInvite() {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);

    try {
      const res = await fetch("/api/workspace/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invite");
        return;
      }

      // Add to invites list
      setInvites([...invites, data.invite]);
      setInviteEmail("");
    } catch {
      setError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  // Revoke invite
  async function handleRevokeInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/workspace/invite/${inviteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setInvites(invites.filter((i) => i.id !== inviteId));
      }
    } catch {
      console.error("Failed to revoke invite");
    }
  }

  // Remove member
  async function handleRemoveMember(memberId: string) {
    try {
      const res = await fetch(`/api/workspace/members?memberId=${memberId}`, {
        method: "DELETE",
      });

      if (res.ok && workspace) {
        setWorkspace({
          ...workspace,
          seatCount: workspace.seatCount - 1,
          members: workspace.members.filter((m) => m.id !== memberId),
        });
      }
    } catch {
      console.error("Failed to remove member");
    }
  }

  // Change member role
  async function handleChangeRole(memberId: string, newRole: WorkspaceRole) {
    setChangingRole(memberId);
    try {
      const res = await fetch(`/api/workspace/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok && workspace) {
        setWorkspace({
          ...workspace,
          members: workspace.members.map((m) =>
            m.id === memberId ? { ...m, role: newRole } : m
          ),
        });
      } else {
        const data = await res.json();
        setError(data.error || "Failed to change role");
      }
    } catch {
      console.error("Failed to change role");
    } finally {
      setChangingRole(null);
    }
  }

  // Reassign monitor to another team member
  async function handleReassignMonitor(monitorId: string, newUserId: string) {
    setReassigning(monitorId);
    try {
      const res = await fetch(`/api/workspace/monitors/${monitorId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToUserId: newUserId }),
      });

      if (res.ok) {
        // Update local state
        const newAssignee = workspace?.members.find((m) => m.id === newUserId);
        setWorkspaceMonitors((monitors) =>
          monitors.map((m) =>
            m.id === monitorId
              ? {
                  ...m,
                  assignee: newAssignee
                    ? { id: newAssignee.id, name: newAssignee.name, email: newAssignee.email }
                    : null,
                }
              : m
          )
        );
      }
    } catch {
      console.error("Failed to reassign monitor");
    } finally {
      setReassigning(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No workspace - show create option
  if (!workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team
          </CardTitle>
          <CardDescription>
            Create a workspace to collaborate with your team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">No Workspace Yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a workspace and invite up to 5 team members
              </p>
            </div>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>Create Workspace</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Workspace</DialogTitle>
                  <DialogDescription>
                    Enter a name for your team workspace. You can invite team members after creating it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    id="workspace-name"
                    aria-label="Workspace name"
                    placeholder="Workspace name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  />
                  {error && (
                    <p role="alert" className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWorkspace} disabled={creating || !workspaceName.trim()}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has workspace - show details
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team
        </CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{workspace.name}</span>
          {" · "}
          {workspace.seatCount} / {workspace.seatLimit} seats used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Members */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Members</h4>
          <div className="space-y-2">
            {workspace.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {member.role === "owner" ? (
                      <Crown className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.name || member.email}
                      {member.isCurrentUser && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Role selector for non-owners, if current user can change roles */}
                  {member.role !== "owner" && permissions.canModifyMember(role, member.role) ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleChangeRole(member.id, value as WorkspaceRole)}
                      disabled={changingRole === member.id}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-xs" aria-label={`Role for ${member.name || member.email}`}>
                        <SelectValue>
                          {changingRole === member.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="capitalize">{member.role}</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {getAssignableRoles(role!).map((r) => (
                          <SelectItem key={r} value={r}>
                            <div className="flex flex-col">
                              <span className="capitalize">{r}</span>
                              <span className="text-xs text-muted-foreground">
                                {getRoleDescription(r)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  )}
                  {permissions.canModifyMember(role, member.role) && member.role !== "owner" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remove ${member.name || member.email} from workspace`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.name || member.email} from the workspace?
                            They will lose access to all monitors and results.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invites - Admin+ only */}
        {permissions.canInviteMembers(role) && invites.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Pending Invites</h4>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevokeInvite(invite.id)}
                    aria-label={`Revoke invite for ${invite.email}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite Form - Admin+ only */}
        {permissions.canInviteMembers(role) && workspace.seatCount < workspace.seatLimit && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Team Member
            </h4>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                aria-label="Team member email address"
                type="email"
                autoComplete="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                disabled={inviting}
              />
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Invite"
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {workspace.seatLimit - workspace.seatCount} seats remaining
            </p>
          </div>
        )}

        {/* Seat limit reached */}
        {permissions.canInviteMembers(role) && workspace.seatCount >= workspace.seatLimit && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              You&apos;ve reached your seat limit. Contact support to add more seats (+$15/user).
            </p>
          </div>
        )}

        {/* Team Monitors - visible to all members, reassignment only for owners */}
        {workspaceMonitors.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Team Monitors
            </h4>
            <div className="space-y-2">
              {workspaceMonitors.map((monitor) => (
                <div
                  key={monitor.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        monitor.isActive ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {monitor.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {monitor.platforms.join(", ")}
                        {monitor.newMatchCount > 0 && (
                          <span className="ml-2 text-primary">
                            {monitor.newMatchCount} new
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {permissions.canReassignMonitors(role) ? (
                      <Select
                        value={monitor.assignee?.id || ""}
                        onValueChange={(value) => handleReassignMonitor(monitor.id, value)}
                        disabled={reassigning === monitor.id}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs" aria-label={`Assignee for ${monitor.name}`}>
                          <SelectValue>
                            {reassigning === monitor.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              monitor.assignee?.name || monitor.assignee?.email || "Unassigned"
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {workspace.members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <div className="flex items-center gap-2">
                                {member.role === "owner" && (
                                  <Crown className="h-3 w-3 text-primary" />
                                )}
                                <span>{member.name || member.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {monitor.assignee?.name || monitor.assignee?.email || "Unassigned"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {permissions.canReassignMonitors(role) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                Reassign monitors by selecting a team member
              </p>
            )}
          </div>
        )}

        {/* Activity Log */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </h4>
          {activityLogs.length === 0 && !loadingActivity ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No activity yet. Actions will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {log.user.name || log.user.email}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {formatActivityAction(log.action, log.targetName)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {hasMoreActivity && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => fetchActivityLogs(activityCursor)}
                  disabled={loadingActivity}
                >
                  {loadingActivity ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Load more
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to format activity action into readable text
function formatActivityAction(action: string, targetName?: string | null): string {
  const target = targetName ? `"${targetName}"` : "";

  switch (action) {
    case "monitor_created": return `created monitor ${target}`;
    case "monitor_updated": return `updated monitor ${target}`;
    case "monitor_deleted": return `deleted monitor ${target}`;
    case "monitor_paused": return `paused monitor ${target}`;
    case "monitor_resumed": return `resumed monitor ${target}`;
    case "monitor_duplicated": return `duplicated monitor ${target}`;
    case "member_invited": return `invited ${target} to the workspace`;
    case "member_joined": return "joined the workspace";
    case "member_removed": return `removed ${target} from the workspace`;
    case "member_role_changed": return `changed the role of ${target}`;
    case "workspace_created": return "created the workspace";
    case "workspace_updated": return "updated workspace settings";
    case "workspace_settings_changed": return "changed workspace settings";
    case "api_key_created": return "created an API key";
    case "api_key_revoked": return `revoked API key ${target}`;
    case "webhook_created": return `created webhook ${target}`;
    case "webhook_updated": return `updated webhook ${target}`;
    case "webhook_deleted": return `deleted webhook ${target}`;
    default: return action.replace(/_/g, " ");
  }
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
