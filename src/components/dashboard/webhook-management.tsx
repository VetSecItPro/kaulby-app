"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Webhook,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Lock,
  Zap,
  HelpCircle,
  MessageSquare,
  Hash,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Detect webhook type from URL
function detectWebhookType(url: string): "slack" | "discord" | "generic" {
  if (url.includes("hooks.slack.com") || url.includes("slack.com/services")) {
    return "slack";
  }
  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks")) {
    return "discord";
  }
  return "generic";
}

// Webhook type badges
const webhookTypeBadges = {
  slack: { label: "Slack", color: "bg-purple-900 text-white", icon: Hash },
  discord: { label: "Discord", color: "bg-indigo-500 text-white", icon: MessageSquare },
  generic: { label: "Generic", color: "bg-muted-foreground text-white", icon: Webhook },
};

interface WebhookData {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  isActive: boolean;
  events: string[] | null;
  createdAt: Date;
}

interface DeliveryData {
  id: string;
  webhookId: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: Date;
}

interface WebhookManagementProps {
  isEnterprise: boolean;
  webhooks: WebhookData[];
  recentDeliveries: DeliveryData[];
}

export function WebhookManagement({
  isEnterprise,
  webhooks: initialWebhooks,
  recentDeliveries,
}: WebhookManagementProps) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newWebhook.name || !newWebhook.url) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/webhooks/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWebhook),
      });

      if (response.ok) {
        const { webhook } = await response.json();
        setWebhooks([webhook, ...webhooks]);
        setNewWebhook({ name: "", url: "" });
        setShowCreateDialog(false);
      }
    } catch (error) {
      console.error("Failed to create webhook:", error);
      toast.error("Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch("/api/webhooks/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });

      if (response.ok) {
        setWebhooks(webhooks.map(w =>
          w.id === id ? { ...w, isActive } : w
        ));
      }
    } catch (error) {
      console.error("Failed to toggle webhook:", error);
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks/manage?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWebhooks(webhooks.filter(w => w.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error);
      toast.error("Failed to delete webhook");
    }
  };

  const handleTest = async (id: string) => {
    setIsTesting(id);
    setTestResult(null);

    try {
      const response = await fetch("/api/webhooks/manage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        error: "Failed to send test webhook",
      });
    } finally {
      setIsTesting(null);
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(secret);
    setTimeout(() => setCopiedSecret(null), 2000);
  };

  if (!isEnterprise) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Receive real-time notifications when new results are found.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Webhooks allow you to receive real-time notifications in your own
              systems. This feature is available on the Enterprise plan.
            </p>
            <Button>
              <Zap className="h-4 w-4 mr-2" />
              Upgrade to Enterprise
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Receive real-time notifications when new results are found.
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Add a new webhook endpoint to receive notifications. Supports Slack, Discord, and custom endpoints.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="My Webhook"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
                {newWebhook.url && (() => {
                  const type = detectWebhookType(newWebhook.url);
                  const badge = webhookTypeBadges[type];
                  const Icon = badge.icon;
                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={badge.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {badge.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {type === "slack" && "Rich Slack Block Kit formatting"}
                        {type === "discord" && "Rich Discord embed formatting"}
                        {type === "generic" && "JSON payload format"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Setup Help */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                    How to get a webhook URL
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Slack Instructions */}
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="h-4 w-4 text-purple-900" />
                      <span className="font-medium text-sm">Slack</span>
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">api.slack.com/apps</a></li>
                      <li>Create an app or select existing</li>
                      <li>Go to &quot;Incoming Webhooks&quot; → Enable</li>
                      <li>Click &quot;Add New Webhook to Workspace&quot;</li>
                      <li>Select channel and copy the URL</li>
                    </ol>
                  </div>

                  {/* Discord Instructions */}
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      <span className="font-medium text-sm">Discord</span>
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Open channel settings (gear icon)</li>
                      <li>Go to &quot;Integrations&quot; → &quot;Webhooks&quot;</li>
                      <li>Click &quot;New Webhook&quot;</li>
                      <li>Set name and channel, then &quot;Copy Webhook URL&quot;</li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newWebhook.name || !newWebhook.url}
              >
                {isCreating ? "Creating..." : "Create Webhook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Webhook className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No webhooks yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first webhook to start receiving notifications.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{webhook.name}</CardTitle>
                    {(() => {
                      const type = detectWebhookType(webhook.url);
                      const badge = webhookTypeBadges[type];
                      const Icon = badge.icon;
                      return (
                        <Badge className={badge.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {badge.label}
                        </Badge>
                      );
                    })()}
                    <Badge variant={webhook.isActive ? "default" : "secondary"}>
                      {webhook.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                    />
                  </div>
                </div>
                <CardDescription className="font-mono text-xs break-all">
                  {webhook.url}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Secret */}
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Secret:</span>
                  <code className="text-xs font-mono truncate flex-1">
                    {webhook.secret ? `${webhook.secret.substring(0, 20)}...` : "None"}
                  </code>
                  {webhook.secret && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copySecret(webhook.secret!)}
                      aria-label={copiedSecret === webhook.secret ? "Secret copied" : "Copy webhook secret"}
                    >
                      {copiedSecret === webhook.secret ? (
                        <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-2">
                  {(webhook.events || ["new_result"]).map((event) => (
                    <Badge key={event} variant="outline">
                      {event}
                    </Badge>
                  ))}
                </div>

                {/* Test Result */}
                {testResult && isTesting === null && (
                  <div className={`p-3 rounded-lg ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${testResult.success ? "text-green-700" : "text-red-700"}`}>
                        {testResult.success ? "Test successful" : "Test failed"}
                      </span>
                      {testResult.statusCode && (
                        <Badge variant="outline">HTTP {testResult.statusCode}</Badge>
                      )}
                      {testResult.latencyMs && (
                        <span className="text-xs text-muted-foreground">
                          {testResult.latencyMs}ms
                        </span>
                      )}
                    </div>
                    {testResult.error && (
                      <p className="text-sm text-red-600 mt-1">{testResult.error}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(webhook.id)}
                    disabled={isTesting === webhook.id}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isTesting === webhook.id ? "Testing..." : "Send Test"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this webhook? This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(webhook.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Deliveries */}
      {recentDeliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Deliveries</CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDeliveries.slice(0, 10).map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {delivery.status === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : delivery.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm font-medium">{delivery.eventType}</span>
                    {delivery.statusCode && (
                      <Badge variant="outline" className="text-xs">
                        HTTP {delivery.statusCode}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {delivery.attemptCount > 1 && (
                      <span>Attempt {delivery.attemptCount}</span>
                    )}
                    <span>{new Date(delivery.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
