import { describe, it, expect } from 'vitest';
import { parseCurrency } from './currency';

describe('parseCurrency', () => {
  it('parses standard dollar amounts', () => {
    expect(parseCurrency('$42.99')).toBe(42.99);
  });

  it('parses amounts without dollar sign', () => {
    expect(parseCurrency('42.99')).toBe(42.99);
  });

  it('parses amounts with commas', () => {
    expect(parseCurrency('$1,234.56')).toBe(1234.56);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseCurrency('N/A')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseCurrency('')).toBe(0);
  });

  it('handles negative amounts', () => {
    expect(parseCurrency('-$5.00')).toBe(-5.0);
  });

  it('parses zero', () => {
    expect(parseCurrency('$0.00')).toBe(0);
  });

  it('parses large amounts', () => {
    expect(parseCurrency('$10,000.00')).toBe(10000.0);
  });
});
