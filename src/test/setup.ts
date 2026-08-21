import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { resetApiClient } from '@/lib/api/client';
import { resetMockDb } from '@/mocks/db';

import { server } from './msw-server';

/**
 * The test environment, set up once for every suite.
 *
 * The mock API runs in `error` mode for unhandled requests: a component that calls an endpoint
 * nobody mocked should fail the test loudly rather than hang on a pending promise, because a
 * silently pending query is exactly what makes a flaky suite.
 */

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
  resetApiClient();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterAll(() => {
  server.close();
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
