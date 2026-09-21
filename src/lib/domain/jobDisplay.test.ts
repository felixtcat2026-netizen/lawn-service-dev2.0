import { describe, expect, it } from "vitest";
import { isCustomerDeactivatedSkip, statusLabel } from "./jobDisplay";

describe("statusLabel", () => {
  it("uses owner-facing wording", () => {
    expect(statusLabel("scheduled")).toBe("Scheduled");
    expect(statusLabel("rescheduled")).toBe("Moved");
    expect(statusLabel("completed")).toBe("Done");
    expect(statusLabel("cancelled", "rained out")).toBe("Skipped");
  });

  it("labels a visit cancelled by deactivating the customer differently from a skip", () => {
    expect(statusLabel("cancelled", "customer deactivated")).toBe("Customer inactive");
    expect(isCustomerDeactivatedSkip("cancelled", "customer deactivated")).toBe(true);
    expect(isCustomerDeactivatedSkip("scheduled", "customer deactivated")).toBe(false);
    expect(isCustomerDeactivatedSkip("cancelled", null)).toBe(false);
  });
});
