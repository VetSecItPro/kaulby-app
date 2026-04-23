import { describe, it, expect } from "vitest";
import { runQualityProbes, PERSONA_PROBES, ROBOTIC_ANTIPATTERNS, BANNED_OPENERS } from "../quality-probes";

describe("quality-probes", () => {
  describe("runQualityProbes", () => {
    it("returns zero metrics on empty input", () => {
      const m = runQualityProbes([]);
      expect(m.total).toBe(0);
      expect(m.persona).toBe(0);
      expect(m.personaRate).toBe(0);
      expect(m.avgLength).toBe(0);
    });

    it("detects persona voice via first-person recommendation", () => {
      const m = runQualityProbes([
        "I recommend the team review this complaint immediately.",
      ]);
      expect(m.persona).toBe(1);
      expect(m.personaRate).toBe(1);
      expect(m.robotic).toBe(0);
    });

    it("detects robotic antipattern with Sentiment: prefix", () => {
      const m = runQualityProbes([
        "Sentiment: negative\nTopic: billing\nSummary: ",
      ]);
      expect(m.robotic).toBe(1);
      expect(m.persona).toBe(0);
    });

    it("detects banned openers independently of persona", () => {
      // "This is an..." is banned but the rest can still read as analyst voice
      const m = runQualityProbes([
        "This is an internal GitHub issue. I recommend logging it for awareness.",
      ]);
      expect(m.bannedOpener).toBe(1);
      expect(m.persona).toBe(1); // dimensions are independent
    });

    it("computes rates correctly across mixed batch", () => {
      const m = runQualityProbes([
        "I recommend we monitor this thread.",          // persona
        "I recommend our team engage soon.",            // persona
        "Sentiment: positive\nTopic: feature",          // robotic
        "The author discusses their upcoming release.", // generic (no persona, no robotic)
      ]);
      expect(m.total).toBe(4);
      expect(m.persona).toBe(2);
      expect(m.robotic).toBe(1);
      expect(m.generic).toBe(1); // 4 - 2 persona - 1 robotic
      expect(m.personaRate).toBe(0.5);
      expect(m.roboticRate).toBe(0.25);
      expect(m.genericRate).toBe(0.25);
    });

    it("avg length reflects character count, not word count", () => {
      const m = runQualityProbes(["abc", "hello world"]);
      // (3 + 11) / 2 = 7
      expect(m.avgLength).toBe(7);
    });

    it("case-insensitive probe matching", () => {
      const m = runQualityProbes(["I RECOMMEND immediate action."]);
      expect(m.persona).toBe(1);
    });
  });

  describe("PERSONA_PROBES coverage", () => {
    it("matches the analyst-voice phrases observed in production summaries", () => {
      // Sanity check: phrases from the 2026-04-23 production audit that drove
      // the 76% persona rate. Guards against someone tightening these probes
      // accidentally and breaking the baseline.
      const observed = [
        "I recommend our support team engage",
        "The product team should review their technical approach",
        "I recommend monitoring the discussion",
        "needs immediate escalation",
        "no action is required",
      ];
      for (const s of observed) {
        const anyHit = PERSONA_PROBES.some((p) => p.test(s));
        expect(anyHit, `phrase "${s}" should match at least one persona probe`).toBe(true);
      }
    });
  });

  describe("BANNED_OPENERS", () => {
    it("matches the prompt's forbidden preambles", () => {
      // Direct phrasings of the banned openers called out in SYSTEM_PROMPTS.summarize
      const banned = [
        "This is an internal discussion about scaling.",
        "This was a negative review from last week.",
        "The post references our competitor.",
        "The user complains about pricing.",
        "A user on Hacker News mentioned us.",
      ];
      for (const s of banned) {
        const anyHit = BANNED_OPENERS.some((p) => p.test(s));
        expect(anyHit, `phrase "${s}" should match at least one banned opener`).toBe(true);
      }
    });

    it("does not fire on analyst-voice sentences that begin with 'I' or a verb", () => {
      const clean = [
        "I recommend the team review this complaint.",
        "Worth noting: three users mentioned this in a week.",
        "Two users on Reddit raised concerns about pricing.",
      ];
      for (const s of clean) {
        const anyHit = BANNED_OPENERS.some((p) => p.test(s));
        expect(anyHit, `clean phrase "${s}" should NOT match banned openers`).toBe(false);
      }
    });
  });

  describe("ROBOTIC_ANTIPATTERNS", () => {
    it("matches the structured-output fallback formats that the prompt forbids", () => {
      const robotic = [
        "Sentiment: positive",
        "Topic: billing",
        "Category: complaint",
        "    Summary:    ", // whitespace-surrounded empty Summary: line
      ];
      for (const s of robotic) {
        const anyHit = ROBOTIC_ANTIPATTERNS.some((p) => p.test(s));
        expect(anyHit, `phrase "${s}" should match a robotic antipattern`).toBe(true);
      }
    });
  });
});
