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
  /**
   * A deployment-chosen name that REPLACES the translated one, or empty to use the translation.
   *
   * It used to be the name itself, defaulting to a hard-coded English string — which is why the
   * console said "Cashier Console" in the sidebar of an otherwise fully Arabic screen. The
   * translated name existed the whole time (`app.name`, with Arabic) and nothing rendered it,
   * because an env string cannot have two languages.
   *
   * So the default is now EMPTY and means "use the translation". Set it only when a deployment
   * genuinely needs its own name, and accept that such a name is the same in both languages —
   * which is the honest trade, because nobody can translate a value that arrives at build time.
   */
  appName: import.meta.env.VITE_APP_NAME ?? '',
  /** In-browser mock API. Demos, UI work without a database, and the Playwright suite. */
  enableMocks: bool(import.meta.env.VITE_ENABLE_MOCKS),
  /**
   * The second key on the mock refusal in `main.tsx`. Set by `playwright.config.ts` and by nothing
   * else, so that one stale `.env` line can no longer ship a console that signs anyone in. Read
   * only there; never gate a feature on it.
   */
  allowMocksInBuild: bool(import.meta.env.VITE_ALLOW_MOCKS_IN_BUILD),
  /**
   * Send `X-Tenant-Id` on admin requests. OFF until the backend reads it — see
   * docs/API-CONTRACT.md section 5. With it off, the console states plainly that everything outside
   * the Tenants page is tenant zero, rather than implying a selection it cannot honour.
   */
  tenantHeaderEnabled: bool(import.meta.env.VITE_TENANT_HEADER_ENABLED),
} as const;

export type AppConfig = typeof config;
