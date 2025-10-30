import { describe, it, expect } from "bun:test";
import { timeDeltaInHoursAndMinutes } from "@/tui/lib/utils";

describe("timeDeltaInHoursAndMinutes", () => {
  it("should return 0 hours and 0 minutes for time deltas under 1 minute", () => {
    const now = Date.now();
    const startTime = now - 30 * 1000; // 30 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 0,
    });
  });

  it("should return 0 hours and 0 minutes for time deltas of exactly 59 seconds", () => {
    const now = Date.now();
    const startTime = now - 59 * 1000; // 59 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 0,
    });
  });

  it("should return 0 hours and minutes for time deltas between 1 minute and 1 hour", () => {
    const now = Date.now();
    const startTime = now - 5 * 60 * 1000; // 5 minutes ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 5,
    });
  });

  it("should return 0 hours and 1 minute for time deltas of exactly 1 minute", () => {
    const now = Date.now();
    const startTime = now - 1 * 60 * 1000; // 1 minute ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 1,
    });
  });

  it("should return 0 hours and 59 minutes for time deltas close to 1 hour", () => {
    const now = Date.now();
    const startTime = now - 59 * 60 * 1000; // 59 minutes ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 59,
    });
  });

  it("should return hours and 0 minutes for time deltas over 1 hour with no remainder", () => {
    const now = Date.now();
    const startTime = now - 2 * 60 * 60 * 1000; // 2 hours ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 2,
      minutes: 0,
    });
  });

  it("should return 1 hour and 0 minutes for time deltas of exactly 1 hour", () => {
    const now = Date.now();
    const startTime = now - 1 * 60 * 60 * 1000; // 1 hour ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 1,
      minutes: 0,
    });
  });

  it("should return hours and minutes for complex time deltas", () => {
    const now = Date.now();
    const startTime = now - (3 * 60 * 60 * 1000 + 45 * 60 * 1000); // 3 hours 45 minutes ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 3,
      minutes: 45,
    });
  });

  it("should return 24 hours and 0 minutes for large time deltas", () => {
    const now = Date.now();
    const startTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 24,
      minutes: 0,
    });
  });

  it("should return 0 hours and 0 minutes for startTime equal to now", () => {
    const now = Date.now();
    expect(timeDeltaInHoursAndMinutes(now)).toEqual({ hours: 0, minutes: 0 });
  });

  it("should round minutes correctly when close to next minute threshold", () => {
    const now = Date.now();
    const startTime = now - (10 * 60 * 1000 + 30 * 1000); // 10 minutes 30 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 11,
    });
  });

  it("should correctly calculate hours and minutes when minutes component rounds up", () => {
    const now = Date.now();
    const startTime = now - (1 * 60 * 60 * 1000 + 30 * 60 * 1000); // 1 hour 30 minutes ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 1,
      minutes: 30,
    });
  });

  it("should use floor for hours and round for minutes", () => {
    const now = Date.now();
    const startTime = now - (2 * 60 * 60 * 1000 + 45 * 60 * 1000 + 40 * 1000); // 2 hours 45 minutes 40 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 2,
      minutes: 46, // 45.67 minutes rounds to 46
    });
  });

  it("should handle edge case where rounding minutes gives 60", () => {
    const now = Date.now();
    const startTime = now - (5 * 60 * 60 * 1000 + 59 * 60 * 1000 + 50 * 1000); // 5 hours 59 minutes 50 seconds ago
    // 59.83 minutes rounds to 60, which should be handled by returning 0 minutes
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 5,
      minutes: 0,
    });
  });

  it("should round 30 seconds up to next minute in minutes-only range", () => {
    const now = Date.now();
    const startTime = now - (5 * 60 * 1000 + 30 * 1000); // 5 minutes 30 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 6,
    });
  });

  it("should handle very small time deltas (less than 30 seconds rounds down)", () => {
    const now = Date.now();
    const startTime = now - 15 * 1000; // 15 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 0,
      minutes: 0,
    });
  });

  it("should correctly calculate multiple hours with fractional minutes", () => {
    const now = Date.now();
    const startTime = now - (10 * 60 * 60 * 1000 + 25 * 60 * 1000 + 45 * 1000); // 10 hours 25 minutes 45 seconds ago
    expect(timeDeltaInHoursAndMinutes(startTime)).toEqual({
      hours: 10,
      minutes: 26, // 25.75 minutes rounds to 26
    });
  });
});
