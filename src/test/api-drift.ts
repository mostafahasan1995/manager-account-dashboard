/**
 * Turns a schema-drift warning into a failing test.
 *
 * ── THE PROBLEM ───────────────────────────────────────────────────────────────────────────────
 * `parseResponse` deliberately never throws. A backend that adds or renames a field must not blank
 * the screen a cashier is working in, so it warns and passes the raw value through, and a missing
 * optional renders as an em dash instead of as a crash. That is right in production and wrong here:
 * a mock handler that has drifted from its own zod schema produced a warning nobody reads and a
 * green build. `client.ts` even claimed "drift is loud in the console and in tests" — in tests it
 * was one line among a thousand passing assertions.
 *
 * The mocks are not a side-show: `npm run dev` in demo mode, the Playwright suite and every
 * component test all run on them. A handler that drifts from `src/types/` is a fixture testing a
 * contract the backend does not have.
 *
 * ── WHY COLLECT-AND-ASSERT RATHER THAN THROW FROM THE WARNING ─────────────────────────────────
 * Throwing inside `console.warn` would raise from within `parseResponse`, i.e. inside application
 * code — where TanStack Query catches it, turns it into an error state, and the component under
 * test renders "something went wrong" and PASSES. The failure would be invisible in exactly the
 * tests that most need it. Collecting and asserting afterwards cannot be caught by anything the
 * app does, and reports every drift in the test rather than only the first.
 *
 * ── WHY THE PREFIX FILTER ─────────────────────────────────────────────────────────────────────
 * Only `[api] ` warnings, which `parseResponse` owns. React's act() warnings, jsdom's "not
 * implemented", and whatever a library decides to say next are somebody else's problem; a setup
 * that failed on all console output would be reverted within a week.
 */

/** The prefix `parseResponse` writes. Kept here so the filter and the producer cannot drift. */
export const API_WARNING_PREFIX = '[api] ';

interface Drift {
  message: string;
  /** `path.to.field: what was wrong`, one per zod issue, so the report names the field. */
  issues: string[];
}

let collected: Drift[] = [];
let allowed = false;
let installed: typeof console.warn | null = null;

const describeIssues = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue) => {
    if (typeof issue !== 'object' || issue === null) return [];
    const { path, message } = issue as { path?: unknown; message?: unknown };
    const where = Array.isArray(path) && path.length > 0 ? path.join('.') : '(root)';
    return typeof message === 'string' ? [`${where}: ${message}`] : [];
  });
};

/** Wraps `console.warn` rather than replacing it: the warning is still printed. */
export function installApiDriftDetector(): void {
  if (installed !== null) return;
  const original = console.warn.bind(console);
  installed = original;

  console.warn = (...args: unknown[]): void => {
    const [first, second] = args;
    if (typeof first === 'string' && first.startsWith(API_WARNING_PREFIX)) {
      collected.push({ message: first, issues: describeIssues(second) });
    }
    original(...args);
  };
}

export function uninstallApiDriftDetector(): void {
  if (installed === null) return;
  console.warn = installed;
  installed = null;
}

/**
 * Opt this ONE test out. Explicit and per-test on purpose: a global switch would be turned on once,
 * during an unrelated debugging session, and never turned off again.
 *
 * The only legitimate callers are the tests that deliberately feed `parseResponse` a bad shape in
 * order to assert what it does with one.
 */
export function allowApiSchemaDrift(): void {
  allowed = true;
}

/** Called from `afterEach`. Throws when drift was seen and not opted out; resets either way. */
export function assertNoApiSchemaDrift(): void {
  const seen = collected;
  const wasAllowed = allowed;
  collected = [];
  allowed = false;

  if (wasAllowed || seen.length === 0) return;

  const report = seen
    .map((drift) => {
      const detail = drift.issues.length > 0 ? `\n    ${drift.issues.join('\n    ')}` : '';
      return `  ${drift.message}${detail}`;
    })
    .join('\n');

  throw new Error(
    `A response did not match its zod schema, so the mock and src/types/ disagree:\n${report}\n\n` +
      'Fix the handler in src/mocks/ or the schema in src/types/ — demo mode and the Playwright ' +
      'suite run on these same handlers. If the test MEANT to send a bad shape, call ' +
      'allowApiSchemaDrift() from @/test/api-drift inside it.',
  );
}
