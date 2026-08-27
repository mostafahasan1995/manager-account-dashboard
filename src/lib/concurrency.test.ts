import { describe, expect, it } from 'vitest';

import { createLimiter } from './concurrency';

/**
 * The gate in front of the balance column, tested for the two properties that only ever fail in
 * production.
 *
 * ── WHY IT MATTERS ────────────────────────────────────────────────────────────────────────────
 * There is no bulk balance endpoint, so a page of balances is one Cloudflare-fronted Ichancy call
 * per row. Fire them all and the operator gets a column of challenges instead of a column of
 * numbers. This limiter turns the burst into a trickle.
 *
 * The failure that would never be noticed is a LEAKED SLOT. `run` releases in a `finally`, so a
 * task that rejects — a 429, an abort, a parse failure — hands its slot back; delete that `finally`
 * and everything still passes except that the column wedges permanently after the first error, on
 * a real backend, in front of a real operator. Cases 3 and 4 are that test.
 *
 * ── WHY NO TIMERS ─────────────────────────────────────────────────────────────────────────────
 * Every case drives the clock with deferred promises the test resolves by hand. A `setTimeout(0)`
 * would make "did the third task start?" a question about the event loop's mood, which is how a
 * concurrency test becomes the flaky one everybody reruns.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Drains the microtask queue. `run` awaits `acquire()` before touching the task, so a slot handed
 * over synchronously still takes a turn or two to become a started task; eight is far more than the
 * chain needs and costs nothing.
 */
const settle = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

/** Swallows rejections so an expected failure cannot fail the test as an unhandled one. */
const ignore = (promise: Promise<unknown>): Promise<unknown> => promise.catch(() => undefined);

describe('the ceiling', () => {
  it('starts exactly `max` tasks and queues the rest', async () => {
    const limiter = createLimiter(2);
    const gates = Array.from({ length: 5 }, () => deferred());
    const started: number[] = [];

    const runs = gates.map((gate, index) =>
      limiter.run(() => {
        started.push(index);
        return gate.promise;
      }),
    );
    await settle();

    expect(started).toEqual([0, 1]);
    expect(limiter.active).toBe(2);
    expect(limiter.waiting).toBe(3);

    gates.forEach((gate) => {
      gate.resolve();
    });
    await Promise.all(runs);
  });

  it('never exceeds the ceiling across a whole wave', async () => {
    const limiter = createLimiter(3);
    const gates = Array.from({ length: 12 }, () => deferred());
    let inFlight = 0;
    let peak = 0;

    const runs = gates.map((gate) =>
      limiter.run(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await gate.promise;
        inFlight -= 1;
      }),
    );

    // Released one at a time, so every intermediate state is observed rather than only the last.
    for (const gate of gates) {
      gate.resolve();
      await settle();
    }
    await Promise.all(runs);

    expect(peak).toBe(3);
    expect(limiter.active).toBe(0);
    expect(limiter.waiting).toBe(0);
  });

  it('lets the longest-waiting task go next, so the table fills top to bottom', async () => {
    // A stack would fill the visible rows in whatever order the last render left them, which reads
    // as random on screen. `release` shifts, deliberately; this is what pins that.
    const limiter = createLimiter(2);
    const gates = Array.from({ length: 5 }, () => deferred());
    const started: number[] = [];

    const runs = gates.map((gate, index) =>
      limiter.run(() => {
        started.push(index);
        return gate.promise;
      }),
    );
    await settle();

    gates[0]?.resolve();
    await settle();

    expect(started).toEqual([0, 1, 2]);

    gates.forEach((gate) => {
      gate.resolve();
    });
    await Promise.all(runs);
  });
});

describe('a failing task', () => {
  it('hands its slot back when it rejects, and still rejects its own caller', async () => {
    const limiter = createLimiter(1);
    const first = deferred();
    const second = deferred();
    let secondStarted = false;

    const failing = limiter.run(() => first.promise);
    const queued = limiter.run(() => {
      secondStarted = true;
      return second.promise;
    });
    await settle();

    expect(secondStarted).toBe(false);

    first.reject(new Error('429 from the agent'));
    await settle();

    // The slot came back...
    expect(secondStarted).toBe(true);
    // ...and the rejection was not swallowed on the way.
    await expect(failing).rejects.toThrow('429 from the agent');

    second.resolve();
    await queued;
  });

  it('hands its slot back when it throws synchronously', async () => {
    // A task that throws before returning a promise never reaches an `await`, so a release written
    // after the await rather than in a `finally` would miss exactly this one.
    const limiter = createLimiter(1);
    let ranAfter = false;

    const thrown = limiter.run(() => {
      throw new Error('built the request wrong');
    });
    const queued = limiter.run(() => {
      ranAfter = true;
      return Promise.resolve('ok');
    });

    await expect(thrown).rejects.toThrow('built the request wrong');
    await expect(queued).resolves.toBe('ok');
    expect(ranAfter).toBe(true);
    expect(limiter.active).toBe(0);
  });

  it('does not let one failure wedge the queue behind it', async () => {
    const limiter = createLimiter(1);
    const outcomes = await Promise.all([
      ignore(limiter.run(() => Promise.reject(new Error('a')))),
      ignore(limiter.run(() => Promise.reject(new Error('b')))),
      limiter.run(() => Promise.resolve('c')),
    ]);

    expect(outcomes[2]).toBe('c');
    expect(limiter.active).toBe(0);
    expect(limiter.waiting).toBe(0);
  });
});

describe('the ceiling it will accept', () => {
  it.each([0, -1, 1.5, NaN, Infinity])('refuses %o', (max) => {
    // Loudly, at construction. A limiter of 0 would deadlock every caller forever, and a fractional
    // one would compare against a ceiling nothing can equal — both silent at the call site.
    expect(() => createLimiter(max)).toThrow(RangeError);
  });

  it('accepts one, which is a serial queue and a legitimate thing to want', () => {
    expect(createLimiter(1).active).toBe(0);
  });
});
