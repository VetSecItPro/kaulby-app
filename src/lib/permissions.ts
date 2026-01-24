/**
 * Workspace role permissions
 *
 * Role hierarchy (highest to lowest):
 * - owner:  Full control - billing, delete workspace, manage all members
 * - admin:  Team management - invite/remove non-owners, manage all monitors
 * - editor: Content creation - create/edit monitors, view all results
 * - viewer: Read-only - view monitors and results, no modifications
 */

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

// Role hierarchy for comparison (higher number = more permissions)
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

/**
 * Check if a role has at least the required permission level
 */
export function hasPermission(
  userRole: WorkspaceRole | null | undefined,
  requiredRole: WorkspaceRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Permission checks for specific actions
 */
export const permissions = {
  // Workspace management
  canManageBilling: (role: WorkspaceRole | null | undefined) =>
    role === "owner",
  canDeleteWorkspace: (role: WorkspaceRole | null | undefined) =>
    role === "owner",

  // Member management
  canInviteMembers: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "admin"),
  canRemoveMembers: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "admin"),
  canChangeRoles: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "admin"),

  // Check if user can modify another user's role
  canModifyMember: (
    actorRole: WorkspaceRole | null | undefined,
    targetRole: WorkspaceRole
  ) => {
    // Only owner can modify admins, admins can modify editors/viewers
    if (!actorRole) return false;
    if (actorRole === "owner") return true;
    if (actorRole === "admin" && ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY.admin) return true;
    return false;
  },

  // Monitor management
  canCreateMonitors: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "editor"),
  canEditMonitors: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "editor"),
  canDeleteMonitors: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "editor"),
  canReassignMonitors: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "admin"),

  // Results/data access
  canViewMonitors: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "viewer"),
  canViewResults: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "viewer"),
  canExportData: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "editor"),

  // Alerts
  canManageAlerts: (role: WorkspaceRole | null | undefined) =>
    hasPermission(role, "editor"),
};

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: WorkspaceRole): string {
  const names: Record<WorkspaceRole, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };
  return names[role];
}

/**
 * Get role description for tooltips/help text
 */
export function getRoleDescription(role: WorkspaceRole): string {
  const descriptions: Record<WorkspaceRole, string> = {
    owner: "Full control including billing and workspace deletion",
    admin: "Can manage team members and all monitors",
    editor: "Can create and edit monitors and alerts",
    viewer: "Can view monitors and results (read-only)",
  };
  return descriptions[role];
}

/**
 * Get roles that a user can assign to others
 */
export function getAssignableRoles(actorRole: WorkspaceRole): WorkspaceRole[] {
  if (actorRole === "owner") {
    return ["admin", "editor", "viewer"];
  }
  if (actorRole === "admin") {
    return ["editor", "viewer"];
  }
  return [];
}
