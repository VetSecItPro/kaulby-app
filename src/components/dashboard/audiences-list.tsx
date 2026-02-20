"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AudienceCard, NewAudienceCard, type AudienceStats } from "./audience-card";
import { SuggestedCommunities } from "./suggested-communities";
import type { Audience } from "@/lib/db/schema";
import type { CommunitySuggestion } from "@/lib/community-suggestions";

interface AudienceWithStats extends Audience {
  stats: AudienceStats;
}

interface AudiencesListProps {
  audiences: AudienceWithStats[];
  suggestions?: CommunitySuggestion[];
}

export function AudiencesList({ audiences, suggestions = [] }: AudiencesListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddCommunity = (community: string) => {
    // Open Reddit in new tab for now - could be enhanced to add to monitor
    window.open(`https://reddit.com/${community}`, "_blank");
  };

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
      toast.error("Failed to delete audience");
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
            Group your monitors to track different user segments across all platforms.
          </p>
        </div>
        <Link href="/dashboard/audiences/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Audience
          </Button>
        </Link>
      </div>

      {/* Community Suggestions */}
      {suggestions.length > 0 && (
        <SuggestedCommunities
          suggestions={suggestions}
          onAddCommunity={handleAddCommunity}
        />
      )}

      {/* Empty State */}
      {audiences.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No audiences yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              Create audiences to group your monitors and track different customer segments.
              Choose from 12 pre-built templates or start from scratch.
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

      {/* Audiences Grid - Using new enhanced AudienceCard */}
      {audiences.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {audiences.map((audience) => (
            <AudienceCard
              key={audience.id}
              id={audience.id}
              name={audience.name}
              description={audience.description}
              color={audience.color}
              stats={audience.stats}
              onDeleteRequest={setDeleteId}
            />
          ))}
          {/* Add new audience card at the end */}
          <NewAudienceCard />
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
