"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useOnboarding } from "@/components/dashboard/onboarding-provider";

export function TakeTourCard() {
  const { resetOnboarding } = useOnboarding();

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Play className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Onboarding Wizard</p>
              <p className="text-xs text-muted-foreground">
                Set up a new monitor with guided steps
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={resetOnboarding}>
            Start
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
