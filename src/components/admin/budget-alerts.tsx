"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Bell, Plus, Trash2, Edit, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface BudgetAlert {
  id: string;
  name: string;
  period: "daily" | "weekly" | "monthly";
  thresholdUsd: number;
  warningPercent: number;
  isActive: boolean;
  notifyEmail: string | null;
  notifySlack: string | null;
  currentPeriodSpend: number | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  history?: {
    id: string;
    alertType: string;
    spendUsd: number;
    percentOfThreshold: number;
    createdAt: string;
  }[];
}

interface BudgetAlertsProps {
  initialAlerts: BudgetAlert[];
}

export function BudgetAlerts({ initialAlerts }: BudgetAlertsProps) {
  const [alerts, setAlerts] = useState<BudgetAlert[]>(initialAlerts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAlert, setEditingAlert] = useState<BudgetAlert | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    period: "daily" as "daily" | "weekly" | "monthly",
    thresholdUsd: 50,
    warningPercent: 80,
    notifyEmail: "",
    notifySlack: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      period: "daily",
      thresholdUsd: 50,
      warningPercent: 80,
      notifyEmail: "",
      notifySlack: "",
    });
    setEditingAlert(null);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/budget-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          period: formData.period,
          thresholdUsd: formData.thresholdUsd,
          warningPercent: formData.warningPercent,
          notifyEmail: formData.notifyEmail || null,
          notifySlack: formData.notifySlack || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create alert");
      }

      const { alert } = await res.json();
      setAlerts((prev) => [alert, ...prev]);
      setIsCreateOpen(false);
      resetForm();
      toast.success("Budget alert created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create alert");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAlert) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/budget-alerts/${editingAlert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          period: formData.period,
          thresholdUsd: formData.thresholdUsd,
          warningPercent: formData.warningPercent,
          notifyEmail: formData.notifyEmail || null,
          notifySlack: formData.notifySlack || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update alert");
      }

      const { alert } = await res.json();
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, ...alert } : a)));
      setIsCreateOpen(false);
      resetForm();
      toast.success("Budget alert updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update alert");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (alert: BudgetAlert) => {
    try {
      const res = await fetch(`/api/admin/budget-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !alert.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, isActive: !a.isActive } : a))
      );
      toast.success(alert.isActive ? "Alert paused" : "Alert activated");
    } catch {
      toast.error("Failed to update alert");
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm("Are you sure you want to delete this budget alert?")) return;

    try {
      const res = await fetch(`/api/admin/budget-alerts/${alertId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success("Budget alert deleted");
    } catch {
      toast.error("Failed to delete alert");
    }
  };

  const openEdit = (alert: BudgetAlert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      period: alert.period,
      thresholdUsd: alert.thresholdUsd,
      warningPercent: alert.warningPercent,
      notifyEmail: alert.notifyEmail || "",
      notifySlack: alert.notifySlack || "",
    });
    setIsCreateOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const getStatusBadge = (alert: BudgetAlert) => {
    if (!alert.isActive) {
      return <Badge variant="secondary">Paused</Badge>;
    }

    const spend = alert.currentPeriodSpend || 0;
    const percent = (spend / alert.thresholdUsd) * 100;

    if (percent >= 100) {
      return <Badge variant="destructive">Exceeded</Badge>;
    }
    if (percent >= alert.warningPercent) {
      return <Badge className="bg-amber-500 text-white">Warning</Badge>;
    }
    return <Badge className="bg-green-500 text-white">OK</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Budget Alerts
          </CardTitle>
          <CardDescription>
            Get notified when AI costs exceed thresholds
          </CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAlert ? "Edit" : "Create"} Budget Alert</DialogTitle>
              <DialogDescription>
                Configure cost thresholds and notification channels
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Alert Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Daily AI Cost Limit"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={formData.period}
                    onValueChange={(v) => setFormData({ ...formData, period: v as "daily" | "weekly" | "monthly" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold">Threshold ($)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.thresholdUsd}
                    onChange={(e) => setFormData({ ...formData, thresholdUsd: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warning">Warning at (%)</Label>
                <Input
                  id="warning"
                  type="number"
                  min="1"
                  max="99"
                  value={formData.warningPercent}
                  onChange={(e) => setFormData({ ...formData, warningPercent: parseInt(e.target.value) || 80 })}
                />
                <p className="text-xs text-muted-foreground">
                  Send a warning notification at this percentage of the threshold
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Notify Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.notifyEmail}
                  onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack">Slack Webhook URL (optional)</Label>
                <Input
                  id="slack"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formData.notifySlack}
                  onChange={(e) => setFormData({ ...formData, notifySlack: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={editingAlert ? handleUpdate : handleCreate} disabled={isLoading}>
                {isLoading ? "Saving..." : editingAlert ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No budget alerts configured</p>
            <p className="text-sm">Create an alert to monitor AI costs</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const spend = alert.currentPeriodSpend || 0;
                const percent = (spend / alert.thresholdUsd) * 100;

                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alert.name}</p>
                        <div className="flex gap-1 mt-1">
                          {alert.notifyEmail && (
                            <Badge variant="outline" className="text-xs">Email</Badge>
                          )}
                          {alert.notifySlack && (
                            <Badge variant="outline" className="text-xs">Slack</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{alert.period}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(alert.thresholdUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className={percent >= 100 ? "text-red-500 font-medium" : percent >= alert.warningPercent ? "text-amber-500" : ""}>
                          {formatCurrency(spend)}
                        </p>
                        <p className="text-xs text-muted-foreground">{percent.toFixed(1)}%</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(alert)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={alert.isActive}
                        onCheckedChange={() => handleToggleActive(alert)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(alert)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(alert.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Recent Alert History */}
        {alerts.some((a) => a.history && a.history.length > 0) && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Alerts
            </h4>
            <div className="space-y-2">
              {alerts
                .flatMap((a) =>
                  (a.history || []).map((h) => ({ ...h, alertName: a.name }))
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)
                .map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {h.alertType === "exceeded" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-sm">{h.alertName}</span>
                      <Badge variant={h.alertType === "exceeded" ? "destructive" : "secondary"} className="text-xs">
                        {h.alertType}
                      </Badge>
                    </div>
                    <div className="text-right text-sm">
                      <p>{formatCurrency(h.spendUsd)} ({h.percentOfThreshold.toFixed(0)}%)</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
