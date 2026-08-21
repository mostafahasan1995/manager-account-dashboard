/**
 * Every environment-dependent value the app has, resolved once, here.
 *
 * Read through this module rather than `import.meta.env` directly: a typo in an env name is then a
 * compile error in one file instead of an `undefined` that reaches a fetch URL at runtime.
 */

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
};

/** Trailing slashes make `${base}/v1/...` produce `//v1/...`, which some proxies 404. */
const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const config = {
  apiBaseUrl: stripTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'),
  appName: import.meta.env.VITE_APP_NAME ?? 'Cashier Console',
  /** In-browser mock API. Demos, UI work without a database, and the Playwright suite. */
  enableMocks: bool(import.meta.env.VITE_ENABLE_MOCKS),
  /**
   * Send `X-Tenant-Id` on admin requests. OFF until the backend reads it — see
   * docs/API-CONTRACT.md section 5. With it off, the console states plainly that everything outside
   * the Tenants page is tenant zero, rather than implying a selection it cannot honour.
   */
  tenantHeaderEnabled: bool(import.meta.env.VITE_TENANT_HEADER_ENABLED),
} as const;

export type AppConfig = typeof config;
