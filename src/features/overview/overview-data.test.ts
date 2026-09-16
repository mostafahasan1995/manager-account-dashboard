import { describe, expect, it } from 'vitest';

import type { ReconciliationBreak } from '@/types';

import {
  COUNT_SAMPLE_LIMIT,
  OLDEST_WAITING_QUERY,
  OPEN_BREAKS_QUERY,
  PANEL_ROWS,
  STUCK_MONEY_QUERY,
  UNCLAIMED_QUERY,
  bySeverityThenAge,
  sampleCountLabel,
  waitingSince,
} from './overview-data';

const brk = (severity: number, detectedAt: string): ReconciliationBreak =>
  ({ severity, detectedAt }) as ReconciliationBreak;

describe('sampleCountLabel', () => {
  it('shows the exact number when the whole list was loaded', () => {
    expect(sampleCountLabel(3, false)).toBe('3');
    expect(sampleCountLabel(0, false)).toBe('0');
  });

  it('admits it is a floor when there is another page behind the cursor', () => {
    expect(sampleCountLabel(COUNT_SAMPLE_LIMIT, true)).toBe('20+');
  });
});

describe('waitingSince', () => {
  it('measures the wait from submission', () => {
    expect(
      waitingSince({ submittedAt: '2026-08-21T10:00:00Z', createdAt: '2026-08-21T09:00:00Z' }),
    ).toBe('2026-08-21T10:00:00Z');
  });

  it('falls back to creation so an unstamped row still shows a wait', () => {
    expect(waitingSince({ submittedAt: null, createdAt: '2026-08-21T09:00:00Z' })).toBe(
      '2026-08-21T09:00:00Z',
    );
  });
});

describe('bySeverityThenAge', () => {
  it('puts the worst first', () => {
    const rows = [brk(2, '2026-08-21T10:00:00Z'), brk(5, '2026-08-21T11:00:00Z')].sort(
      bySeverityThenAge,
    );
    expect(rows.map((row) => row.severity)).toEqual([5, 2]);
  });

  it('breaks a severity tie with the oldest', () => {
    const older = brk(4, '2026-08-21T08:00:00Z');
    const newer = brk(4, '2026-08-21T12:00:00Z');
    expect([newer, older].sort(bySeverityThenAge)).toEqual([older, newer]);
  });
});

describe('the queries the tiles and panels share', () => {
  it('asks for one page and no more', () => {
    expect(UNCLAIMED_QUERY.limit).toBe(COUNT_SAMPLE_LIMIT);
    expect(OPEN_BREAKS_QUERY.limit).toBe(COUNT_SAMPLE_LIMIT);
    expect(OLDEST_WAITING_QUERY.limit).toBe(PANEL_ROWS);
  });

  it('counts unclaimed with the filter the backend provides rather than in the browser', () => {
    expect(UNCLAIMED_QUERY.unclaimedOnly).toBe(true);
    expect(UNCLAIMED_QUERY.status).toEqual(['SUBMITTED']);
  });

  it('treats both stuck-money statuses as one number', () => {
    expect(STUCK_MONEY_QUERY.status).toEqual(['CREDIT_FAILED', 'NEEDS_RECONCILIATION']);
  });

  it('reads the queue oldest first', () => {
    expect(OLDEST_WAITING_QUERY.sort).toBe('oldest');
  });
});
