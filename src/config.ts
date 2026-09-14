/**
 * Every environment-dependent value the app has, resolved once, here.
 *
 * Read through this module rather than `import.meta.env` directly: a typo in an env name is then a
 * compile error in one file instead of an `undefined` that reaches a fetch URL at runtime.
 */

/**
 * The settings a running container may supply, and ONLY these.
 *
 * ── WHY SOME SETTINGS MOVED TO RUNTIME ────────────────────────────────────────────────────────
 * Vite writes `import.meta.env` into the bundle at build time, so every API URL used to need its own
 * build — one image for the laptop, another for the VPS, and no way to promote the image that was
 * actually tested. `index.html` now loads `/config.js` before the bundle; in the container that file
 * is generated at start from the environment (docker/40-runtime-config.sh), and in `vite dev`,
 * `vite preview` and the Playwright suite it is the empty placeholder in `public/`.
 *
 * Precedence for each of these four: the runtime value, then `import.meta.env`, then the compiled
 * fallback. So nothing changes for a developer — the placeholder says nothing and `.env` still wins.
 *
 * ── WHAT IS NOT HERE, AND MUST NEVER BE ───────────────────────────────────────────────────────
 * `enableMocks` and `allowMocksInBuild`. The refusal in `main.tsx` is the only thing standing
 * between a production bundle and a console that signs anyone in as SUPER_ADMIN with `123456`, and
 * it holds because BOTH of its keys are fixed when the bundle is built. If either could come from
 * this object, one environment variable on a running container — or one line in a file an operator
 * edits by hand — would undo it, with nothing on screen to show that it had. So this type names four
 * keys, the reader below copies exactly those four, and `config.test.ts` pins that a runtime
 * `enableMocks` does nothing. Adding a key here is a security decision, not a convenience.
 *
 * The object arrives from a file, not from the type checker, so each value is also checked at
 * runtime: a string where a boolean belongs is ignored rather than coerced.
 */
interface RuntimeAppConfig {
  readonly apiBaseUrl?: string;
  readonly appName?: string;
  readonly tenantHeaderEnabled?: boolean;
  readonly shamCashDevEnabled?: boolean;
}

declare global {
  interface Window {
    /** Set by `/config.js`, which `index.html` loads before the bundle. See `RuntimeAppConfig`. */
    __APP_CONFIG__?: RuntimeAppConfig;
  }
}

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
};

/** Trailing slashes make `${base}/v1/...` produce `//v1/...`, which some proxies 404. */
const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * A runtime string, or `undefined` to fall through. Empty counts as unset — the same rule `bool`
 * applies to an empty `.env` line, and the reason an empty API URL can never build a relative URL.
 */
const runtimeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** A runtime boolean, or `undefined` to fall through. Only a real JSON `true`/`false` counts. */
const runtimeBool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const runtime: RuntimeAppConfig = window.__APP_CONFIG__ ?? {};

export const config = {
  apiBaseUrl: stripTrailingSlash(
    runtimeString(runtime.apiBaseUrl) ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:3000',
  ),
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
   * which is the honest trade, because nobody can translate a value that arrives from outside.
   */
  appName: runtimeString(runtime.appName) ?? import.meta.env.VITE_APP_NAME ?? '',
  /**
   * In-browser mock API. Demos, UI work without a database, and the Playwright suite.
   *
   * BUILD-TIME ONLY — never read from `window.__APP_CONFIG__`. See `RuntimeAppConfig` for why.
   */
  enableMocks: bool(import.meta.env.VITE_ENABLE_MOCKS),
  /**
   * The second key on the mock refusal in `main.tsx`. Set by `playwright.config.ts` and by nothing
   * else, so that one stale `.env` line can no longer ship a console that signs anyone in. Read
   * only there; never gate a feature on it. BUILD-TIME ONLY, for the same reason as `enableMocks`.
   */
  allowMocksInBuild: bool(import.meta.env.VITE_ALLOW_MOCKS_IN_BUILD),
  /**
   * Send `X-Tenant-Id` on admin requests. OFF until the backend reads it — see
   * docs/API-CONTRACT.md section 5. With it off, the console states plainly that everything outside
   * the Tenants page is tenant zero, rather than implying a selection it cannot honour.
   */
  tenantHeaderEnabled:
    runtimeBool(runtime.tenantHeaderEnabled) ?? bool(import.meta.env.VITE_TENANT_HEADER_ENABLED),
  /**
   * The Sham Cash developer bench at /dev/shamcash. OFF, and it should stay off.
   *
   * Sham Cash is read over its HTTP API; the bench drives the OLD mechanism — a headless browser
   * replaying a signed-in session — for the two questions only a browser can answer when the site
   * changes. It takes a live cashier session in a form, so it has no place on a console an operator
   * uses, and without this flag the route is not registered at all.
   *
   * BOTH SIDES HAVE TO BE ON. This only shows the page; the API answers 404 on its own routes
   * unless SHAM_CASH_DEV_CHECK is set there too. Turning on one and not the other gives a page
   * whose buttons all report "not found", which is the honest result of a half-enabled feature.
   */
  shamCashDevEnabled:
    runtimeBool(runtime.shamCashDevEnabled) ?? bool(import.meta.env.VITE_ENABLE_SHAMCASH_DEV),
} as const;

export type AppConfig = typeof config;
