import { describe, expect, it } from "vitest";
import { formatCents, parsePriceToCents } from "./money";

describe("formatCents", () => {
  it("formats integer cents as USD currency", () => {
    expect(formatCents(5000, "USD")).toBe("$50.00");
    expect(formatCents(99, "USD")).toBe("$0.99");
    expect(formatCents(0, "USD")).toBe("$0.00");
  });
});

describe("parsePriceToCents", () => {
  it("parses whole-dollar input", () => {
    expect(parsePriceToCents("50")).toBe(5000);
  });

  it("parses input with cents", () => {
    expect(parsePriceToCents("50.5")).toBe(5050);
    expect(parsePriceToCents("50.55")).toBe(5055);
  });

  it("strips a leading dollar sign and thousands separators", () => {
    expect(parsePriceToCents("$1,200.00")).toBe(120000);
  });

  it("rejects negative, non-numeric, or malformed input", () => {
    expect(() => parsePriceToCents("-5")).toThrow();
    expect(() => parsePriceToCents("abc")).toThrow();
    expect(() => parsePriceToCents("5.999")).toThrow();
    expect(() => parsePriceToCents("")).toThrow();
  });
});
