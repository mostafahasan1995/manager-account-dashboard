import { describe, expect, it } from 'vitest';

import { config } from '@/config';

import { routeTree } from './router';

/**
 * THE FLAG-OFF DEFAULT, pinned.
 *
 * `/dev/shamcash` takes a live Sham Cash cashier session in a form and hands it to a browser. On a
 * console where the feature is off it must not merely be unlinked — it must not EXIST, because a
 * hidden link is still a reachable URL that anybody can type.
 *
 * The route tree is built once at module load from `config.shamCashDevEnabled`, so this asserts the
 * shipped default rather than a runtime branch. `VITE_ENABLE_SHAMCASH_DEV` is unset in the test env
 * (and pinned off in vitest.config.ts's `env` block for the flags that matter), which is exactly the
 * state a real deployment is in.
 */
const paths = (): string[] =>
  (routeTree.children as { options?: { path?: string } }[] | undefined)?.map(
    (route) => route.options?.path ?? '',
  ) ?? [];

describe('the route tree', () => {
  it('does not carry the Sham Cash bench by default', () => {
    expect(config.shamCashDevEnabled).toBe(false);
    expect(paths()).not.toContain('/dev/shamcash');
  });

  it('still carries the screens an operator actually uses', () => {
    // So a mistake in the spread above shows up as a missing console rather than silently as one
    // missing route.
    expect(paths()).toEqual(
      expect.arrayContaining(['/', '/deposits', '/stats', '/withdrawals', '/settings']),
    );
  });
});
