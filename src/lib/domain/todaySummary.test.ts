import { describe, expect, it } from "vitest";
import { joinNames, summarizeDay } from "./todaySummary";

describe("summarizeDay", () => {
  it("splits today's dollars into completed, working, moved and to do", () => {
    const summary = summarizeDay(
      [
        { status: "completed", priceCents: 6500 },
        { status: "in_progress", priceCents: 6500 },
        { status: "scheduled", priceCents: 12000 },
        { status: "rescheduled", priceCents: 5000 },
      ],
      8000,
    );
    expect(summary).toEqual({
      scheduledCents: 38000,
      completedCents: 6500,
      workingCents: 6500,
      movedCents: 8000,
      todoCents: 17000,
    });
  });

  it("never counts moved-off jobs as completed or to do", () => {
    const summary = summarizeDay([{ status: "completed", priceCents: 6500 }], 8000);
    expect(summary.completedCents).toBe(6500);
    expect(summary.todoCents).toBe(0);
    expect(summary.scheduledCents).toBe(14500);
  });

  it("handles an empty day", () => {
    expect(summarizeDay([], 0)).toEqual({
      scheduledCents: 0,
      completedCents: 0,
      workingCents: 0,
      movedCents: 0,
      todoCents: 0,
    });
  });
});

describe("joinNames", () => {
  it("joins names the way a sentence would", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Alvarez"])).toBe("Alvarez");
    expect(joinNames(["Alvarez", "Kim"])).toBe("Alvarez and Kim");
    expect(joinNames(["Alvarez", "Kim", "Lee"])).toBe("Alvarez, Kim, and Lee");
  });
});
