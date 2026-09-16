/* global process, console, window, document, URL */
/**
 * Drives a RUNNING dashboard container in headless Chromium and fails on any Content-Security-Policy
 * violation.
 *
 * ── WHY A BROWSER AND NOT CURL ──────────────────────────────────────────────────────────────────
 * curl can prove the CSP header is present. It cannot prove the header lets the app run: a policy one
 * directive too strict is a perfectly valid header that produces a BLANK PAGE in production, and the
 * only place that failure is visible is the browser console. So this opens the real bundle the way an
 * operator would, with the repository's own Playwright:
 *
 *   1. a deep link (/deposits) — the SPA fallback must serve the app and the router must send it to
 *      sign-in;
 *   2. the sign-in form must render — proof the bundle and /config.js both executed;
 *   3. the page must show the API URL from the container's environment — proof the runtime config,
 *      not the build, is what the app is using;
 *   4. submitting the form makes a real cross-origin fetch to that API, which exercises connect-src.
 *      Nothing listens there, so the request fails at the network level; a CSP block would instead
 *      show up as a violation, which is what this counts.
 *
 * Usage: node docker/browser-check.mjs <dashboard-url> <expected-api-base-url>
 * Needs the Chromium that `npx playwright install chromium` provides.
 */
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://localhost:18080';
const expectedApi = process.argv[3] ?? 'http://api.localhost';

const problems = [];
const cspConsole = [];
const pageErrors = [];
const otherConsoleErrors = [];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();

  // Registered before any page script runs, so a violation during the first paint is caught too.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
        source: `${event.sourceFile}:${String(event.lineNumber)}`,
      });
    });
  });
  page.on('console', (message) => {
    const text = message.text();
    if (/content security policy/i.test(text)) cspConsole.push(text);
    else if (message.type() === 'error') otherConsoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}/deposits`, { waitUntil: 'load' });
  if (response?.status() !== 200) problems.push(`deep link returned ${String(response?.status())}`);

  const username = page.getByLabel(/username or email/i);
  try {
    await username.waitFor({ state: 'visible', timeout: 15_000 });
    console.log('ok    sign-in form rendered');
  } catch {
    problems.push('the sign-in form never rendered (blank page?)');
  }
  console.log(`ok    landed on ${new URL(page.url()).pathname}`);

  const runtimeConfig = await page.evaluate(() => window.__APP_CONFIG__);
  console.log(`info  window.__APP_CONFIG__ = ${JSON.stringify(runtimeConfig)}`);

  if ((await page.getByText(expectedApi, { exact: true }).count()) > 0) {
    console.log(`ok    page shows the runtime API URL ${expectedApi}`);
  } else {
    problems.push(`page does not show the runtime API URL ${expectedApi}`);
  }

  if (problems.length === 0) {
    await username.fill('owner');
    await page.getByLabel(/^password$/i).fill('not-a-real-password');
    const apiRequest = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().startsWith(expectedApi),
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      const failed = await apiRequest;
      console.log(
        `ok    sign-in attempted ${failed.method()} ${failed.url()} (failed at network level: ${String(failed.failure()?.errorText)})`,
      );
    } catch {
      problems.push(`submitting the form never attempted a request to ${expectedApi}`);
    }
    await page.waitForTimeout(1_000);
  }

  const violations = await page.evaluate(() => window.__cspViolations);
  if (violations.length > 0) problems.push(`CSP violations: ${JSON.stringify(violations)}`);
  if (cspConsole.length > 0) problems.push(`CSP console messages: ${JSON.stringify(cspConsole)}`);
  if (pageErrors.length > 0) problems.push(`uncaught page errors: ${JSON.stringify(pageErrors)}`);

  console.log(`info  CSP violation events: ${String(violations.length)}`);
  console.log(`info  CSP console messages: ${String(cspConsole.length)}`);
  // Expected: the failed fetch to an API that is not running. Reported, not counted.
  console.log(`info  other console errors (not CSP): ${JSON.stringify(otherConsoleErrors)}`);
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`FAIL\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('PASS  browser check: app rendered with zero Content-Security-Policy violations');
