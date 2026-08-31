import { describe, expect, it } from 'vitest';

import { ADMIN_ROLES } from '@/types/enums';

import { CAPABILITIES, CAPABILITY_LABELS, can, canAny, capabilitiesOf } from './permissions';

/**
 * This table is a mirror of the backend's role constants, so these tests are really a transcription
 * check. They are written as the sentences the backend states, one per rule, because a silent drift
 * here shows a reviewer a button the server will refuse — or worse, hides one they need.
 */

describe('the role table', () => {
  it('covers every role the backend can send', () => {
    for (const role of ADMIN_ROLES) {
      expect(capabilitiesOf(role)).toBeInstanceOf(Array);
    }
  });

  it('gives every capability a label, so nothing renders blank on the settings screen', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    }
  });

  it('grants nothing at all without a role', () => {
    for (const capability of CAPABILITIES) {
      expect(can(null, capability)).toBe(false);
      expect(can(undefined, capability)).toBe(false);
    }
    expect(capabilitiesOf(null)).toEqual([]);
  });
});

describe('PLATFORM_ADMIN is the owner superset — it holds everything', () => {
  it("manages the platform: operators, staff, and every operator's finance balances", () => {
    expect(can('PLATFORM_ADMIN', 'tenants.manage')).toBe(true);
    expect(can('PLATFORM_ADMIN', 'admins.read')).toBe(true);
    expect(can('PLATFORM_ADMIN', 'admins.write')).toBe(true);
    expect(can('PLATFORM_ADMIN', 'platformFinance.read')).toBe(true);
  });

  it('also does everything a tenant SUPER_ADMIN can, including deciding money', () => {
    // By the operator's decision the owner account is a strict superset: it configures rails AND
    // decides money — approves deposits, retries credits, sweeps, links players, corrects floats and
    // resolves breaks. Its money decisions are unbounded by an approval limit (the backend exempts
    // it) but still land in the ledger and the audit trail.
    for (const capability of CAPABILITIES) {
      expect(can('PLATFORM_ADMIN', capability)).toBe(true);
    }
  });
});

describe('SUPER_ADMIN is the top of ONE tenant', () => {
  it('can do everything inside the tenant, including staff and approval limits', () => {
    expect(can('SUPER_ADMIN', 'deposits.decide')).toBe(true);
    expect(can('SUPER_ADMIN', 'admins.write')).toBe(true);
    expect(can('SUPER_ADMIN', 'paymentMethods.write')).toBe(true);
    expect(can('SUPER_ADMIN', 'reconciliation.act')).toBe(true);
  });

  it('cannot touch tenants — that is deliberately a different job', () => {
    expect(can('SUPER_ADMIN', 'tenants.manage')).toBe(false);
  });
});

describe('FINANCE_ADMIN', () => {
  it('decides money and runs reconciliation', () => {
    expect(can('FINANCE_ADMIN', 'deposits.decide')).toBe(true);
    expect(can('FINANCE_ADMIN', 'deposits.retryCredit')).toBe(true);
    expect(can('FINANCE_ADMIN', 'reconciliation.act')).toBe(true);
    expect(can('FINANCE_ADMIN', 'paymentMethods.write')).toBe(true);
  });

  it('reads the staff directory but cannot change who has authority', () => {
    expect(can('FINANCE_ADMIN', 'admins.read')).toBe(true);
    expect(can('FINANCE_ADMIN', 'admins.write')).toBe(false);
  });
});

describe('REVIEWER', () => {
  it('decides deposits', () => {
    expect(can('REVIEWER', 'deposits.decide')).toBe(true);
  });

  it('cannot retry a credit, sweep, change rails, or see staff', () => {
    expect(can('REVIEWER', 'deposits.retryCredit')).toBe(false);
    expect(can('REVIEWER', 'deposits.sweep')).toBe(false);
    expect(can('REVIEWER', 'paymentMethods.write')).toBe(false);
    expect(can('REVIEWER', 'admins.read')).toBe(false);
  });

  it('can read reconciliation but not act on it', () => {
    expect(can('REVIEWER', 'reconciliation.read')).toBe(true);
    expect(can('REVIEWER', 'reconciliation.act')).toBe(false);
  });
});

describe('SUPPORT looks; it decides nothing', () => {
  it('reads deposits, players and rails', () => {
    expect(can('SUPPORT', 'deposits.read')).toBe(true);
    expect(can('SUPPORT', 'players.read')).toBe(true);
    expect(can('SUPPORT', 'paymentMethods.read')).toBe(true);
  });

  it('decides no deposit and links no player', () => {
    expect(can('SUPPORT', 'deposits.decide')).toBe(false);
    expect(can('SUPPORT', 'players.link')).toBe(false);
  });

  it('sees no reconciliation at all', () => {
    expect(can('SUPPORT', 'reconciliation.read')).toBe(false);
  });
});

describe('VIEWER is read-only, and narrower than SUPPORT', () => {
  it('sees the queue and reconciliation, and nothing else', () => {
    expect(capabilitiesOf('VIEWER')).toEqual(['deposits.read', 'reconciliation.read']);
  });

  it('cannot even read players', () => {
    expect(can('VIEWER', 'players.read')).toBe(false);
  });
});

describe('canAny', () => {
  it('is true when the role holds at least one of them', () => {
    expect(canAny('SUPPORT', ['admins.write', 'players.read'])).toBe(true);
  });

  it('is false when it holds none', () => {
    expect(canAny('VIEWER', ['admins.write', 'players.read'])).toBe(false);
  });

  it('is false for an empty list — no capability was granted', () => {
    expect(canAny('SUPER_ADMIN', [])).toBe(false);
  });
});
