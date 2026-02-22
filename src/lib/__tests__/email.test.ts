import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend
const mockSend = vi.fn().mockResolvedValue({ id: "email-123" });

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

// Mock the security module
vi.mock("@/lib/security/sanitize", () => ({
  escapeHtml: (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;"),
}));

import {
  sendWelcomeEmail,
  sendAlertEmail,
  sendSubscriptionEmail,
  sendPaymentFailedEmail,
  sendWorkspaceInviteEmail,
  sendInviteAcceptedEmail,
  sendDigestEmail,
  sendDeletionRequestedEmail,
  sendDeletionReminderEmail,
  sendDeletionConfirmedEmail,
  sendReengagementEmail,
  upsertContact,
} from "../email";

describe("Email Module", () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  describe("sendWelcomeEmail", () => {
    it("sends welcome email with correct to and subject", async () => {
      await sendWelcomeEmail({ email: "user@test.com", name: "Alice" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.to).toBe("user@test.com");
      expect(call.subject).toBe("Welcome to Kaulby");
      expect(call.html).toContain("Alice");
    });

    it("uses default name when not provided", async () => {
      await sendWelcomeEmail({ email: "user@test.com" });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("there");
    });
  });

  describe("sendAlertEmail", () => {
    it("sends alert with results", async () => {
      await sendAlertEmail({
        to: "user@test.com",
        monitorName: "My Monitor",
        results: [
          {
            title: "Test Result",
            url: "https://example.com",
            platform: "reddit",
            sentiment: "positive",
            summary: "A summary",
          },
        ],
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("1 new mention");
      expect(call.subject).toContain("My Monitor");
      expect(call.html).toContain("Test Result");
    });

    it("pluralizes subject for multiple results", async () => {
      await sendAlertEmail({
        to: "user@test.com",
        monitorName: "Monitor",
        results: [
          { title: "R1", url: "https://a.com", platform: "reddit" },
          { title: "R2", url: "https://b.com", platform: "reddit" },
        ],
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("2 new mentions");
    });
  });

  describe("sendSubscriptionEmail", () => {
    it("sends subscription email with plan name", async () => {
      await sendSubscriptionEmail({
        email: "user@test.com",
        name: "Bob",
        plan: "Pro",
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Welcome to Kaulby Pro");
      expect(call.html).toContain("Pro");
      expect(call.html).toContain("Bob");
    });
  });

  describe("sendPaymentFailedEmail", () => {
    it("sends payment failed email", async () => {
      await sendPaymentFailedEmail({ email: "user@test.com", name: "Carol" });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Action required: Payment failed");
      expect(call.html).toContain("Carol");
    });
  });

  describe("sendWorkspaceInviteEmail", () => {
    it("sends invite email with workspace info", async () => {
      await sendWorkspaceInviteEmail({
        email: "invite@test.com",
        workspaceName: "Acme Inc",
        inviterName: "Alice",
        inviteToken: "token-123",
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("Acme Inc");
      expect(call.html).toContain("Alice");
      expect(call.html).toContain("token-123");
    });
  });

  describe("sendInviteAcceptedEmail", () => {
    it("sends accepted notification", async () => {
      await sendInviteAcceptedEmail({
        ownerEmail: "owner@test.com",
        memberName: "Bob",
        workspaceName: "Acme Inc",
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.to).toBe("owner@test.com");
      expect(call.subject).toContain("Bob");
      expect(call.subject).toContain("Acme Inc");
    });
  });

  describe("sendDigestEmail", () => {
    it("sends digest email with monitor data", async () => {
      await sendDigestEmail({
        to: "user@test.com",
        userName: "Dave",
        frequency: "daily",
        monitors: [
          {
            name: "Brand Monitor",
            resultsCount: 5,
            topResults: [
              {
                title: "Top Result",
                url: "https://example.com",
                platform: "reddit",
              },
            ],
          },
        ],
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("daily digest");
      expect(call.subject).toContain("5 new mentions");
      expect(call.html).toContain("Dave");
    });

    it("sums results across monitors", async () => {
      await sendDigestEmail({
        to: "user@test.com",
        userName: "Eve",
        frequency: "weekly",
        monitors: [
          { name: "M1", resultsCount: 3, topResults: [] },
          { name: "M2", resultsCount: 7, topResults: [] },
        ],
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("10 new mentions");
    });
  });

  describe("sendDeletionRequestedEmail", () => {
    it("sends deletion scheduled email", async () => {
      await sendDeletionRequestedEmail({
        email: "user@test.com",
        name: "Frank",
        deletionDate: new Date("2025-03-01"),
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("Account deletion scheduled");
      expect(call.html).toContain("Frank");
    });
  });

  describe("sendDeletionReminderEmail", () => {
    it("sends 24h reminder", async () => {
      await sendDeletionReminderEmail({ email: "user@test.com" });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("deleted tomorrow");
    });
  });

  describe("sendDeletionConfirmedEmail", () => {
    it("sends confirmed deletion email", async () => {
      await sendDeletionConfirmedEmail({ email: "user@test.com", name: "Grace" });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("has been deleted");
      expect(call.html).toContain("Grace");
    });
  });

  describe("sendReengagementEmail", () => {
    it("sends re-engagement email with stats", async () => {
      await sendReengagementEmail({
        email: "user@test.com",
        name: "Hank",
        daysSinceActive: 14,
        stats: {
          activeMonitors: 3,
          newMentions: 42,
        },
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("42 new mentions");
      expect(call.html).toContain("Hank");
      expect(call.html).toContain("14 days");
    });

    it("uses fallback subject when no new mentions", async () => {
      await sendReengagementEmail({
        email: "user@test.com",
        daysSinceActive: 7,
        stats: { activeMonitors: 1, newMentions: 0 },
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("Your monitors are waiting");
    });
  });

  describe("upsertContact", () => {
    it("is a no-op that logs", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await upsertContact({ email: "test@test.com" });
      expect(logSpy).toHaveBeenCalledWith("Contact upsert:", "test@test.com");
      logSpy.mockRestore();
    });
  });
});
