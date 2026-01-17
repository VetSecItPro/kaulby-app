"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreVertical, Radio, Trash2, Pencil, Users } from "lucide-react";
import type { Audience } from "@/lib/db/schema";

interface AudienceWithCount extends Audience {
  monitorCount: number;
}

interface AudiencesListProps {
  audiences: AudienceWithCount[];
}

export function AudiencesList({ audiences }: AudiencesListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/audiences/${deleteId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete audience:", error);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audiences</h1>
          <p className="text-muted-foreground">
            Group your monitors to track different user segments.
          </p>
        </div>
        <Link href="/dashboard/audiences/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Audience
          </Button>
        </Link>
      </div>

      {/* Empty State */}
      {audiences.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No audiences yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              Create audiences to group your monitors and track different customer segments
              like &quot;Power Users&quot;, &quot;Enterprise Prospects&quot;, or &quot;Churned Customers&quot;.
            </p>
            <Link href="/dashboard/audiences/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Audience
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Audiences Grid */}
      {audiences.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <Card
              key={audience.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/dashboard/audiences/${audience.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {audience.color && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: audience.color }}
                      />
                    )}
                    <CardTitle className="text-lg">{audience.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/audiences/${audience.id}/edit`);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(audience.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {audience.description && (
                  <CardDescription className="line-clamp-2">
                    {audience.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Radio className="h-3 w-3" />
                    {audience.monitorCount} monitor{audience.monitorCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audience</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this audience? Your monitors will not be
              deleted, only removed from this audience group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
