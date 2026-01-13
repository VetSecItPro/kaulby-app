"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  MessageSquare,
  Bell,
  Activity,
  ArrowRight,
  Check,
  Rocket,
  Target,
  Zap,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const STEPS = [
  {
    id: 1,
    title: "Welcome to Kaulby",
    description: "Let's get you set up to track conversations that matter to your business.",
    icon: Rocket,
  },
  {
    id: 2,
    title: "How Kaulby Works",
    description: "Kaulby monitors communities and alerts you when people talk about topics you care about.",
    icon: Search,
  },
  {
    id: 3,
    title: "Create Your First Monitor",
    description: "Ready to start tracking? Let's create your first monitor.",
    icon: Target,
  },
];

export function OnboardingWizard({ isOpen, onClose, userName }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const router = useRouter();

  const currentStep = STEPS.find((s) => s.id === step);
  const progress = (step / STEPS.length) * 100;

  const handleNext = () => {
    if (step < STEPS.length) {
      setStep(step + 1);
    } else {
      onClose();
      router.push("/dashboard/monitors/new");
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <Progress value={progress} className="h-1 absolute top-0 left-0 right-0 rounded-t-lg" />

        <DialogHeader className="pt-4">
          {currentStep && (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <currentStep.icon className="h-8 w-8 text-white" />
            </div>
          )}
          <DialogTitle className="text-center text-xl">
            {step === 1 && userName ? `Welcome, ${userName}!` : currentStep?.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {currentStep?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Kaulby helps you discover and engage with conversations across the web.
                Never miss a mention again.
              </p>
              <div className="grid gap-3">
                <FeatureItem
                  icon={Radio}
                  title="Track keywords & topics"
                  description="Monitor Reddit, Hacker News, Product Hunt, and more"
                />
                <FeatureItem
                  icon={Activity}
                  title="AI-powered insights"
                  description="Automatic sentiment analysis and pain point detection"
                />
                <FeatureItem
                  icon={Bell}
                  title="Get notified"
                  description="Email or Slack alerts when new mentions are found"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-4">
                <StepVisual label="Keywords" icon={Search} />
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <StepVisual label="Monitor" icon={Radio} />
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <StepVisual label="Results" icon={MessageSquare} />
              </div>
              <div className="space-y-3 mt-6">
                <HowItWorksItem
                  number={1}
                  title="Define your keywords"
                  description="Add the topics, brands, or phrases you want to track"
                />
                <HowItWorksItem
                  number={2}
                  title="Choose your sources"
                  description="Select which platforms to monitor"
                />
                <HowItWorksItem
                  number={3}
                  title="Get actionable results"
                  description="View matches with AI summaries and engage directly"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">You&apos;re all set!</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first monitor to start tracking mentions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Pro tip: Start with broad keywords and narrow down based on results.
                </p>
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Free plan: 1 monitor, 3 keywords
                </Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step < STEPS.length && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleNext} className="gap-2">
            {step === STEPS.length ? (
              <>
                Create Monitor
                <Rocket className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                step === s.id ? "bg-primary w-4" : "bg-muted hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StepVisual({
  label,
  icon: Icon,
}: {
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function HowItWorksItem({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {number}
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Welcome banner for returning users with no monitors
interface WelcomeBannerProps {
  onDismiss: () => void;
}

export function WelcomeBanner({ onDismiss }: WelcomeBannerProps) {
  const router = useRouter();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Get started with Kaulby</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first monitor to start tracking mentions across Reddit, Hacker News, and more.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => router.push("/dashboard/monitors/new")} className="gap-2">
                  <Target className="h-4 w-4" />
                  Create Monitor
                </Button>
                <Button variant="ghost" onClick={onDismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick start guide component
export function QuickStartGuide() {
  const router = useRouter();

  const steps = [
    {
      completed: false,
      title: "Create your first monitor",
      description: "Set up keywords to track",
      action: () => router.push("/dashboard/monitors/new"),
      actionLabel: "Create",
    },
    {
      completed: false,
      title: "Configure alerts",
      description: "Get notified of new mentions",
      action: () => router.push("/dashboard/settings"),
      actionLabel: "Configure",
    },
    {
      completed: false,
      title: "Explore results",
      description: "Review and engage with mentions",
      action: () => router.push("/dashboard/results"),
      actionLabel: "View",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Quick Start Guide
        </CardTitle>
        <CardDescription>
          Complete these steps to get the most out of Kaulby
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    step.completed
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.completed ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={step.action}>
                {step.actionLabel}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
