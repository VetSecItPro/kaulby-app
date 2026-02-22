import { describe, it, expect } from "vitest";
import { permissions, getRoleDescription, getAssignableRoles, type WorkspaceRole } from "../permissions";

describe("permissions", () => {
  const allRoles: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];

  describe("canManageBilling", () => {
    it("allows only owner", () => {
      expect(permissions.canManageBilling("owner")).toBe(true);
      expect(permissions.canManageBilling("admin")).toBe(false);
      expect(permissions.canManageBilling("editor")).toBe(false);
      expect(permissions.canManageBilling("viewer")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(permissions.canManageBilling(null)).toBe(false);
      expect(permissions.canManageBilling(undefined)).toBe(false);
    });
  });

  describe("canDeleteWorkspace", () => {
    it("allows only owner", () => {
      expect(permissions.canDeleteWorkspace("owner")).toBe(true);
      expect(permissions.canDeleteWorkspace("admin")).toBe(false);
      expect(permissions.canDeleteWorkspace("editor")).toBe(false);
      expect(permissions.canDeleteWorkspace("viewer")).toBe(false);
    });
  });

  describe("canInviteMembers", () => {
    it("allows admin and above", () => {
      expect(permissions.canInviteMembers("owner")).toBe(true);
      expect(permissions.canInviteMembers("admin")).toBe(true);
      expect(permissions.canInviteMembers("editor")).toBe(false);
      expect(permissions.canInviteMembers("viewer")).toBe(false);
    });
  });

  describe("canRemoveMembers", () => {
    it("allows admin and above", () => {
      expect(permissions.canRemoveMembers("owner")).toBe(true);
      expect(permissions.canRemoveMembers("admin")).toBe(true);
      expect(permissions.canRemoveMembers("editor")).toBe(false);
      expect(permissions.canRemoveMembers("viewer")).toBe(false);
    });
  });

  describe("canChangeRoles", () => {
    it("allows admin and above", () => {
      expect(permissions.canChangeRoles("owner")).toBe(true);
      expect(permissions.canChangeRoles("admin")).toBe(true);
      expect(permissions.canChangeRoles("editor")).toBe(false);
      expect(permissions.canChangeRoles("viewer")).toBe(false);
    });
  });

  describe("canModifyMember", () => {
    it("owner can modify anyone", () => {
      for (const target of allRoles) {
        expect(permissions.canModifyMember("owner", target)).toBe(true);
      }
    });

    it("admin can modify editors and viewers but not admins or owners", () => {
      expect(permissions.canModifyMember("admin", "viewer")).toBe(true);
      expect(permissions.canModifyMember("admin", "editor")).toBe(true);
      expect(permissions.canModifyMember("admin", "admin")).toBe(false);
      expect(permissions.canModifyMember("admin", "owner")).toBe(false);
    });

    it("editor and viewer cannot modify anyone", () => {
      for (const target of allRoles) {
        expect(permissions.canModifyMember("editor", target)).toBe(false);
        expect(permissions.canModifyMember("viewer", target)).toBe(false);
      }
    });

    it("returns false for null/undefined actor", () => {
      expect(permissions.canModifyMember(null, "viewer")).toBe(false);
      expect(permissions.canModifyMember(undefined, "viewer")).toBe(false);
    });
  });

  describe("canCreateMonitors", () => {
    it("allows editor and above", () => {
      expect(permissions.canCreateMonitors("owner")).toBe(true);
      expect(permissions.canCreateMonitors("admin")).toBe(true);
      expect(permissions.canCreateMonitors("editor")).toBe(true);
      expect(permissions.canCreateMonitors("viewer")).toBe(false);
    });
  });

  describe("canEditMonitors", () => {
    it("allows editor and above", () => {
      expect(permissions.canEditMonitors("owner")).toBe(true);
      expect(permissions.canEditMonitors("admin")).toBe(true);
      expect(permissions.canEditMonitors("editor")).toBe(true);
      expect(permissions.canEditMonitors("viewer")).toBe(false);
    });
  });

  describe("canDeleteMonitors", () => {
    it("allows editor and above", () => {
      expect(permissions.canDeleteMonitors("owner")).toBe(true);
      expect(permissions.canDeleteMonitors("admin")).toBe(true);
      expect(permissions.canDeleteMonitors("editor")).toBe(true);
      expect(permissions.canDeleteMonitors("viewer")).toBe(false);
    });
  });

  describe("canReassignMonitors", () => {
    it("allows admin and above", () => {
      expect(permissions.canReassignMonitors("owner")).toBe(true);
      expect(permissions.canReassignMonitors("admin")).toBe(true);
      expect(permissions.canReassignMonitors("editor")).toBe(false);
      expect(permissions.canReassignMonitors("viewer")).toBe(false);
    });
  });

  describe("canViewMonitors / canViewResults", () => {
    it("allows all roles", () => {
      for (const role of allRoles) {
        expect(permissions.canViewMonitors(role)).toBe(true);
        expect(permissions.canViewResults(role)).toBe(true);
      }
    });

    it("returns false for null", () => {
      expect(permissions.canViewMonitors(null)).toBe(false);
      expect(permissions.canViewResults(null)).toBe(false);
    });
  });

  describe("canExportData", () => {
    it("allows editor and above", () => {
      expect(permissions.canExportData("owner")).toBe(true);
      expect(permissions.canExportData("admin")).toBe(true);
      expect(permissions.canExportData("editor")).toBe(true);
      expect(permissions.canExportData("viewer")).toBe(false);
    });
  });

  describe("canManageAlerts", () => {
    it("allows editor and above", () => {
      expect(permissions.canManageAlerts("owner")).toBe(true);
      expect(permissions.canManageAlerts("admin")).toBe(true);
      expect(permissions.canManageAlerts("editor")).toBe(true);
      expect(permissions.canManageAlerts("viewer")).toBe(false);
    });
  });
});

describe("getRoleDescription", () => {
  it("returns descriptions for all roles", () => {
    expect(getRoleDescription("owner")).toContain("billing");
    expect(getRoleDescription("admin")).toContain("team members");
    expect(getRoleDescription("editor")).toContain("create");
    expect(getRoleDescription("viewer")).toContain("read-only");
  });
});

describe("getAssignableRoles", () => {
  it("owner can assign admin, editor, viewer", () => {
    expect(getAssignableRoles("owner")).toEqual(["admin", "editor", "viewer"]);
  });

  it("admin can assign editor, viewer", () => {
    expect(getAssignableRoles("admin")).toEqual(["editor", "viewer"]);
  });

  it("editor and viewer cannot assign any roles", () => {
    expect(getAssignableRoles("editor")).toEqual([]);
    expect(getAssignableRoles("viewer")).toEqual([]);
  });
});
