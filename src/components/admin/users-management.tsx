"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Users,
  Crown,
  Building2,
  User,
  Shield,
  Radio,
  Ban,
  ArrowUpCircle,
  ArrowDownCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { updateUserPlan, toggleUserBan } from "./user-actions";

interface UserData {
  id: string;
  email: string;
  name: string | null;
  subscriptionStatus: string;
  isAdmin: boolean;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  monitorsCount: number;
  resultsThisMonth: number;
  aiCallsThisMonth: number;
}

interface PlanCounts {
  all: number;
  free: number;
  pro: number;
  enterprise: number;
}

interface UsersManagementProps {
  users: UserData[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
  planCounts: PlanCounts;
  currentSearch: string;
  currentPlan: string;
}

const planFilters = [
  { value: "all", label: "All Plans", icon: Users },
  { value: "free", label: "Free", icon: User },
  { value: "pro", label: "Pro", icon: Crown },
  { value: "enterprise", label: "Team", icon: Building2 },
];

export function UsersManagement({
  users,
  total,
  page,
  totalPages,
  perPage,
  planCounts,
  currentSearch,
  currentPlan,
}: UsersManagementProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    type: "upgrade" | "downgrade" | "ban" | null;
    user: UserData | null;
  }>({ type: null, user: null });

  const updateSearchParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filtering
    if (key !== "page") {
      params.set("page", "1");
    }
    startTransition(() => {
      router.push(`/manage/users?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams("search", search);
  };

  const handlePlanAction = async (action: "upgrade" | "downgrade", user: UserData) => {
    const newPlan = action === "upgrade"
      ? (user.subscriptionStatus === "free" ? "pro" : "enterprise")
      : (user.subscriptionStatus === "enterprise" ? "pro" : "free");

    await updateUserPlan(user.id, newPlan as "free" | "pro" | "enterprise");
    setActionDialog({ type: null, user: null });
    router.refresh();
  };

  const handleBan = async (user: UserData) => {
    // For now, banning would require adding a banned field to the schema
    // This is a placeholder for the functionality
    await toggleUserBan(user.id);
    setActionDialog({ type: null, user: null });
    router.refresh();
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              {total} users total
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Admin
        </Badge>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Plan Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {planFilters.map((filter) => {
            const count = planCounts[filter.value as keyof PlanCounts];
            const isActive = currentPlan === filter.value;
            return (
              <Button
                key={filter.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => updateSearchParams("plan", filter.value === "all" ? "" : filter.value)}
                className="gap-2 whitespace-nowrap"
              >
                <filter.icon className="h-4 w-4" />
                {filter.label}
                <Badge variant={isActive ? "secondary" : "outline"} className="ml-1">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:max-w-sm ml-auto">
          <Input
            placeholder="Search by email, name, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" disabled={isPending}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden md:table-cell">Monitors</TableHead>
                <TableHead className="hidden lg:table-cell">Results/Mo</TableHead>
                <TableHead className="hidden lg:table-cell">AI Calls/Mo</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          {user.isAdmin ? (
                            <Shield className="h-5 w-5 text-primary" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.name || "No name"}</p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlanBadge plan={user.subscriptionStatus} />
                        {user.isBanned && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />
                            Banned
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        {user.monitorsCount}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.resultsThisMonth}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.aiCallsThisMonth}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                            <User className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {user.stripeCustomerId && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View in Stripe
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {user.subscriptionStatus !== "enterprise" && (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ type: "upgrade", user })}
                            >
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              Upgrade Plan
                            </DropdownMenuItem>
                          )}
                          {user.subscriptionStatus !== "free" && (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ type: "downgrade", user })}
                            >
                              <ArrowDownCircle className="h-4 w-4 mr-2" />
                              Downgrade Plan
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setActionDialog({ type: "ban", user })}
                            className={user.isBanned ? "text-green-600" : "text-destructive"}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            {user.isBanned ? "Unban User" : "Ban User"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateSearchParams("page", String(page - 1))}
              disabled={page <= 1 || isPending}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateSearchParams("page", String(page + 1))}
              disabled={page >= totalPages || isPending}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.name || "No name"}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <PlanBadge plan={selectedUser.subscriptionStatus} />
                    {selectedUser.isAdmin && (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Monitors</p>
                  <p className="text-2xl font-bold">{selectedUser.monitorsCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Results This Month</p>
                  <p className="text-2xl font-bold">{selectedUser.resultsThisMonth}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">AI Calls This Month</p>
                  <p className="text-2xl font-bold">{selectedUser.aiCallsThisMonth}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="text-lg font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{selectedUser.id}</span>
                </div>
                {selectedUser.stripeCustomerId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stripe ID:</span>
                    <span className="font-mono text-xs">{selectedUser.stripeCustomerId}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialogs */}
      <Dialog
        open={!!actionDialog.type}
        onOpenChange={() => setActionDialog({ type: null, user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "upgrade" && "Upgrade User Plan"}
              {actionDialog.type === "downgrade" && "Downgrade User Plan"}
              {actionDialog.type === "ban" && (actionDialog.user?.isBanned ? "Unban User" : "Ban User")}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === "upgrade" && (
                <>
                  Upgrade {actionDialog.user?.email} from{" "}
                  <strong>{actionDialog.user?.subscriptionStatus}</strong> to{" "}
                  <strong>
                    {actionDialog.user?.subscriptionStatus === "free" ? "pro" : "enterprise"}
                  </strong>
                  ?
                </>
              )}
              {actionDialog.type === "downgrade" && (
                <>
                  Downgrade {actionDialog.user?.email} from{" "}
                  <strong>{actionDialog.user?.subscriptionStatus}</strong> to{" "}
                  <strong>
                    {actionDialog.user?.subscriptionStatus === "enterprise" ? "pro" : "free"}
                  </strong>
                  ?
                </>
              )}
              {actionDialog.type === "ban" && (
                actionDialog.user?.isBanned ? (
                  <>
                    Are you sure you want to unban {actionDialog.user?.email}? They will regain
                    access to the dashboard.
                  </>
                ) : (
                  <>
                    Are you sure you want to ban {actionDialog.user?.email}? They will be blocked
                    from accessing the dashboard.
                  </>
                )
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: null, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog.type === "ban" && !actionDialog.user?.isBanned ? "destructive" : "default"}
              onClick={() => {
                if (actionDialog.type === "ban" && actionDialog.user) {
                  handleBan(actionDialog.user);
                } else if ((actionDialog.type === "upgrade" || actionDialog.type === "downgrade") && actionDialog.user) {
                  handlePlanAction(actionDialog.type, actionDialog.user);
                }
              }}
            >
              {actionDialog.type === "upgrade" && "Upgrade"}
              {actionDialog.type === "downgrade" && "Downgrade"}
              {actionDialog.type === "ban" && (actionDialog.user?.isBanned ? "Unban" : "Ban User")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        plan === "pro" && "bg-primary/10 text-primary border-primary",
        plan === "enterprise" && "bg-amber-500/10 text-amber-600 border-amber-500",
        plan === "free" && "bg-muted text-muted-foreground"
      )}
    >
      {plan === "pro" && <Crown className="h-3 w-3 mr-1" />}
      {plan === "enterprise" && <Building2 className="h-3 w-3 mr-1" />}
      <span className="capitalize">{plan}</span>
    </Badge>
  );
}
