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
  sanitizeForLog: (s: string) => s || "",
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
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionRevokedEmail,
  sendRefundEmail,
  sendDayPassReceiptEmail,
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
    it("is a no-op that completes without error", async () => {
      await expect(upsertContact({ email: "test@test.com" })).resolves.toBeUndefined();
    });
  });

  // ─── Lifecycle emails added in PR #302 (Domains A-H sandbox e2e) ───

  describe("sendSubscriptionUpgradedEmail", () => {
    it("subject names the new (higher) plan", async () => {
      await sendSubscriptionUpgradedEmail({
        email: "user@test.com",
        name: "Ivy",
        fromPlan: "Solo",
        toPlan: "Growth",
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.to).toBe("user@test.com");
      expect(call.subject).toBe("Your Kaulby plan was upgraded to Growth");
      expect(call.html).toContain("Ivy");
      expect(call.html).toContain("Solo");
      expect(call.html).toContain("Growth");
    });

    it("falls back to 'there' when name is omitted", async () => {
      await sendSubscriptionUpgradedEmail({
        email: "user@test.com",
        fromPlan: "Solo",
        toPlan: "Scale",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("there");
    });
  });

  describe("sendSubscriptionDowngradedEmail", () => {
    it("subject says 'changed' (not 'downgraded') and names target plan", async () => {
      // Subject phrasing matters: customer-facing copy avoids the word 'downgraded'
      // because the change is voluntary and applies at next billing period.
      await sendSubscriptionDowngradedEmail({
        email: "user@test.com",
        name: "Jules",
        fromPlan: "Growth",
        toPlan: "Scale",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby plan was changed to Scale");
      expect(call.subject).not.toMatch(/downgrade/i);
      expect(call.html).toContain("Jules");
      expect(call.html).toContain("Growth");
      expect(call.html).toContain("Scale");
    });
  });

  describe("sendSubscriptionCanceledEmail", () => {
    it("formats periodEnd as a long-form date when provided", async () => {
      await sendSubscriptionCanceledEmail({
        email: "user@test.com",
        name: "Kai",
        plan: "Scale",
        periodEnd: new Date("2026-06-15T00:00:00Z"),
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby cancellation is confirmed");
      // Date format expected: "June 15, 2026" or similar locale variant
      expect(call.html).toMatch(/(June|Jun)\s*1[45]/);
      expect(call.html).toContain("Kai");
      expect(call.html).toContain("Scale");
    });

    it("falls back to a generic phrase when periodEnd is omitted", async () => {
      await sendSubscriptionCanceledEmail({
        email: "user@test.com",
        plan: "Solo",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("end of your billing period");
    });
  });

  describe("sendSubscriptionRevokedEmail", () => {
    it("subject signals access lost", async () => {
      await sendSubscriptionRevokedEmail({
        email: "user@test.com",
        name: "Lior",
        plan: "Growth",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby subscription has ended");
      expect(call.html).toContain("Lior");
      expect(call.html).toContain("Growth");
    });
  });

  describe("sendRefundEmail", () => {
    it("subject confirms refund processed", async () => {
      await sendRefundEmail({
        email: "user@test.com",
        name: "Maya",
        plan: "Scale",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby refund has been processed");
      expect(call.html).toContain("Maya");
      expect(call.html).toContain("Scale");
    });
  });

  describe("sendDayPassReceiptEmail", () => {
    it("formats expiresAt with date AND time (24-hour pass needs hour visibility)", async () => {
      await sendDayPassReceiptEmail({
        email: "user@test.com",
        name: "Niko",
        // Pick a UTC time that should render with hour info regardless of locale
        expiresAt: new Date("2026-06-15T18:30:00Z"),
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby Day Pass is active");
      expect(call.html).toContain("Niko");
      // Body must include some time component (hours), not just a date.
      // toLocaleString with hour:'numeric' includes a digit followed by ":" or AM/PM.
      expect(call.html).toMatch(/\d{1,2}:\d{2}|\d{1,2}\s?(AM|PM|am|pm)/);
    });

    it("accepts ISO string for expiresAt", async () => {
      await sendDayPassReceiptEmail({
        email: "user@test.com",
        expiresAt: "2026-06-15T18:30:00Z",
      });
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toBe("Your Kaulby Day Pass is active");
    });
  });
});
