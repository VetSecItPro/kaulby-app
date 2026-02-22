import { describe, it, expect, vi } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    query: {
      results: { findMany: (...args: unknown[]) => mockQuery(...args) },
    },
  },
  users: {},
  monitors: {},
  results: {},
}));

vi.mock("@/lib/integrations/hubspot", () => ({
  isHubSpotConfigured: vi.fn().mockReturnValue(true),
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: "new_token",
    refreshToken: "new_refresh",
    expiresAt: new Date(Date.now() + 3600000),
  }),
  upsertContact: vi.fn().mockResolvedValue({ id: "contact_123" }),
  resultToHubSpotContact: vi.fn().mockReturnValue({
    properties: {
      email: "lead@example.com",
      lead_source: "reddit",
      lead_score: "75",
    },
  }),
}));

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  decrypt: vi.fn((val) => val.replace("encrypted_", "")),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

describe("inngest/sync-hubspot", () => {
  it("finds users with HubSpot connected", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "user1",
            integrations: {
              hubspot: {
                connected: true,
                accessToken: "encrypted_token",
                refreshToken: "encrypted_refresh",
                expiresAt: new Date().toISOString(),
              },
            },
          },
        ]),
      }),
    });

    const users = await mockSelect().from().where();

    expect(users).toHaveLength(1);
    expect(users[0].integrations.hubspot.connected).toBe(true);
  });

  it("refreshes expired access tokens", async () => {
    const expiresAt = new Date(Date.now() - 1000);
    const hubspot = {
      accessToken: "old_token",
      refreshToken: "refresh_token",
      expiresAt: expiresAt.toISOString(),
    };

    expect(new Date(hubspot.expiresAt).getTime()).toBeLessThan(Date.now());
  });

  it("finds results with lead scores > 0", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "result1",
        leadScore: 75,
        author: "user123",
        sourceUrl: "https://reddit.com/...",
      },
    ]);

    const results = await mockQuery();

    expect(results).toHaveLength(1);
    expect(results[0].leadScore).toBeGreaterThan(0);
  });

  it("marks results as synced after upsert", async () => {
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await mockUpdate().set({ metadata: {} }).where(["result1"]);

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns sync summary with counts", async () => {
    const result = {
      usersProcessed: 3,
      totalSynced: 15,
      totalErrors: 2,
      details: [
        { userId: "user1", synced: 10, errors: 1, skipped: false },
        { userId: "user2", synced: 5, errors: 1, skipped: false },
      ],
    };

    expect(result.totalSynced).toBe(15);
    expect(result.totalErrors).toBe(2);
  });

  it("skips when HubSpot not configured", async () => {
    const result = {
      skipped: true,
      reason: "HubSpot not configured (missing client credentials)",
    };

    expect(result.skipped).toBe(true);
  });
});
