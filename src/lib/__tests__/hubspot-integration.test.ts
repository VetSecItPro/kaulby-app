import { describe, it, expect, vi, beforeEach } from "vitest";

describe("HubSpot Integration", () => {
  let hubspotModule: typeof import("../integrations/hubspot");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("HUBSPOT_CLIENT_ID", "hs-client-id");
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", "hs-client-secret");
    vi.stubEnv("HUBSPOT_REDIRECT_URI", "https://example.com/hubspot/callback");
    hubspotModule = await import("../integrations/hubspot");
  });

  describe("getAuthorizationUrl", () => {
    it("returns a valid HubSpot OAuth URL", () => {
      const url = hubspotModule.getAuthorizationUrl("my-state");
      expect(url).toContain("https://app.hubspot.com/oauth/authorize");
      expect(url).toContain("client_id=hs-client-id");
      expect(url).toContain("state=my-state");
    });

    it("throws when HUBSPOT_CLIENT_ID is missing", async () => {
      vi.resetModules();
      vi.stubEnv("HUBSPOT_CLIENT_ID", "");
      const mod = await import("../integrations/hubspot");
      expect(() => mod.getAuthorizationUrl("state")).toThrow(
        "HUBSPOT_CLIENT_ID not configured"
      );
    });
  });

  describe("isHubSpotConfigured", () => {
    it("returns true when credentials are set", () => {
      expect(hubspotModule.isHubSpotConfigured()).toBe(true);
    });

    it("returns false when missing", async () => {
      vi.resetModules();
      vi.stubEnv("HUBSPOT_CLIENT_ID", "");
      vi.stubEnv("HUBSPOT_CLIENT_SECRET", "");
      const mod = await import("../integrations/hubspot");
      expect(mod.isHubSpotConfigured()).toBe(false);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("returns tokens on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "hs-access",
              refresh_token: "hs-refresh",
              expires_in: 21600,
            }),
        })
      );

      const tokens = await hubspotModule.exchangeCodeForTokens("code123");
      expect(tokens.accessToken).toBe("hs-access");
      expect(tokens.refreshToken).toBe("hs-refresh");
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          text: () => Promise.resolve("Bad request"),
        })
      );

      await expect(
        hubspotModule.exchangeCodeForTokens("bad")
      ).rejects.toThrow("Failed to exchange code");
    });

    it("throws when credentials missing", async () => {
      vi.resetModules();
      vi.stubEnv("HUBSPOT_CLIENT_ID", "");
      vi.stubEnv("HUBSPOT_CLIENT_SECRET", "");
      const mod = await import("../integrations/hubspot");
      await expect(mod.exchangeCodeForTokens("code")).rejects.toThrow(
        "HubSpot credentials not configured"
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("returns new tokens on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 21600,
            }),
        })
      );

      const tokens = await hubspotModule.refreshAccessToken("old-refresh");
      expect(tokens.accessToken).toBe("new-access");
      expect(tokens.refreshToken).toBe("new-refresh");
    });

    it("throws on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          text: () => Promise.resolve("Token expired"),
        })
      );

      await expect(
        hubspotModule.refreshAccessToken("bad-token")
      ).rejects.toThrow("Failed to refresh token");
    });
  });

  describe("upsertContact", () => {
    it("creates a new contact when email search returns no results", async () => {
      const fetchMock = vi
        .fn()
        // First call: search
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        })
        // Second call: create
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-123" }),
        });

      vi.stubGlobal("fetch", fetchMock);

      const result = await hubspotModule.upsertContact("token", {
        email: "test@example.com",
        firstname: "Test",
      });

      expect(result.id).toBe("new-123");
      expect(result.isNew).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("updates existing contact when found by email", async () => {
      const fetchMock = vi
        .fn()
        // First call: search finds existing
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ results: [{ id: "existing-456" }] }),
        })
        // Second call: PATCH update
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      vi.stubGlobal("fetch", fetchMock);

      const result = await hubspotModule.upsertContact("token", {
        email: "test@example.com",
        firstname: "Updated",
      });

      expect(result.id).toBe("existing-456");
      expect(result.isNew).toBe(false);
    });

    it("creates contact directly when no email provided", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "no-email-789" }),
      });

      vi.stubGlobal("fetch", fetchMock);

      const result = await hubspotModule.upsertContact("token", {
        firstname: "NoEmail",
      });

      expect(result.id).toBe("no-email-789");
      expect(result.isNew).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws when contact creation fails", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve("Conflict"),
        });

      vi.stubGlobal("fetch", fetchMock);

      await expect(
        hubspotModule.upsertContact("token", { email: "test@test.com" })
      ).rejects.toThrow("Failed to create contact");
    });
  });

  describe("resultToHubSpotContact", () => {
    it("converts a result to HubSpot contact properties", () => {
      const contact = hubspotModule.resultToHubSpotContact({
        platform: "reddit",
        author: "John Doe",
        url: "https://reddit.com/r/test/123",
        title: "Test Post",
        content: "Some content here",
        sentiment: "positive",
        leadScore: 85,
        createdAt: new Date("2024-01-15"),
      });

      expect(contact.firstname).toBe("John");
      expect(contact.lastname).toBe("Doe");
      expect(contact.kaulby_source_platform).toBe("reddit");
      expect(contact.kaulby_source_url).toBe("https://reddit.com/r/test/123");
      expect(contact.kaulby_sentiment).toBe("positive");
      expect(contact.kaulby_lead_score).toBe(85);
      expect(contact.kaulby_notes).toBe("Some content here");
    });

    it("handles single-name authors", () => {
      const contact = hubspotModule.resultToHubSpotContact({
        platform: "hackernews",
        author: "pg",
        url: "https://news.ycombinator.com/item?id=123",
        createdAt: new Date(),
      });

      expect(contact.firstname).toBe("pg");
      expect(contact.lastname).toBeUndefined();
    });

    it("truncates long content to 500 chars", () => {
      const longContent = "x".repeat(600);
      const contact = hubspotModule.resultToHubSpotContact({
        platform: "reddit",
        author: "user",
        url: "https://example.com",
        content: longContent,
        createdAt: new Date(),
      });

      expect(contact.kaulby_notes?.length).toBe(500);
    });
  });

  describe("getAccountInfo", () => {
    it("returns account info on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              portalId: 12345,
              timeZone: "US/Eastern",
              currency: "USD",
            }),
        })
      );

      const info = await hubspotModule.getAccountInfo("token");
      expect(info.portalId).toBe(12345);
    });

    it("throws on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false })
      );

      await expect(hubspotModule.getAccountInfo("token")).rejects.toThrow(
        "Failed to get account info"
      );
    });
  });
});
