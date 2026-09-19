import { describe, expect, it } from "vitest";
import { businessToday, nextOccurrences, occurrencesThrough } from "./recurrence";

describe("occurrencesThrough: one_time", () => {
  it("produces exactly one occurrence on the start date", () => {
    expect(occurrencesThrough({ startDate: "2026-06-10", recurrence: "one_time" }, "2026-12-31")).toEqual([
      "2026-06-10",
    ]);
  });

  it("produces nothing if the window ends before the start date", () => {
    expect(occurrencesThrough({ startDate: "2026-06-10", recurrence: "one_time" }, "2026-06-09")).toEqual([]);
  });
});

describe("occurrencesThrough: weekly / biweekly", () => {
  it("steps every 7 days from the start date (weekday anchor)", () => {
    expect(
      occurrencesThrough({ startDate: "2026-01-05", recurrence: "weekly" }, "2026-02-02"),
    ).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02"]);
  });

  it("steps every 14 days from the start date", () => {
    expect(
      occurrencesThrough({ startDate: "2026-01-05", recurrence: "biweekly" }, "2026-03-02"),
    ).toEqual(["2026-01-05", "2026-01-19", "2026-02-02", "2026-02-16", "2026-03-02"]);
  });
});

describe("occurrencesThrough: monthly (clamp then return, not every-4-weeks)", () => {
  it("clamps Jan 31 to the last day of short months and returns to day 31 once possible", () => {
    // This is the canonical month-end case from docs/MVP.md.
    expect(
      occurrencesThrough({ startDate: "2026-01-31", recurrence: "monthly" }, "2026-05-31"),
    ).toEqual([
      "2026-01-31",
      "2026-02-28", // clamped: Feb 2026 has 28 days
      "2026-03-31", // returns to 31 once March allows it
      "2026-04-30", // clamped again: April has 30 days
      "2026-05-31", // returns to 31 again
    ]);
  });

  it("handles a leap-year February correctly", () => {
    // 2028 is a leap year.
    expect(
      occurrencesThrough({ startDate: "2028-01-31", recurrence: "monthly" }, "2028-02-29"),
    ).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("is not simply every 28 days -- month length varies, day-of-month does not drift", () => {
    const occurrences = occurrencesThrough(
      { startDate: "2026-03-15", recurrence: "monthly" },
      "2026-07-15",
    );
    expect(occurrences).toEqual([
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
      "2026-07-15",
    ]);
  });
});

describe("nextOccurrences", () => {
  it("returns the next N occurrences on/after a given date", () => {
    expect(nextOccurrences({ startDate: "2026-01-05", recurrence: "weekly" }, "2026-01-20", 3)).toEqual([
      "2026-01-26",
      "2026-02-02",
      "2026-02-09",
    ]);
  });
});

describe("businessToday", () => {
  it("resolves the calendar date in the given IANA timezone, not UTC", () => {
    // 2026-06-15 04:30 UTC is still 2026-06-14 23:30 in America/Chicago (UTC-5 in June, CDT).
    const instant = new Date("2026-06-15T04:30:00Z");
    expect(businessToday("America/Chicago", instant)).toBe("2026-06-14");
    expect(businessToday("UTC", instant)).toBe("2026-06-15");
  });

  it("rolls over to the next day once local time passes midnight", () => {
    // 2026-06-15 06:30 UTC is 2026-06-15 01:30 in America/Chicago.
    const instant = new Date("2026-06-15T06:30:00Z");
    expect(businessToday("America/Chicago", instant)).toBe("2026-06-15");
  });
});
