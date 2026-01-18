"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Mail, Trash2, Crown, User, Loader2, Building2 } from "lucide-react";
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

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "member";
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

interface TeamSettingsProps {
  subscriptionStatus: string;
}

export function TeamSettings({ subscriptionStatus }: TeamSettingsProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<"owner" | "member" | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  const isEnterprise = subscriptionStatus === "enterprise";

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

          // Fetch invites if owner
          if (wsData.role === "owner") {
            const invRes = await fetch("/api/workspace/invite");
            const invData = await invRes.json();
            if (invRes.ok) {
              setInvites(invData.invites || []);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch workspace:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isEnterprise]);

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
                    placeholder="Workspace name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
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
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  {role === "owner" && member.role !== "owner" && (
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

        {/* Pending Invites - Owner only */}
        {role === "owner" && invites.length > 0 && (
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

        {/* Invite Form - Owner only */}
        {role === "owner" && workspace.seatCount < workspace.seatLimit && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Team Member
            </h4>
            <div className="flex gap-2">
              <Input
                type="email"
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
        {role === "owner" && workspace.seatCount >= workspace.seatLimit && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              You&apos;ve reached your seat limit. Contact support to add more seats (+$15/user).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
