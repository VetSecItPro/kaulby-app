import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isMonitorScheduleActive, WEEKDAYS, COMMON_TIMEZONES } from "../monitor-schedule";

describe("monitor-schedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isMonitorScheduleActive", () => {
    it("returns true when scheduling is not enabled", () => {
      const result = isMonitorScheduleActive({
        scheduleEnabled: false,
        scheduleStartHour: null,
        scheduleEndHour: null,
        scheduleDays: null,
        scheduleTimezone: null,
      });
      expect(result).toBe(true);
    });

    it("returns true during active hours (9-17 default)", () => {
      // Set time to a Wednesday at 12:00 noon UTC
      // Use a timezone where noon UTC maps to business hours
      vi.setSystemTime(new Date("2025-06-11T16:00:00Z")); // Wed 12:00 Eastern

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: null, // all days
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });

    it("returns false outside active hours", () => {
      // Set time to 3:00 AM Eastern (7:00 UTC)
      vi.setSystemTime(new Date("2025-06-11T07:00:00Z")); // Wed 3:00 AM Eastern

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(false);
    });

    it("returns false on inactive days", () => {
      // Set to Sunday at noon Eastern
      vi.setSystemTime(new Date("2025-06-15T16:00:00Z")); // Sunday 12:00 Eastern

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: WEEKDAYS, // Mon-Fri only
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(false);
    });

    it("handles overnight schedules (e.g., 22:00 to 06:00)", () => {
      // Set to 23:00 Eastern
      vi.setSystemTime(new Date("2025-06-11T03:00:00Z")); // Wed 23:00 Eastern

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 22,
        scheduleEndHour: 6,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });

    it("handles overnight schedule - early morning within range", () => {
      // Set to 3:00 AM Eastern
      vi.setSystemTime(new Date("2025-06-12T07:00:00Z")); // Thu 3:00 AM Eastern

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 22,
        scheduleEndHour: 6,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });

    it("handles overnight schedule - midday outside range", () => {
      // Set to 12:00 noon Eastern
      vi.setSystemTime(new Date("2025-06-11T16:00:00Z"));

      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 22,
        scheduleEndHour: 6,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(false);
    });

    it("defaults to America/New_York when timezone is null", () => {
      // We verify this runs without error (would throw for invalid tz)
      vi.setSystemTime(new Date("2025-06-11T16:00:00Z"));
      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: null,
        scheduleTimezone: null,
      });
      // At 12:00 Eastern, should be active with 9-17 window
      expect(result).toBe(true);
    });

    it("defaults to 9-17 when hours are null", () => {
      vi.setSystemTime(new Date("2025-06-11T16:00:00Z")); // 12:00 Eastern
      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: null,
        scheduleEndHour: null,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });

    it("allows all days when scheduleDays is null", () => {
      // Saturday at noon Eastern
      vi.setSystemTime(new Date("2025-06-14T16:00:00Z"));
      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: null,
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });

    it("allows all days when scheduleDays is empty array", () => {
      vi.setSystemTime(new Date("2025-06-14T16:00:00Z")); // Saturday
      const result = isMonitorScheduleActive({
        scheduleEnabled: true,
        scheduleStartHour: 9,
        scheduleEndHour: 17,
        scheduleDays: [],
        scheduleTimezone: "America/New_York",
      });
      expect(result).toBe(true);
    });
  });

  describe("WEEKDAYS constant", () => {
    it("contains Monday through Friday (1-5)", () => {
      expect(WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("COMMON_TIMEZONES", () => {
    it("contains expected timezone entries", () => {
      const values = COMMON_TIMEZONES.map((tz) => tz.value);
      expect(values).toContain("America/New_York");
      expect(values).toContain("America/Los_Angeles");
      expect(values).toContain("Europe/London");
      expect(values).toContain("Asia/Tokyo");
    });

    it("each entry has value and label", () => {
      for (const tz of COMMON_TIMEZONES) {
        expect(tz.value).toBeTruthy();
        expect(tz.label).toBeTruthy();
      }
    });
  });
});
