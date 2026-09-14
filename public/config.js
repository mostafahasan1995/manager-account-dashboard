/* global window */
/*
 * Runtime configuration: the PLACEHOLDER.
 *
 * `index.html` loads `/config.js` as a classic script before the app bundle, so a deployed container
 * can hand the SAME image a different API URL without a rebuild. In the container this file is
 * never served — `docker/40-runtime-config.sh` writes a real one from the environment at start, and
 * nginx answers `/config.js` from there instead (the Dockerfile also deletes this copy from the
 * image, so a broken nginx rule shows up as a 404 rather than as a silently empty config).
 *
 * Here, for `vite dev`, `vite preview` and the Playwright suite, it deliberately says NOTHING: every
 * setting then falls through to `import.meta.env` and the compiled fallbacks in `src/config.ts`,
 * exactly as it did before this file existed.
 *
 * Only four keys are ever read from this object — see `RuntimeAppConfig` in `src/config.ts`. The
 * mock flags are not among them and must never be: putting `enableMocks` here does nothing, on
 * purpose.
 */
window.__APP_CONFIG__ = {};
