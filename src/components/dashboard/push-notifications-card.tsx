"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, AlertCircle } from "lucide-react";

// VAPID public key is base64url-encoded; PushManager.subscribe needs a Uint8Array.
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof window === "undefined" ? "" : window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      toast.error("Push not configured (missing VAPID public key)");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        toast.error("Notification permission denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // applicationServerKey accepts BufferSource; pass the backing ArrayBuffer
      // to satisfy strict typing across browser Uint8Array variants.
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        throw new Error(`Server rejected subscription (${res.status})`);
      }
      setStatus("on");
      toast.success("Push notifications enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enable push");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success("Push notifications disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable push");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error(`Test failed (${res.status})`);
      const data = (await res.json()) as { sent?: number; pruned?: number };
      toast.success(`Test sent to ${data.sent ?? 0} device(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Push Notifications
          </CardTitle>
          <CardDescription>Native browser notifications for high-intent leads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              This browser does not support push notifications. Try Chrome, Edge, or Firefox on
              desktop, or install the Kaulby PWA on your phone.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> Push Notifications
        </CardTitle>
        <CardDescription>
          Get a phone or desktop notification the moment a high-intent lead is detected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-toggle" className="text-sm font-medium">
              Enable on this device
            </Label>
            <p className="text-xs text-muted-foreground">
              {status === "denied"
                ? "Notifications blocked in browser settings. Unblock to enable."
                : "Each browser/device subscribes separately. You can manage them all from here."}
            </p>
          </div>
          <Switch
            id="push-toggle"
            checked={status === "on"}
            disabled={busy || status === "loading" || status === "denied"}
            onCheckedChange={(checked) => (checked ? enable() : disable())}
          />
        </div>
        {status === "on" && (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={sendTest} disabled={busy}>
              Send test notification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
