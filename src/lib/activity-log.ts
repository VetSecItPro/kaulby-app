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

interface LogActivityParams {
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

