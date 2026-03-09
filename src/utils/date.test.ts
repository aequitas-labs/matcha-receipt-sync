import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDate, formatDate, timeAgo } from './date';

describe('parseDate', () => {
  it('parses ISO date strings', () => {
    const d = parseDate('2024-06-15');
    expect(d).not.toBeNull();
    // Use UTC accessors — ISO date-only strings are parsed as UTC
    expect(d!.getUTCFullYear()).toBe(2024);
    expect(d!.getUTCMonth()).toBe(5); // June = 5
    expect(d!.getUTCDate()).toBe(15);
  });

  it('parses ISO datetime strings', () => {
    const d = parseDate('2024-06-15T10:30:00.000Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });

  it('parses "Month Day, Year" format', () => {
    const d = parseDate('January 15, 2024');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(0); // January = 0
    expect(d!.getDate()).toBe(15);
  });

  it('parses "Month Day Year" without comma', () => {
    const d = parseDate('January 15 2024');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });

  it('parses abbreviated month names', () => {
    const d = parseDate('Dec 25, 2023');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(11); // December = 11
  });

  it('returns null for invalid input', () => {
    expect(parseDate('not a date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull();
  });

  it('handles whitespace trimming', () => {
    const d = parseDate('  2024-06-15  ');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
  });
});

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    // Use UTC to avoid timezone issues
    const date = new Date('2024-06-15T12:00:00.000Z');
    expect(formatDate(date)).toMatch(/^2024-06-1[45]$/); // allow for timezone offset
  });

  it('pads month and day with zeros', () => {
    const result = formatDate(new Date('2024-01-05T12:00:00.000Z'));
    expect(result).toMatch(/^\d{4}-01-0[45]$/);
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent dates', () => {
    const now = new Date('2024-06-15T12:00:00.000Z').toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for dates less than 1 hour ago', () => {
    const fiveMinutesAgo = new Date('2024-06-15T11:55:00.000Z').toISOString();
    expect(timeAgo(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours for dates less than 24 hours ago', () => {
    const twoHoursAgo = new Date('2024-06-15T10:00:00.000Z').toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days for dates less than 30 days ago', () => {
    const threeDaysAgo = new Date('2024-06-12T12:00:00.000Z').toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3d ago');
  });

  it('returns months for dates more than 30 days ago', () => {
    const twoMonthsAgo = new Date('2024-04-15T12:00:00.000Z').toISOString();
    expect(timeAgo(twoMonthsAgo)).toBe('2mo ago');
  });
});
