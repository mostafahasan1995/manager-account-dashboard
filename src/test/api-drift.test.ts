import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { parseResponse } from '@/lib/api/client';

import { allowApiSchemaDrift, assertNoApiSchemaDrift } from './api-drift';

/**
 * The drift detector, tested through the thing it watches.
 *
 * Each case drives a real `parseResponse` rather than a hand-written `console.warn`, because the
 * coupling being asserted is between the message that function actually emits and the prefix this
 * one filters on. A test that warned by hand would keep passing after somebody reworded the warning
 * — and the detector would have quietly stopped detecting anything.
 *
 * Calling `assertNoApiSchemaDrift()` inside a case is safe and deliberate: it resets what it has
 * collected, so the `afterEach` in setup.ts then sees a clean slate and the case that just proved
 * the detector fires does not fail because of it.
 */

const schema = z.object({ id: z.string(), amountMinor: z.string() });

describe('when a response does not match its schema', () => {
  it('fails the test, and names the endpoint and the offending field', () => {
    parseResponse(schema, { id: 'a', amountMinor: 1500 }, 'GET /v1/admin/deposits');

    // Both halves matter. The endpoint is what tells you which handler to open; the field is what
    // tells you whether the mock or the schema is the one that moved.
    expect(() => {
      assertNoApiSchemaDrift();
    }).toThrow(/GET \/v1\/admin\/deposits/);
  });

  it('names the field path and what was wrong with it', () => {
    parseResponse(schema, { id: 'a', amountMinor: 1500 }, 'GET /v1/admin/deposits');

    let message = '';
    try {
      assertNoApiSchemaDrift();
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
    }

    expect(message).toContain('amountMinor');
    expect(message).toContain('expected string');
  });

  it('points at the two files that can disagree, and at the way out', () => {
    // The message is the whole value of this check: whoever hits it has probably never seen it.
    parseResponse(schema, {}, 'GET /v1/admin/players');

    let message = '';
    try {
      assertNoApiSchemaDrift();
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
    }

    expect(message).toContain('src/mocks/');
    expect(message).toContain('src/types/');
    expect(message).toContain('allowApiSchemaDrift');
  });

  it('reports every drift in the test, not only the first', () => {
    parseResponse(schema, {}, 'GET /v1/admin/players');
    parseResponse(schema, {}, 'GET /v1/admin/deposits');

    let message = '';
    try {
      assertNoApiSchemaDrift();
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
    }

    expect(message).toContain('/v1/admin/players');
    expect(message).toContain('/v1/admin/deposits');
  });
});

describe('what it leaves alone', () => {
  it('says nothing when every response matched', () => {
    parseResponse(schema, { id: 'a', amountMinor: '1500' }, 'GET /v1/admin/deposits');

    expect(() => {
      assertNoApiSchemaDrift();
    }).not.toThrow();
  });

  it('ignores warnings that are not the api client', () => {
    // React's act() warnings, jsdom's "not implemented", and whatever a library says next. A setup
    // that failed on all console output is a setup somebody reverts.
    console.warn('An update to Something inside a test was not wrapped in act(...)');

    expect(() => {
      assertNoApiSchemaDrift();
    }).not.toThrow();
  });

  it('honours a per-test opt-out, and only for that test', () => {
    allowApiSchemaDrift();
    parseResponse(schema, {}, 'GET /v1/admin/deposits');

    expect(() => {
      assertNoApiSchemaDrift();
    }).not.toThrow();

    // The opt-out was consumed with the assertion, so the next drift is loud again. Anything else
    // would make one careless call disable the check for the rest of the file.
    parseResponse(schema, {}, 'GET /v1/admin/deposits');
    expect(() => {
      assertNoApiSchemaDrift();
    }).toThrow();
  });
});

describe('production behaviour', () => {
  it('still passes the drifted value straight through to the screen', () => {
    // The console must degrade, not blank: a missing optional renders as an em dash, and a cashier
    // mid-shift keeps working. This check exists only in tests and must not have changed that.
    allowApiSchemaDrift();
    const drifted = { id: 'a', amountMinor: 1500 };

    expect(parseResponse(schema, drifted, 'GET /v1/admin/deposits')).toBe(drifted);
  });
});
