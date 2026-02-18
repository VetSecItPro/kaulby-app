"use client";

import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Plug,
  Settings,
  Trash2,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "disconnected" | "coming_soon";
  connectedAt?: string;
  accountName?: string;
}

interface IntegrationsSettingsProps {
  integrations: Integration[];
  isPro: boolean;
  onConnect?: (integrationId: string) => Promise<void>;
  onDisconnect?: (integrationId: string) => Promise<void>;
}

// CRM and integration icons (SVG paths for common CRMs)
const IntegrationIcon = memo(function IntegrationIcon({ name, className }: { name: string; className?: string }) {
  // Simple colored circles for now - in production, use actual logos
  const colors: Record<string, string> = {
    hubspot: "bg-orange-500",
    salesforce: "bg-blue-500",
    pipedrive: "bg-green-500",
    zapier: "bg-orange-400",
    slack: "bg-purple-500",
    discord: "bg-indigo-500",
    webhook: "bg-gray-500",
  };

  return (
    <div className={cn(
      "w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm",
      colors[name.toLowerCase()] || "bg-gray-400",
      className
    )}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
});

/**
 * Integration Card
 */
const IntegrationCard = memo(function IntegrationCard({
  integration,
  isPro,
  onConnect,
  onDisconnect,
}: {
  integration: Integration;
  isPro: boolean;
  onConnect?: (id: string) => Promise<void>;
  onDisconnect?: (id: string) => Promise<void>;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleConnect = async () => {
    if (!onConnect) return;
    setIsConnecting(true);
    try {
      await onConnect(integration.id);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setIsDisconnecting(true);
    try {
      await onDisconnect(integration.id);
      setShowDisconnectDialog(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Card className={cn(
      integration.status === "coming_soon" && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <IntegrationIcon name={integration.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{integration.name}</h3>
              {integration.status === "connected" && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {integration.status === "coming_soon" && (
                <Badge variant="outline">Coming Soon</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {integration.description}
            </p>
            {integration.status === "connected" && integration.accountName && (
              <p className="text-xs text-muted-foreground mt-2">
                Connected to: <span className="font-medium">{integration.accountName}</span>
              </p>
            )}
          </div>
          <div className="shrink-0">
            {integration.status === "disconnected" && (
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !isPro}
                size="sm"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plug className="h-4 w-4 mr-1" />
                    Connect
                  </>
                )}
              </Button>
            )}
            {integration.status === "connected" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
                <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Disconnect {integration.name}?</DialogTitle>
                      <DialogDescription>
                        This will remove the connection. You can reconnect at any time, but any pending syncs will be cancelled.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDisconnectDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Disconnect
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            {integration.status === "coming_soon" && (
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Webhook Configuration Section
 */
const WebhookConfigSection = memo(function WebhookConfigSection() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    // Simulate test
    await new Promise((r) => setTimeout(r, 1000));
    setIsTesting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Custom Webhook</CardTitle>
        </div>
        <CardDescription>
          Send new results to any endpoint. Great for custom integrations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <div className="flex gap-2">
            <Input
              id="webhook-url"
              placeholder="https://your-app.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!webhookUrl || isTesting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Test"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll send a POST request with result data in JSON format.
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Integrations Settings Component
 */
export function IntegrationsSettings({
  integrations,
  isPro,
  onConnect,
  onDisconnect,
}: IntegrationsSettingsProps) {
  const [liveIntegrations, setLiveIntegrations] = useState(integrations);

  // Fetch real connection status from the API
  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const res = await fetch("/api/integrations/status");
        if (!res.ok) return;
        const data = await res.json();
        const statusMap = data.integrations as Record<string, {
          connected: boolean;
          connectedAt?: string;
          accountName?: string;
        }>;
        if (cancelled) return;
        setLiveIntegrations((prev) =>
          prev.map((i) => {
            const live = statusMap[i.id];
            if (!live) return i;
            return {
              ...i,
              status: live.connected ? "connected" as const : i.status,
              connectedAt: live.connectedAt || i.connectedAt,
              accountName: live.accountName || i.accountName,
            };
          })
        );
      } catch {
        // Silently fail — fall back to defaults
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, []);

  // Group integrations by category
  const crmIntegrations = liveIntegrations.filter((i) =>
    ["hubspot"].includes(i.id)
  );
  const otherIntegrations = liveIntegrations.filter((i) =>
    !["hubspot"].includes(i.id)
  );

  return (
    <div className="space-y-6">
      {/* Pro requirement notice */}
      {!isPro && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Upgrade to Pro for integrations
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                CRM integrations and custom webhooks are available on Pro and Team plans.
              </p>
              <Button size="sm" className="mt-2">
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRM Integrations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">CRM Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Export leads directly to your CRM. Sync contact info, post context, and sentiment.
          </p>
        </div>
        <div className="grid gap-4">
          {crmIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              isPro={isPro}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      </div>

      {/* Other Integrations */}
      {otherIntegrations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Other Integrations</h2>
            <p className="text-sm text-muted-foreground">
              Connect to other tools in your workflow.
            </p>
          </div>
          <div className="grid gap-4">
            {otherIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isPro={isPro}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Webhook */}
      {isPro && <WebhookConfigSection />}

      {/* API Documentation Link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium">API Access</h3>
            <p className="text-sm text-muted-foreground">
              Build custom integrations with our REST API.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              // Scroll to API Keys section on the same page
              const apiSection = document.getElementById("api-keys-section");
              if (apiSection) {
                apiSection.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="gap-1"
          >
            <ExternalLink className="h-4 w-4" />
            View API Keys
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Default integrations data
export const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync leads to HubSpot CRM. Create contacts and deals automatically.",
    icon: "hubspot",
    status: "disconnected",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get real-time alerts in your Slack channels.",
    icon: "slack",
    status: "disconnected",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Get real-time alerts in your Discord server channels.",
    icon: "discord",
    status: "disconnected",
  },
];
