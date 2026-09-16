/**
 * A ceiling on how many of one kind of request may be in flight at once.
 *
 * This exists for exactly one caller today: reading player balances. There is no bulk balance
 * endpoint — `getPlayersForCurrentAgent` answers with `playerId, username, currency, affiliateId,
 * phoneNumber, registerDate` and nothing else — so a column of balances is ONE upstream Ichancy
 * call per player, each of which goes through Cloudflare, takes seconds, and is rate-limited.
 *
 * Twenty of those fired at once is a burst that Cloudflare answers with challenges and the agent
 * answers with 429s, and the operator gets a column of errors instead of a column of numbers. A
 * queue in front of them turns a burst into a trickle, at the cost of the last row arriving later —
 * which is the right trade when the alternative is that no row arrives at all.
 *
 * Deliberately tiny and dependency-free: `Promise.all` with a slice-by-slice loop would work too,
 * but it makes every wave wait for its slowest member, and it cannot be shared by components that
 * each own one request. This gate is shared, so four is four ACROSS the table rather than four per
 * caller.
 */

export interface Limiter {
  /** Runs `task` when a slot is free. Rejects with whatever the task rejects with. */
  run: <T>(task: () => Promise<T>) => Promise<T>;
  /** How many tasks are running right now. For tests and diagnostics. */
  readonly active: number;
  /** How many are queued behind them. */
  readonly waiting: number;
}

export function createLimiter(max: number): Limiter {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`A limiter needs a positive integer ceiling, got ${max}`);
  }

  let active = 0;
  const queue: (() => void)[] = [];

  const release = (): void => {
    active -= 1;
    // Shift rather than pop: a queue, not a stack. The row that has been waiting longest goes
    // next, so the table fills top to bottom instead of in whatever order the last render left.
    const next = queue.shift();
    if (next !== undefined) next();
  };

  const acquire = (): Promise<void> => {
    if (active < max) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active += 1;
        resolve();
      });
    });
  };

  return {
    run: async <T>(task: () => Promise<T>): Promise<T> => {
      await acquire();
      try {
        return await task();
      } finally {
        // In `finally`, so a task that throws — a 429, an abort, a parse failure — still hands its
        // slot back. A limiter that leaks slots wedges the whole column after the first failure.
        release();
      }
    },
    get active() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
  };
}
