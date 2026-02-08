"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  requestCount: number;
  isActive: boolean;
}

interface ApiKeysSettingsProps {
  subscriptionStatus: string;
}

export function ApiKeysSettings({ subscriptionStatus }: ApiKeysSettingsProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const isEnterprise = subscriptionStatus === "enterprise";

  // Fetch API keys
  useEffect(() => {
    if (!isEnterprise) return;

    async function fetchKeys() {
      try {
        const res = await fetch("/api/api-keys");
        const data = await res.json();

        if (res.ok) {
          setApiKeys(data.keys || []);
        }
      } catch (err) {
        console.error("Failed to fetch API keys:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchKeys();
  }, [isEnterprise]);

  // Only show for Enterprise users
  if (!isEnterprise) {
    return null;
  }

  // Create new API key
  async function handleCreateKey() {
    if (!keyName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create API key");
        return;
      }

      // Store the new key (only shown once!)
      setNewlyCreatedKey(data.key);
      setApiKeys([data.keyInfo, ...apiKeys]);
      setKeyName("");
    } catch {
      setError("Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  // Revoke API key
  async function handleRevokeKey(keyId: string) {
    try {
      const res = await fetch(`/api/api-keys?keyId=${keyId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== keyId));
      }
    } catch {
      console.error("Failed to revoke API key");
    }
  }

  // Copy to clipboard
  function handleCopy() {
    if (newlyCreatedKey) {
      navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Close the new key dialog
  function handleCloseNewKeyDialog() {
    setNewlyCreatedKey(null);
    setShowCreateDialog(false);
    setShowKey(false);
  }

  if (loading) {
    return (
      <Card id="api-keys-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="api-keys-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Access
        </CardTitle>
        <CardDescription>
          Manage API keys for programmatic access to your monitors and results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rate Limit Info */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Rate Limit:</span> 10,000 requests per day
          </p>
        </div>

        {/* Existing API Keys */}
        {apiKeys.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Your API Keys</h4>
            <div className="space-y-2">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {apiKey.name}
                        {!apiKey.isActive && (
                          <Badge variant="secondary" className="text-xs">Revoked</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {apiKey.keyPrefix}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {apiKey.requestCount.toLocaleString()} requests
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apiKey.lastUsedAt
                          ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`
                          : "Never used"
                        }
                      </p>
                    </div>
                    {apiKey.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Revoke API key ${apiKey.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to revoke &quot;{apiKey.name}&quot;?
                              Any applications using this key will lose access immediately.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevokeKey(apiKey.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No keys yet */}
        {apiKeys.length === 0 && (
          <div className="text-center py-6 space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">No API Keys</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create an API key to access your data programmatically
              </p>
            </div>
          </div>
        )}

        {/* Create New Key Button */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {!newlyCreatedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Give your API key a name to help you identify it later.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    id="api-key-name"
                    aria-label="API key name"
                    placeholder="API key name (e.g., Production, Zapier Integration)"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                  />
                  {error && (
                    <p role="alert" className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} disabled={creating || !keyName.trim()}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Save Your API Key
                  </DialogTitle>
                  <DialogDescription>
                    This is the only time your API key will be shown. Copy it now and store it securely.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={newlyCreatedKey}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShowKey(!showKey)}
                        aria-label={showKey ? "Hide API key" : "Show API key"}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCopy}
                        aria-label="Copy API key"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Make sure to copy your API key now. You won&apos;t be able to see it again!
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseNewKeyDialog}>
                    I&apos;ve Saved My Key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* API Documentation Link */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Learn how to use the API in our{" "}
            <a href="/dashboard/help#api-access" className="text-primary hover:underline">
              documentation
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
