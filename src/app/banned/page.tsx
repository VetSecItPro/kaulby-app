import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban, Mail } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

export default async function BannedPage() {
  const { userId } = await auth();

  // If not logged in, redirect to home
  if (!userId) {
    redirect("/");
  }

  // Check if user is actually banned
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      isBanned: true,
      banReason: true,
      bannedAt: true,
      email: true,
    },
  });

  // If user is not banned, redirect to dashboard
  if (!user?.isBanned) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Account Suspended</CardTitle>
          <CardDescription>
            Your account has been suspended and you cannot access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.banReason && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-1">Reason:</p>
              <p className="text-sm text-muted-foreground">{user.banReason}</p>
            </div>
          )}

          {user.bannedAt && (
            <p className="text-sm text-muted-foreground text-center">
              Suspended on {new Date(user.bannedAt).toLocaleDateString()}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">
              If you believe this is an error, please contact support.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="mailto:support@kaulbyapp.com">
                <Button variant="outline" className="w-full gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Support
                </Button>
              </Link>
              <SignOutButton>
                <Button variant="ghost" className="w-full">
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
