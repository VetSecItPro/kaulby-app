import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Radio, MoreVertical } from "lucide-react";
import Link from "next/link";

export default async function MonitorsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    orderBy: [desc(monitors.createdAt)],
  });


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitors</h1>
          <p className="text-muted-foreground">
            Track keywords and topics across platforms.
          </p>
        </div>
        <Link href="/dashboard/monitors/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Monitor
          </Button>
        </Link>
      </div>

      {/* Monitors List */}
      {userMonitors.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No monitors yet</CardTitle>
            <CardDescription>
              Create your first monitor to start tracking mentions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/monitors/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Monitor
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {userMonitors.map((monitor) => (
            <Card key={monitor.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <CardTitle className="text-lg">{monitor.name}</CardTitle>
                    <Badge variant={monitor.isActive ? "default" : "secondary"}>
                      {monitor.isActive ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Keywords: {monitor.keywords.join(", ")}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Platforms:</span>
                  <div className="flex gap-1">
                    {monitor.platforms.map((platform) => (
                      <Badge
                        key={platform}
                        variant="outline"
                        className="capitalize"
                      >
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/dashboard/monitors/${monitor.id}`}>
                    <Button variant="outline" size="sm">
                      View Results
                    </Button>
                  </Link>
                  <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
