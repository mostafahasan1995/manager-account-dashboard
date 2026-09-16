import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '@/lib/auth/permissions';

/**
 * The check that keeps `docs/API-CONTRACT.md` honest.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────────────────────────
 * That document opens by claiming everything in it "was read out of the controllers, DTOs and
 * prisma/schema.prisma — not guessed", and it is trusted accordingly: it is what somebody reads
 * before writing a screen. When it went stale it did not become useless, it became misleading,
 * which is worse than having no document. Seven endpoints the console calls every day were missing
 * from it, and nothing anywhere could have said so.
 *
 * A human re-reading both files every few weeks is not a mechanism. This is.
 *
 * ── WHY IT READS THE SOURCE AS TEXT ───────────────────────────────────────────────────────────
 * The paths live inside template literals in function bodies — `/v1/admin/deposits/${id}/claim` —
 * so there is no way to collect them by importing the module short of calling every function with a
 * stubbed transport, which would test the stub. Reading the file is blunt and it is the thing that
 * actually catches a path being added without a line in the doc.
 *
 * ── WHY PARAMETER NAMES ARE ERASED ────────────────────────────────────────────────────────────
 * The code says `${depositId}` where the doc says `:id`. Both are correct and neither is worth
 * arguing about, so every parameter segment is flattened to `*` before comparison. What is being
 * asserted is that the ROUTE is documented, not that two files chose the same variable name.
 */

// From the project root, not from `import.meta.url`: vitest transforms this module, so its own url
// is not a file: url and `fileURLToPath` refuses it. Vitest always runs with cwd at the root.
const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const ENDPOINTS_SOURCE = read('src/lib/api/endpoints.ts');
const CONTRACT = read('docs/API-CONTRACT.md');

/** `/v1/admin/deposits/${id}/claim` and `/v1/admin/deposits/:id/claim` both become `.../*\/claim`. */
const canonical = (path: string): string =>
  path
    .split('/')
    .map((segment) => (segment.startsWith(':') || /^\$\{.*\}$/.test(segment) ? '*' : segment))
    .join('/');

/** Every `/v1/...` or `/health/...` literal in the client, in source order. */
const clientPaths = (): string[] => {
  const matches = ENDPOINTS_SOURCE.matchAll(/[`'"](\/(?:v1|health)\/[^`'"\s]*)[`'"]/g);
  return [...new Set([...matches].map((match) => match[1] ?? ''))].filter(
    (path) => path.length > 0,
  );
};

const documentedPaths = (): Set<string> => {
  const matches = CONTRACT.matchAll(/(\/(?:v1|health)\/[A-Za-z0-9_\-:{}/]*)/g);
  return new Set([...matches].map((match) => canonical((match[1] ?? '').replace(/[.,)]+$/, ''))));
};

describe('every endpoint the console calls', () => {
  it('is written down in docs/API-CONTRACT.md', () => {
    const documented = documentedPaths();
    const missing = clientPaths().filter((path) => !documented.has(canonical(path)));

    // Named, not counted: the failure message has to be the fix list.
    expect(missing).toEqual([]);
  });

  it('found some paths at all, so a silent regex failure cannot pass as success', () => {
    // Without this, renaming `endpoints.ts` or breaking the pattern turns the check above into a
    // test that asserts nothing and stays green forever — the exact failure mode it guards against.
    expect(clientPaths().length).toBeGreaterThan(30);
    expect(documentedPaths().size).toBeGreaterThan(30);
  });
});

describe('every capability the console gates on', () => {
  it('appears in the role table in docs/API-CONTRACT.md', () => {
    // §3 is what somebody reads to decide whether a screen should offer a button. A capability that
    // exists in code and not in that table is a rule nobody outside `permissions.ts` can check.
    const missing = CAPABILITIES.filter((capability) => !CONTRACT.includes(`\`${capability}\``));

    expect(missing).toEqual([]);
  });
});
