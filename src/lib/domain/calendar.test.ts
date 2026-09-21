import { describe, expect, it } from "vitest";
import {
  filterCalendarJobs,
  addDaysIso,
  addMonthsIso,
  compareIso,
  isSameMonth,
  monthGridDates,
  startOfWeek,
  weekDates,
  weekdayOf,
} from "./calendar";

describe("weekdayOf", () => {
  it("returns 0 for Sunday and 6 for Saturday", () => {
    expect(weekdayOf("2026-09-20")).toBe(0); // a Sunday
    expect(weekdayOf("2026-09-26")).toBe(6); // a Saturday
  });
});

describe("startOfWeek / weekDates", () => {
  it("finds the Sunday on/before a mid-week date", () => {
    expect(startOfWeek("2026-09-23")).toBe("2026-09-20");
  });

  it("returns exactly 7 consecutive dates starting on Sunday", () => {
    const dates = weekDates("2026-09-23");
    expect(dates).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
    ]);
  });
});

describe("monthGridDates", () => {
  it("produces a 42-day grid covering the full month plus leading/trailing days", () => {
    const grid = monthGridDates("2026-09-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-08-30"); // Sept 1, 2026 is a Tuesday -> grid starts the Sunday before
    expect(grid).toContain("2026-09-01");
    expect(grid).toContain("2026-09-30");
  });

  it("every month's grid starts on a Sunday", () => {
    for (const month of ["2026-01-01", "2026-02-15", "2026-12-31"]) {
      expect(weekdayOf(monthGridDates(month)[0]!)).toBe(0);
    }
  });
});

describe("isSameMonth", () => {
  it("matches same year/month regardless of day", () => {
    expect(isSameMonth("2026-09-05", "2026-09-28")).toBe(true);
    expect(isSameMonth("2026-08-31", "2026-09-01")).toBe(false);
  });
});

describe("addMonthsIso", () => {
  it("clamps to the last valid day when the target month is shorter", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("moves backward across a year boundary", () => {
    expect(addMonthsIso("2026-01-15", -1)).toBe("2025-12-15");
  });
});

describe("addDaysIso / compareIso", () => {
  it("adds and subtracts days correctly across month boundaries", () => {
    expect(addDaysIso("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysIso("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("compares dates lexicographically", () => {
    expect(compareIso("2026-09-01", "2026-09-02")).toBeLessThan(0);
    expect(compareIso("2026-09-02", "2026-09-01")).toBeGreaterThan(0);
    expect(compareIso("2026-09-01", "2026-09-01")).toBe(0);
  });
});

describe("filterCalendarJobs", () => {
  const jobs = [
    { id: "a", status: "scheduled" },
    { id: "b", status: "cancelled" },
    { id: "c", status: "completed" },
    { id: "d", status: "rescheduled" },
  ];

  it("hides cancelled visits by default", () => {
    expect(filterCalendarJobs(jobs, false).map((j) => j.id)).toEqual(["a", "c", "d"]);
  });

  it("shows everything when asked", () => {
    expect(filterCalendarJobs(jobs, true)).toHaveLength(4);
  });
});
