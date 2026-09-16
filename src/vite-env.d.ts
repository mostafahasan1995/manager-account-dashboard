/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_ENABLE_MOCKS?: string;
  readonly VITE_TENANT_HEADER_ENABLED?: string;
  /**
   * Set by `playwright.config.ts` and by nothing else. It is the second key on the refusal in
   * `main.tsx` that stops a production build shipping the mock backend — declared here so reading
   * it is typed rather than `any`, not so that anybody sets it in a `.env`.
   */
  readonly VITE_ALLOW_MOCKS_IN_BUILD?: string;
  /**
   * Registers the Sham Cash developer bench at /dev/shamcash. Unset everywhere but a developer
   * machine — the screen takes a live cashier session in a form, and with this off the route is
   * not registered at all. The API has its own flag, SHAM_CASH_DEV_CHECK; both must be on.
   */
  readonly VITE_ENABLE_SHAMCASH_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
