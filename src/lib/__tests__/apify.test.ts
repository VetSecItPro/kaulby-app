import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchGoogleReviews,
  fetchTrustpilotReviews,
  fetchAppStoreReviews,
  fetchPlayStoreReviews,
  fetchQuoraAnswers,
  fetchYouTubeComments,
  fetchG2Reviews,
  fetchYelpReviews,
  fetchAmazonReviews,
  isApifyConfigured,
} from "../apify";

const MOCK_API_KEY = "test_apify_key_123";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as never;

describe("apify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APIFY_API_KEY", MOCK_API_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isApifyConfigured", () => {
    it("returns true when API key is set", () => {
      expect(isApifyConfigured()).toBe(true);
    });

    it("returns false when API key is not set", () => {
      vi.stubEnv("APIFY_API_KEY", "");
      expect(isApifyConfigured()).toBe(false);
    });
  });

  describe("fetchGoogleReviews", () => {
    it("fetches reviews with Place ID", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                reviewId: "review_1",
                name: "John Doe",
                text: "Great place!",
                publishedAtDate: "2025-01-01",
                stars: 5,
                reviewUrl: "https://maps.google.com/review/1",
              },
            ]),
        });

      const reviews = await fetchGoogleReviews("ChIJVVVVVVXlUVMRu-GPNDD5qKw", 50);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].reviewId).toBe("review_1");
      expect(reviews[0].stars).toBe(5);
    });

    it("fetches reviews with Google Maps URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const url = "https://www.google.com/maps/place/Business+Name/@lat,lng";
      await fetchGoogleReviews(url, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("compass~google-maps-reviews-scraper"),
        expect.any(Object)
      );
    });

    it("throws error when actor start fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("API key invalid"),
      });

      await expect(
        fetchGoogleReviews("ChIJtest", 50)
      ).rejects.toThrow("Failed to start Apify actor");
    });

    it("throws error when actor run fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "FAILED",
                defaultDatasetId: "dataset_123",
              },
            }),
        });

      await expect(
        fetchGoogleReviews("ChIJtest", 50)
      ).rejects.toThrow("Actor run FAILED");
    });
  });

  describe("fetchTrustpilotReviews", () => {
    it("fetches reviews with full URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "review_1",
                title: "Great service",
                text: "Very satisfied",
                rating: 5,
                date: "2025-01-01",
                author: "Jane Doe",
                url: "https://trustpilot.com/review/1",
              },
            ]),
        });

      const reviews = await fetchTrustpilotReviews(
        "https://www.trustpilot.com/review/example.com",
        50
      );

      expect(reviews).toHaveLength(1);
      expect(reviews[0].rating).toBe(5);
    });

    it("adds https:// prefix if missing", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchTrustpilotReviews("example.com", 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.startUrls[0].url).toContain("https://www.trustpilot.com/review/");
    });
  });

  describe("fetchAppStoreReviews", () => {
    it("fetches reviews with full App Store URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "review_1",
                title: "Great app",
                text: "Love it",
                rating: 5,
                date: "2025-01-01",
                userName: "User123",
              },
            ]),
        });

      const url = "https://apps.apple.com/us/app/test-app/id123456789";
      const reviews = await fetchAppStoreReviews(url, 50);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].rating).toBe(5);
    });

    it("fetches reviews with app ID", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchAppStoreReviews("id123456789", 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.appIds).toContain("123456789");
    });

    it("handles app ID without id prefix", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchAppStoreReviews("123456789", 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.appIds).toContain("123456789");
    });
  });

  describe("fetchPlayStoreReviews", () => {
    it("fetches reviews with package ID", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                reviewId: "review_1",
                userName: "User123",
                text: "Great app",
                score: 5,
                date: "2025-01-01",
              },
            ]),
        });

      const reviews = await fetchPlayStoreReviews("com.example.app", 50);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].score).toBe(5);
    });
  });

  describe("fetchQuoraAnswers", () => {
    it("fetches answers without session cookie", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                questionId: "q_1",
                questionTitle: "How to test?",
                questionUrl: "https://quora.com/q/1",
                answerText: "Here's how...",
                answerAuthor: "Expert",
                answerDate: "2025-01-01",
              },
            ]),
        });

      const answers = await fetchQuoraAnswers("how to test", 30);

      expect(answers).toHaveLength(1);
      expect(answers[0].questionTitle).toBe("How to test?");
    });

    it("includes session cookie when provided", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchQuoraAnswers("test query", 30, "session_cookie_value");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.sessionCookie).toBe("session_cookie_value");
    });
  });

  describe("fetchYouTubeComments", () => {
    it("fetches comments from video URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                commentId: "comment_1",
                text: "Great video!",
                author: "Viewer",
                publishedAt: "2025-01-01",
                likeCount: 10,
                videoId: "abc123",
              },
            ]),
        });

      const comments = await fetchYouTubeComments(
        "https://www.youtube.com/watch?v=abc123",
        100
      );

      expect(comments).toHaveLength(1);
      expect(comments[0].likeCount).toBe(10);
    });

    it("extracts video ID from youtu.be URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchYouTubeComments("https://youtu.be/xyz789", 100);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.startUrls[0].url).toContain("v=xyz789");
    });
  });

  describe("fetchG2Reviews", () => {
    it("adds /reviews suffix if missing", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchG2Reviews("https://www.g2.com/products/slack", 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.startUrls[0].url).toContain("/reviews");
    });
  });

  describe("fetchYelpReviews", () => {
    it("fetches reviews from business URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                reviewId: "review_1",
                text: "Great food!",
                rating: 5,
                date: "2025-01-01",
                author: "Foodie",
              },
            ]),
        });

      const reviews = await fetchYelpReviews(
        "https://www.yelp.com/biz/restaurant-name-city",
        50
      );

      expect(reviews).toHaveLength(1);
      expect(reviews[0].rating).toBe(5);
    });
  });

  describe("fetchAmazonReviews", () => {
    it("extracts ASIN from Amazon URL", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchAmazonReviews(
        "https://www.amazon.com/dp/B08N5WRWNW",
        50
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.productUrls[0]).toContain("B08N5WRWNW");
    });

    it("handles ASIN directly", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "SUCCEEDED",
                defaultDatasetId: "dataset_123",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      await fetchAmazonReviews("B08N5WRWNW", 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.productUrls[0]).toContain("B08N5WRWNW");
    });
  });

  describe("error handling", () => {
    it("throws when APIFY_API_KEY is not set", async () => {
      vi.stubEnv("APIFY_API_KEY", "");

      await expect(
        fetchGoogleReviews("ChIJtest", 50)
      ).rejects.toThrow("APIFY_API_KEY is not configured");
    });

    it("throws when actor run times out", async () => {
      // Mock start call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: "run_123",
              status: "RUNNING",
              defaultDatasetId: "dataset_123",
            },
          }),
      });

      // Mock all subsequent status polling calls to return RUNNING
      // The timeout is 120000ms, and polling happens every 2000ms
      // So we need ~60 RUNNING responses to trigger timeout
      for (let i = 0; i < 65; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "run_123",
                status: "RUNNING",
                defaultDatasetId: "dataset_123",
              },
            }),
        });
      }

      // This will timeout after polling many times
      await expect(
        fetchGoogleReviews("ChIJtest", 50)
      ).rejects.toThrow("Actor run timed out");
    }, 130000); // Increase timeout for this test to allow it to actually timeout
  });
});
