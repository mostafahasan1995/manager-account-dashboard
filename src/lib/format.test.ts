import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatBps,
  formatBytes,
  formatCount,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatDateTimeSeconds,
  formatRelative,
  minutesSince,
  toDate,
} from './format';

const NOW = new Date('2026-08-21T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toDate', () => {
  it('parses an ISO string', () => {
    expect(toDate('2026-08-21T12:00:00.000Z')?.toISOString()).toBe('2026-08-21T12:00:00.000Z');
  });

  it('passes a Date through', () => {
    expect(toDate(NOW)).toEqual(NOW);
  });

  it('returns null for nothing, and for nonsense', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('not a date')).toBeNull();
  });
});

describe('absolute formats', () => {
  it('renders an unambiguous date and time', () => {
    expect(formatDateTime('2026-08-21T12:34:00.000Z')).toMatch(/21 Aug 2026/);
  });

  it('renders seconds when asked', () => {
    expect(formatDateTimeSeconds('2026-08-21T12:34:56.000Z')).toMatch(/:56$/);
  });

  it('renders a bare date', () => {
    expect(formatDate('2026-08-21T12:34:00.000Z')).toBe('21 Aug 2026');
  });

  it('renders an em dash rather than "Invalid Date"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDate('nope')).toBe('—');
    expect(formatDateTimeSeconds(undefined)).toBe('—');
  });
});

describe('formatRelative', () => {
  it('reads as the past for a past time', () => {
    expect(formatRelative('2026-08-21T11:57:00.000Z')).toBe('3 minutes ago');
  });

  it('reads as the future for a future time', () => {
    expect(formatRelative('2026-08-21T12:12:00.000Z')).toBe('in 12 minutes');
  });

  it('is an em dash for nothing', () => {
    expect(formatRelative(null)).toBe('—');
  });
});

describe('formatCountdown', () => {
  it('counts seconds under a minute', () => {
    expect(formatCountdown('2026-08-21T12:00:45.000Z')).toBe('45s');
  });

  it('counts minutes and seconds under an hour', () => {
    expect(formatCountdown('2026-08-21T12:04:12.000Z')).toBe('4m 12s');
  });

  it('counts hours and minutes above an hour', () => {
    expect(formatCountdown('2026-08-21T14:05:00.000Z')).toBe('2h 05m');
  });

  it('says "expired" once the moment has passed, rather than showing a negative', () => {
    expect(formatCountdown('2026-08-21T11:59:59.000Z')).toBe('expired');
    expect(formatCountdown(NOW.toISOString())).toBe('expired');
  });

  it('is an em dash for nothing', () => {
    expect(formatCountdown(null)).toBe('—');
  });
});

describe('minutesSince', () => {
  it('counts whole minutes of waiting', () => {
    expect(minutesSince('2026-08-21T11:43:30.000Z')).toBe(16);
  });

  it('is null when there is no timestamp to measure from', () => {
    expect(minutesSince(null)).toBeNull();
  });
});

describe('small formatters', () => {
  it.each([
    [512, '512 B'],
    [2048, '2.0 KB'],
    [1_500_000, '1.4 MB'],
  ])('formats %s bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('turns basis points into the percentage a human reads', () => {
    expect(formatBps(150)).toBe('1.50%');
    expect(formatBps(0)).toBe('0.00%');
  });

  it('groups counts', () => {
    expect(formatCount(1284)).toBe('1,284');
  });
});
