import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The compiled defaults, pinned.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
 * `VITE_TENANT_HEADER_ENABLED` decides whether the console sends `X-Tenant-Id`, and therefore
 * whether the operator switcher is real or decorative. For a while four places in this repository
 * disagreed about its value — an `.env` whose comment contradicted the line below it, a README
 * table, and a contract document — and nothing failed, because a default that is never asserted
 * cannot drift loudly.
 *
 * The backend carries the tenant claim (see docs/API-CONTRACT.md §5), so the shipped `.env` files
 * set `true`. The COMPILED fallback stays `false`, and that asymmetry is the point: pointing this
 * console at an older backend is still something somebody can do, and there the header is ignored,
 * every screen answers for tenant zero, and a switcher would be a lie. An absent variable must fail
 * safe rather than assume the newer backend.
 *
 * ── WHY THE MODULE IS RE-IMPORTED PER CASE ────────────────────────────────────────────────────
 * `config` is a frozen object built once at module load from `import.meta.env`. Stubbing the
 * environment after that import changes nothing, so each case stubs first and then re-imports
 * through a reset module registry — which is also the only way to observe the fallback at all,
 * since `vitest.config.ts` pins every one of these variables for the suite.
 */

const loadConfig = async () => {
  vi.resetModules();
  const module = await import('./config');
  return module.config;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete window.__APP_CONFIG__;
});

/**
 * Stands in for `/config.js`. The value is typed `unknown` on purpose: the real object comes from a
 * file a container writes, so these cases must be able to hand the reader things the type forbids.
 */
const setRuntimeConfig = (value: unknown) => {
  (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__ = value;
};

describe('the tenant header flag', () => {
  it('falls back to OFF when the variable is absent, because an older backend ignores it', async () => {
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', undefined);

    expect((await loadConfig()).tenantHeaderEnabled).toBe(false);
  });

  it('falls back to OFF for an empty value, which is what an unset line in a .env produces', async () => {
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', '');

    expect((await loadConfig()).tenantHeaderEnabled).toBe(false);
  });

  it.each(['true', '1'])('is on for %s, the two forms the .env files may use', async (value) => {
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', value);

    expect((await loadConfig()).tenantHeaderEnabled).toBe(true);
  });

  it.each(['false', '0', 'yes', 'TRUE', 'on'])(
    'is off for %s — anything that is not exactly true or 1 fails safe',
    async (value) => {
      // `yes`, `TRUE` and `on` look affirmative and are not accepted, deliberately. A flag that
      // guards whose money is on screen should refuse to guess what somebody meant.
      vi.stubEnv('VITE_TENANT_HEADER_ENABLED', value);

      expect((await loadConfig()).tenantHeaderEnabled).toBe(false);
    },
  );
});

describe('the mock API flag', () => {
  it('falls back to OFF, because the mock backend signs anyone in from a table of six codes', async () => {
    vi.stubEnv('VITE_ENABLE_MOCKS', undefined);

    expect((await loadConfig()).enableMocks).toBe(false);
  });

  it('needs a SECOND key before a built bundle may carry mocks', async () => {
    /*
     * `main.tsx` refuses to boot a production build with mocks unless this is also set, and
     * `playwright.config.ts` is the only place that sets it. Pinned here because the whole safety
     * property is that ONE stale `.env` line cannot ship a console that signs anyone in — which
     * stops being true the moment this quietly defaults to on.
     */
    vi.stubEnv('VITE_ALLOW_MOCKS_IN_BUILD', undefined);
    expect((await loadConfig()).allowMocksInBuild).toBe(false);

    vi.stubEnv('VITE_ALLOW_MOCKS_IN_BUILD', 'true');
    expect((await loadConfig()).allowMocksInBuild).toBe(true);
  });
});

describe('the API base url', () => {
  it('strips trailing slashes, which some proxies 404 as a doubled path separator', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com///');

    expect((await loadConfig()).apiBaseUrl).toBe('https://api.example.com');
  });

  it('falls back to localhost rather than to an empty string that would build a relative URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined);

    expect((await loadConfig()).apiBaseUrl).toBe('http://localhost:3000');
  });
});

/**
 * ── RUNTIME CONFIGURATION (`/config.js`) ──────────────────────────────────────────────────────
 * One image now runs against any API: the container writes `window.__APP_CONFIG__` at start and
 * `config.ts` prefers it over the build. These cases pin the order — runtime, then `import.meta.env`,
 * then the compiled fallback — and, above all, that the order applies to four keys and not to the
 * two that decide whether the mock backend may run.
 */
describe('runtime configuration from /config.js', () => {
  it('wins over the build for all four runtime keys', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://built.example.com');
    vi.stubEnv('VITE_APP_NAME', 'Built name');
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', 'false');
    vi.stubEnv('VITE_ENABLE_SHAMCASH_DEV', 'false');
    setRuntimeConfig({
      apiBaseUrl: 'https://api.203-0-113-7.sslip.io/',
      appName: 'Runtime name',
      tenantHeaderEnabled: true,
      shamCashDevEnabled: true,
    });

    const config = await loadConfig();

    // The trailing slash is stripped from a runtime URL exactly as from a built one.
    expect(config.apiBaseUrl).toBe('https://api.203-0-113-7.sslip.io');
    expect(config.appName).toBe('Runtime name');
    expect(config.tenantHeaderEnabled).toBe(true);
    expect(config.shamCashDevEnabled).toBe(true);
  });

  it('can turn a flag OFF that the build turned on, because false is a value and not an absence', async () => {
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', 'true');
    setRuntimeConfig({ tenantHeaderEnabled: false });

    expect((await loadConfig()).tenantHeaderEnabled).toBe(false);
  });

  it('falls through to the build when the placeholder says nothing, which is vite dev and e2e', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://built.example.com');
    vi.stubEnv('VITE_APP_NAME', 'Built name');
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', 'true');
    setRuntimeConfig({});

    const config = await loadConfig();

    expect(config.apiBaseUrl).toBe('https://built.example.com');
    expect(config.appName).toBe('Built name');
    expect(config.tenantHeaderEnabled).toBe(true);
  });

  it('falls through to the compiled fallback when neither runtime nor build say anything', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined);
    vi.stubEnv('VITE_APP_NAME', undefined);
    setRuntimeConfig(undefined);

    const config = await loadConfig();

    expect(config.apiBaseUrl).toBe('http://localhost:3000');
    expect(config.appName).toBe('');
  });

  it('treats an empty runtime string as unset, so it can never build a relative API URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://built.example.com');
    setRuntimeConfig({ apiBaseUrl: '', appName: '' });

    const config = await loadConfig();

    expect(config.apiBaseUrl).toBe('https://built.example.com');
    expect(config.appName).toBe('');
  });

  it('ignores values of the wrong type rather than coercing them', async () => {
    // The object comes from a file. "true" as a STRING is not the boolean the entrypoint writes, and
    // guessing what it meant is exactly what the `bool` rule above refuses to do.
    vi.stubEnv('VITE_API_BASE_URL', 'https://built.example.com');
    vi.stubEnv('VITE_TENANT_HEADER_ENABLED', 'false');
    setRuntimeConfig({ apiBaseUrl: 42, tenantHeaderEnabled: 'true', shamCashDevEnabled: 1 });

    const config = await loadConfig();

    expect(config.apiBaseUrl).toBe('https://built.example.com');
    expect(config.tenantHeaderEnabled).toBe(false);
    expect(config.shamCashDevEnabled).toBe(false);
  });

  it('survives a config.js that set something that is not an object at all', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://built.example.com');
    setRuntimeConfig(null);

    expect((await loadConfig()).apiBaseUrl).toBe('https://built.example.com');
  });

  it('CANNOT turn the mock backend on — neither key is read at runtime', async () => {
    /*
     * The security invariant this whole mechanism was built around. `main.tsx` refuses to start a
     * production bundle with mocks unless `VITE_ALLOW_MOCKS_IN_BUILD` is also set, and that refusal
     * is worth something only while both keys are fixed when the bundle is built. A container's
     * environment is not: if `/config.js` could carry either key, one environment variable on a
     * running container would produce a console that signs anyone in as SUPER_ADMIN with `123456`,
     * and nothing on screen would say so.
     *
     * So every spelling somebody might try is handed to the reader here, and both flags must stay
     * exactly what the build said: off.
     */
    vi.stubEnv('VITE_ENABLE_MOCKS', 'false');
    vi.stubEnv('VITE_ALLOW_MOCKS_IN_BUILD', undefined);
    setRuntimeConfig({
      enableMocks: true,
      allowMocksInBuild: true,
      VITE_ENABLE_MOCKS: 'true',
      VITE_ALLOW_MOCKS_IN_BUILD: 'true',
      apiBaseUrl: 'https://api.example.com',
    });

    const config = await loadConfig();

    expect(config.enableMocks).toBe(false);
    expect(config.allowMocksInBuild).toBe(false);
    // The same object's legitimate key WAS read, so the mock keys were seen and ignored, not missed.
    expect(config.apiBaseUrl).toBe('https://api.example.com');
  });
});
