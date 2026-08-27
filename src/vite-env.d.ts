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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
