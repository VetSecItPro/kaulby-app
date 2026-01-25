/**
 * Monitor Scheduling Utilities
 *
 * Allows users to set active hours for their monitors (e.g., only scan 9am-5pm weekdays)
 */

interface MonitorSchedule {
  scheduleEnabled: boolean;
  scheduleStartHour: number | null;
  scheduleEndHour: number | null;
  scheduleDays: number[] | null;
  scheduleTimezone: string | null;
}

/**
 * Check if a monitor should be active based on its schedule
 * Returns true if:
 * - Schedule is not enabled (always active)
 * - Current time is within the scheduled active hours and days
 */
export function isMonitorScheduleActive(monitor: MonitorSchedule): boolean {
  // If scheduling is not enabled, monitor is always active
  if (!monitor.scheduleEnabled) {
    return true;
  }

  const timezone = monitor.scheduleTimezone || "America/New_York";
  const startHour = monitor.scheduleStartHour ?? 9;
  const endHour = monitor.scheduleEndHour ?? 17;
  const activeDays = monitor.scheduleDays; // null means all days

  // Get current time in the monitor's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });

  const currentHour = parseInt(formatter.format(now), 10);
  const currentDayName = dayFormatter.format(now);

  // Map day name to number (0=Sun, 1=Mon, etc.)
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDay = dayMap[currentDayName];

  // Check if current day is active
  if (activeDays !== null && activeDays.length > 0) {
    if (!activeDays.includes(currentDay)) {
      return false;
    }
  }

  // Check if current hour is within active hours
  // Handle overnight schedules (e.g., 22:00 to 06:00)
  if (startHour <= endHour) {
    // Normal schedule (e.g., 9:00 to 17:00)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Overnight schedule (e.g., 22:00 to 06:00)
    return currentHour >= startHour || currentHour < endHour;
  }
}

/**
 * Get a human-readable description of a monitor's schedule
 */
export function getScheduleDescription(monitor: MonitorSchedule): string {
  if (!monitor.scheduleEnabled) {
    return "Always active";
  }

  const startHour = monitor.scheduleStartHour ?? 9;
  const endHour = monitor.scheduleEndHour ?? 17;
  const activeDays = monitor.scheduleDays;
  const timezone = monitor.scheduleTimezone || "America/New_York";

  // Format hours
  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const timeRange = `${formatHour(startHour)} - ${formatHour(endHour)}`;

  // Format days
  let daysStr = "every day";
  if (activeDays !== null && activeDays.length > 0 && activeDays.length < 7) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const selectedDays = activeDays.map((d) => dayNames[d]).join(", ");

    // Check for common patterns
    const weekdays = [1, 2, 3, 4, 5];
    const weekends = [0, 6];

    if (
      activeDays.length === 5 &&
      weekdays.every((d) => activeDays.includes(d))
    ) {
      daysStr = "weekdays";
    } else if (
      activeDays.length === 2 &&
      weekends.every((d) => activeDays.includes(d))
    ) {
      daysStr = "weekends";
    } else {
      daysStr = selectedDays;
    }
  }

  // Format timezone (show short name)
  const tzShort = timezone.split("/").pop()?.replace(/_/g, " ") || timezone;

  return `${timeRange} ${daysStr} (${tzShort})`;
}

/**
 * Default weekdays (Monday-Friday)
 */
export const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * All days of the week
 */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Common timezone options for UI
 */
export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];
