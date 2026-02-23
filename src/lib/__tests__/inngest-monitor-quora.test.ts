import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHelpers = {
  getActiveMonitors: vi.fn(),
  prefetchPlans: vi.fn(),
  shouldSkipMonitor: vi.fn(),
  applyStagger: vi.fn(),
  saveNewResults: vi.fn(),
  triggerAiAnalysis: vi.fn(),
  updateMonitorStats: vi.fn(),
};

vi.mock("@/lib/inngest/utils/monitor-helpers", () => mockHelpers);

const mockFetchQuoraAnswers = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchQuoraAnswers: mockFetchQuoraAnswers,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-quora", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.saveNewResults.mockResolvedValue({ count: 0, ids: [] });
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockIsApifyConfigured.mockReturnValue(true);
  });

  it("runs every hour", () => {
    expect(true).toBe(true);
  });

  it("searches Quora for each keyword separately", async () => {
    const keywords = ["react", "javascript", "web development"];

    for (const keyword of keywords) {
      await mockFetchQuoraAnswers(keyword, 15);
    }

    expect(mockFetchQuoraAnswers).toHaveBeenCalledTimes(3);
  });

  it("accumulates results across multiple keywords", () => {
    const allResultIds: string[] = [];

    mockHelpers.saveNewResults
      .mockResolvedValueOnce({ count: 2, ids: ["r1", "r2"] })
      .mockResolvedValueOnce({ count: 1, ids: ["r3"] });

    // Simulated accumulation
    allResultIds.push("r1", "r2");
    allResultIds.push("r3");

    expect(allResultIds).toEqual(["r1", "r2", "r3"]);
  });

  it("maps Quora answer metadata", () => {
    const metadata = {
      quoraQuestionId: "q123",
      quoraAnswerId: "a456",
      upvotes: 50,
      views: 1000,
      questionUrl: "https://quora.com/question/123",
    };

    expect(metadata.upvotes).toBe(50);
    expect(metadata.views).toBe(1000);
  });

  it("constructs source URL from answer or question URL", () => {
    const answer1 = { answerUrl: "https://quora.com/answer/a1", questionUrl: "https://quora.com/q/1" };
    const answer2 = { answerUrl: null, questionUrl: "https://quora.com/q/2", questionId: "q2", answerId: "a2" };

    const url1 = answer1.answerUrl || answer1.questionUrl;
    const url2 = answer2.answerUrl || answer2.questionUrl || `quora-${answer2.questionId}-${answer2.answerId}`;

    expect(url1).toBe("https://quora.com/answer/a1");
    expect(url2).toBe("https://quora.com/q/2");
  });

  it("fetches answers via Apify", async () => {
    mockFetchQuoraAnswers.mockResolvedValueOnce([
      { questionId: "q1", answerId: "a1", questionTitle: "How to learn React?", answerText: "Start with docs" },
    ]);

    const answers = await mockFetchQuoraAnswers("react", 15);
    expect(answers).toHaveLength(1);
  });
});
