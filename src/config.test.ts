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
});

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
