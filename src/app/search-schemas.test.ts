import { describe, expect, it } from 'vitest';

import {
  depositSearchSchema,
  paymentMethodSearchSchema,
  playerSearchSchema,
  pruneSearch,
  reconciliationSearchSchema,
  staffSearchSchema,
  tenantSearchSchema,
} from './search-schemas';

/**
 * Filters live in the URL, which means anyone can type anything into them. These schemas exist so a
 * malformed link opens the default view instead of throwing inside a route — a shared queue link
 * that 500s is worse than one that quietly shows everything.
 */

describe('depositSearchSchema', () => {
  it('accepts a comma-separated status list, the form the backend itself uses', () => {
    expect(depositSearchSchema.parse({ status: 'SUBMITTED,UNDER_REVIEW' }).status).toEqual([
      'SUBMITTED',
      'UNDER_REVIEW',
    ]);
  });

  it('accepts an array unchanged', () => {
    expect(depositSearchSchema.parse({ status: ['SUBMITTED'] }).status).toEqual(['SUBMITTED']);
  });

  it('uppercases and drops entries that are not real statuses', () => {
    expect(depositSearchSchema.parse({ status: 'submitted,NOT_A_STATUS' }).status).toEqual([
      'SUBMITTED',
    ]);
  });

  it('leaves status undefined when nothing valid survives, rather than filtering to nothing', () => {
    expect(depositSearchSchema.parse({ status: 'GARBAGE' }).status).toBeUndefined();
    expect(depositSearchSchema.parse({ status: '' }).status).toBeUndefined();
  });

  it('falls back to no sort when the sort is unknown', () => {
    expect(depositSearchSchema.parse({ sort: 'sideways' }).sort).toBeUndefined();
    expect(depositSearchSchema.parse({ sort: 'amount_desc' }).sort).toBe('amount_desc');
  });

  it('coerces the limit and clamps out-of-range values to the default view', () => {
    expect(depositSearchSchema.parse({ limit: '50' }).limit).toBe(50);
    expect(depositSearchSchema.parse({ limit: '9999' }).limit).toBeUndefined();
    expect(depositSearchSchema.parse({ limit: 'abc' }).limit).toBeUndefined();
  });

  it('keeps the selected deposit, which is what makes a review a shareable link', () => {
    expect(depositSearchSchema.parse({ selected: 'dep-1' }).selected).toBe('dep-1');
  });

  it('parses an empty URL into an all-undefined default view', () => {
    expect(depositSearchSchema.parse({})).toEqual({
      status: undefined,
      sort: undefined,
      shortId: undefined,
      playerId: undefined,
      paymentMethodId: undefined,
      externalReference: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      unclaimedOnly: undefined,
      limit: undefined,
      selected: undefined,
    });
  });
});

describe('playerSearchSchema', () => {
  it('keeps a known status and drops an unknown one', () => {
    expect(playerSearchSchema.parse({ status: 'ACTIVE' }).status).toBe('ACTIVE');
    expect(playerSearchSchema.parse({ status: 'NOPE' }).status).toBeUndefined();
  });

  it('coerces the offset', () => {
    expect(playerSearchSchema.parse({ offset: '40' }).offset).toBe(40);
    expect(playerSearchSchema.parse({ offset: '-1' }).offset).toBeUndefined();
  });

  it('trims a search term and drops an empty one', () => {
    expect(playerSearchSchema.parse({ search: '  karim  ' }).search).toBe('karim');
    expect(playerSearchSchema.parse({ search: '   ' }).search).toBeUndefined();
  });
});

describe('staffSearchSchema', () => {
  it('keeps a real role', () => {
    expect(staffSearchSchema.parse({ role: 'FINANCE_ADMIN' }).role).toBe('FINANCE_ADMIN');
    expect(staffSearchSchema.parse({ role: 'CHIEF' }).role).toBeUndefined();
  });
});

describe('paymentMethodSearchSchema', () => {
  it('keeps a real rail and the selected method', () => {
    const parsed = paymentMethodSearchSchema.parse({ rail: 'BANK_TRANSFER', selected: 'm-1' });
    expect(parsed.rail).toBe('BANK_TRANSFER');
    expect(parsed.selected).toBe('m-1');
  });
});

describe('reconciliationSearchSchema', () => {
  it('keeps a known tab and forgets an invented one', () => {
    expect(reconciliationSearchSchema.parse({ tab: 'ageing' }).tab).toBe('ageing');
    expect(reconciliationSearchSchema.parse({ tab: 'invented' }).tab).toBeUndefined();
  });

  it('parses status and category lists', () => {
    const parsed = reconciliationSearchSchema.parse({
      status: 'OPEN,INVESTIGATING',
      category: 'AGENT_FLOAT_MISMATCH',
    });
    expect(parsed.status).toEqual(['OPEN', 'INVESTIGATING']);
    expect(parsed.category).toEqual(['AGENT_FLOAT_MISMATCH']);
  });

  it('keeps severity inside 1..5', () => {
    expect(reconciliationSearchSchema.parse({ minSeverity: '4' }).minSeverity).toBe(4);
    expect(reconciliationSearchSchema.parse({ minSeverity: '9' }).minSeverity).toBeUndefined();
  });
});

describe('tenantSearchSchema', () => {
  it('keeps a real status and the create flag', () => {
    const parsed = tenantSearchSchema.parse({ status: 'SUSPENDED', create: 'true' });
    expect(parsed.status).toBe('SUSPENDED');
    expect(parsed.create).toBe(true);
  });
});

/**
 * The boolean filters, which used to read every one of these as YES.
 *
 * `z.coerce.boolean()` is `Boolean(value)`, and `Boolean('false')` is true. The console writes real
 * JSON booleans so its own links were fine; a hand-edited `?linked=no` filtered to LINKED, and
 * nothing looked broken. These cases are table-driven because the failure was uniform across six
 * different filters and would come back the same way.
 */
const TRUTHY = [true, 1, 'true', 'TRUE', ' True ', '1'] as const;
const FALSY = [false, 0, 'false', 'FALSE', ' false ', '0'] as const;
/** Not `false` — ABSENT. Reading these as false would invent a filter nobody asked for. */
const NEITHER = ['no', 'off', 'maybe', '', '  ', 'yes', 'on', 2, -1] as const;

describe('boolean filters', () => {
  it.each(TRUTHY)('reads %o as true', (value) => {
    expect(playerSearchSchema.parse({ linked: value }).linked).toBe(true);
  });

  it.each(FALSY)('reads %o as false', (value) => {
    expect(playerSearchSchema.parse({ linked: value }).linked).toBe(false);
  });

  it.each(NEITHER)('reads %o as absent, never as true', (value) => {
    expect(playerSearchSchema.parse({ linked: value }).linked).toBeUndefined();
  });

  it('leaves an unsupplied filter absent', () => {
    expect(playerSearchSchema.parse({}).linked).toBeUndefined();
  });

  /*
   * Every schema that uses the parser, not just the one above: the bug was in the shared helper, so
   * a fix that only reached `linked` would leave five other filters lying in exactly the same way.
   */
  it('applies to every filter built on it', () => {
    expect(depositSearchSchema.parse({ unclaimedOnly: 'no' }).unclaimedOnly).toBeUndefined();
    expect(depositSearchSchema.parse({ unclaimedOnly: 'false' }).unclaimedOnly).toBe(false);

    expect(staffSearchSchema.parse({ isActive: 'no' }).isActive).toBeUndefined();
    expect(staffSearchSchema.parse({ isActive: 'false' }).isActive).toBe(false);

    expect(paymentMethodSearchSchema.parse({ isActive: 'no' }).isActive).toBeUndefined();
    expect(paymentMethodSearchSchema.parse({ isActive: 'false' }).isActive).toBe(false);

    const inactive = paymentMethodSearchSchema.parse({ includeInactiveDestinations: 'False' });
    expect(inactive.includeInactiveDestinations).toBe(false);
    expect(
      paymentMethodSearchSchema.parse({ includeInactiveDestinations: 'off' })
        .includeInactiveDestinations,
    ).toBeUndefined();

    expect(tenantSearchSchema.parse({ create: 'no' }).create).toBeUndefined();
    expect(tenantSearchSchema.parse({ create: 'true' }).create).toBe(true);
  });

  it('survives a shape it cannot read at all, rather than throwing inside a route', () => {
    expect(playerSearchSchema.parse({ linked: { nope: true } }).linked).toBeUndefined();
  });
});

describe('pruneSearch', () => {
  it('removes cleared filters so they leave the URL instead of becoming empty params', () => {
    expect(
      pruneSearch({ status: undefined, search: '', selected: null, limit: 20, tags: [] }),
    ).toEqual({ limit: 20 });
  });

  it('keeps false, which is a real filter value and not an absence', () => {
    expect(pruneSearch({ unclaimedOnly: false })).toEqual({ unclaimedOnly: false });
  });
});
