import { db, activityLogs } from "@/lib/db";
import { headers } from "next/headers";

// Activity action types (matches the enum in schema)
export type ActivityAction =
  | "monitor_created"
  | "monitor_updated"
  | "monitor_deleted"
  | "monitor_paused"
  | "monitor_resumed"
  | "monitor_duplicated"
  | "member_invited"
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "workspace_created"
  | "workspace_updated"
  | "workspace_settings_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "webhook_created"
  | "webhook_updated"
  | "webhook_deleted";

export interface LogActivityParams {
  workspaceId: string;
  userId: string;
  action: ActivityAction;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an activity to the workspace audit trail
 * Call this after any significant action in a workspace
 */
export async function logActivity({
  workspaceId,
  userId,
  action,
  targetType,
  targetId,
  targetName,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    // Get IP and user agent from request headers (if available)
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    try {
      const headersList = await headers();
      ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                  headersList.get("x-real-ip") ||
                  undefined;
      userAgent = headersList.get("user-agent") || undefined;
    } catch {
      // Headers not available (e.g., in background jobs)
    }

    await db.insert(activityLogs).values({
      workspaceId,
      userId,
      action,
      targetType,
      targetId,
      targetName,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Don't throw - activity logging should never break the main operation
    console.error("Failed to log activity:", error);
  }
}

/**
 * Helper to get a human-readable description of an activity
 */
export function getActivityDescription(
  action: ActivityAction,
  actorName: string,
  targetName?: string
): string {
  const target = targetName ? `"${targetName}"` : "an item";

  switch (action) {
    case "monitor_created":
      return `${actorName} created monitor ${target}`;
    case "monitor_updated":
      return `${actorName} updated monitor ${target}`;
    case "monitor_deleted":
      return `${actorName} deleted monitor ${target}`;
    case "monitor_paused":
      return `${actorName} paused monitor ${target}`;
    case "monitor_resumed":
      return `${actorName} resumed monitor ${target}`;
    case "monitor_duplicated":
      return `${actorName} duplicated monitor ${target}`;
    case "member_invited":
      return `${actorName} invited ${target} to the workspace`;
    case "member_joined":
      return `${actorName} joined the workspace`;
    case "member_removed":
      return `${actorName} removed ${target} from the workspace`;
    case "member_role_changed":
      return `${actorName} changed the role of ${target}`;
    case "workspace_created":
      return `${actorName} created the workspace`;
    case "workspace_updated":
      return `${actorName} updated workspace settings`;
    case "workspace_settings_changed":
      return `${actorName} changed workspace settings`;
    case "api_key_created":
      return `${actorName} created an API key`;
    case "api_key_revoked":
      return `${actorName} revoked API key ${target}`;
    case "webhook_created":
      return `${actorName} created webhook ${target}`;
    case "webhook_updated":
      return `${actorName} updated webhook ${target}`;
    case "webhook_deleted":
      return `${actorName} deleted webhook ${target}`;
    default:
      return `${actorName} performed an action`;
  }
}

/**
 * Get the icon name for an activity action (for UI display)
 */
export function getActivityIcon(action: ActivityAction): string {
  if (action.startsWith("monitor_")) return "activity";
  if (action.startsWith("member_")) return "users";
  if (action.startsWith("workspace_")) return "building";
  if (action.startsWith("api_key_")) return "key";
  if (action.startsWith("webhook_")) return "webhook";
  return "circle";
}
