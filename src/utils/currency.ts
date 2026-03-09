/** Parse a currency string like "$42.99" or "42.99" into a number */
export function parseCurrency(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
