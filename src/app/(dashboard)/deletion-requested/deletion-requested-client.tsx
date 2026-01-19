"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, XCircle, CheckCircle } from "lucide-react";

interface DeletionRequestedClientProps {
  email: string;
  deletionDate: string;
}

export function DeletionRequestedClient({ email, deletionDate }: DeletionRequestedClientProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const deletionDateObj = new Date(deletionDate);
  const now = new Date();
  const daysRemaining = Math.ceil((deletionDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const handleCancelDeletion = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch("/api/user/request-deletion", {
        method: "DELETE",
      });
      if (response.ok) {
        setCancelled(true);
        setTimeout(() => {
          router.push("/dashboard/settings");
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to cancel deletion:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  if (cancelled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Deletion Cancelled</h2>
            <p className="text-muted-foreground">
              Your account is safe. Redirecting to settings...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-amber-200">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle>Account Scheduled for Deletion</CardTitle>
          <CardDescription>
            Your account deletion has been requested
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Account:</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">Deletion date:</span>
              <span className="font-medium text-destructive">
                {deletionDateObj.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="text-center pt-2">
              <span className="text-2xl font-bold text-amber-600">{daysRemaining}</span>
              <span className="text-muted-foreground ml-1">days remaining</span>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              After the deletion date, all your data will be permanently removed including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All monitors and configurations</li>
              <li>All results and AI analysis history</li>
              <li>Team members and API keys</li>
              <li>Subscription and billing information</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button
              variant="default"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="w-full"
            >
              {isCancelling ? "Cancelling..." : "Cancel Deletion Request"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
