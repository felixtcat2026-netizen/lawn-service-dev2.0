/** Formats integer minor-unit prices (cents) as a currency string, e.g. 5000 -> "$50.00". */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

/** Parses a user-entered price string (dollars) into integer cents. Throws on invalid input. */
export function parsePriceToCents(input: string): number {
  const trimmed = input.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a price like 50 or 50.00");
  }
  return Math.round(parseFloat(trimmed) * 100);
}
