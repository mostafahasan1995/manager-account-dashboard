import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { resetApiClient } from '@/lib/api/client';
import { resetMockDb } from '@/mocks/db';

import {
  assertNoApiSchemaDrift,
  installApiDriftDetector,
  uninstallApiDriftDetector,
} from './api-drift';
import { server } from './msw-server';

/**
 * The test environment, set up once for every suite.
 *
 * The mock API runs in `error` mode for unhandled requests: a component that calls an endpoint
 * nobody mocked should fail the test loudly rather than hang on a pending promise, because a
 * silently pending query is exactly what makes a flaky suite.
 *
 * For the same reason a mock whose SHAPE has drifted from its zod schema fails the test that called
 * it, rather than warning into a scrollback nobody reads — see ./api-drift.
 */

/**
 * How long a `findBy*` waits before it gives up. Default is 1000ms.
 *
 * ── WHY THIS IS NOT PAPERING OVER A FLAKY SUITE ───────────────────────────────────────────────
 * It raises only the deadline, never an assertion. A query that would have found nothing still
 * finds nothing and still fails; it just is not told to stop looking while the render it is waiting
 * for is still in progress. Nothing here can turn a failing expectation into a passing one.
 *
 * The deadline had to move because the gate runs twice and the second run is much slower than the
 * first: `vitest run --coverage` puts v8 instrumentation under every component, and on that pass a
 * mount that takes 200ms bare can take several times that. The suite was failing 35 assertions
 * across 19 files under coverage and none of them without it — every failure a timeout, not one an
 * assertion about content. A gate that reports the machine's load rather than the code's
 * correctness teaches people to re-run it until it is green, which is how a real failure gets
 * waved through.
 *
 * One second was never a deliberate budget — it is the library's default, chosen for a suite that
 * does not mount a query client, a router and an MSW round trip per case.
 */
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  installApiDriftDetector();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
  resetApiClient();
  window.sessionStorage.clear();
  window.localStorage.clear();

  // LAST, and after cleanup: a warning raised while a component was unmounting still counts, and
  // throwing here fails the test that caused it rather than the one that runs next.
  assertNoApiSchemaDrift();
});

afterAll(() => {
  server.close();
  uninstallApiDriftDetector();
});

/*
 * ── jsdom gaps that Radix and the console rely on ─────────────────────────────────────────────
 *
 * These are shims for browser APIs jsdom does not implement. TypeScript's DOM lib declares them all
 * as present, so the type-aware lint rules see the assignments as unnecessary — they are not: at
 * runtime the globals are genuinely missing, which is why every one of them is assigned here.
 */
/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-empty-function */

// Radix measures with these; jsdom ships neither.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

globalThis.IntersectionObserver ??= class {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as typeof IntersectionObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Radix Select calls this unconditionally; jsdom leaves it undefined.
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;

// The proof viewer creates and revokes object URLs; jsdom implements neither.
URL.createObjectURL ??= vi.fn(() => 'blob:mock-proof');
URL.revokeObjectURL ??= vi.fn();

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
});

/* eslint-enable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-empty-function */
