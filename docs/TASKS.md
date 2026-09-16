# Task backlog — Cashier Console

Written to be handed, one task at a time, to an implementing agent that has not seen the
conversation this came out of. Every task is self-contained: it states the problem, the evidence,
what "done" means, and the tests that prove it.

**Baseline this was written against**

|                     |                                                                       |
| ------------------- | --------------------------------------------------------------------- |
| Commit              | `2cd2463` (`feat(auth): sign in with an Ichancy agent account, or a bot code`) |
| Date                | 2026-08-25                                                            |
| `npm run typecheck` | clean                                                                 |
| `npm run lint`      | clean                                                                 |
| `npm run test`      | 81 files, 1042 tests, all passing                                     |
| Coverage            | 90.86% statements · 85.19% branches · 90.27% functions · 92.36% lines |
| Coverage gate       | 85 / 80 / 85 / 85 (`vitest.config.ts:41-46`)                          |
| E2E specs           | `auth`, `deposits`, `players`, `platform` only                        |

Nothing here is a bug report against a failing build. The suite is green. These are gaps between
what the code does and what the code says it does, work that was started and left half-wired, and
places where the safety net has holes.

---

## 0. Ground rules for whoever implements these

From `README.md` ("The rules the code follows"). Non-negotiable — a task is not done if it breaks
one of them.

1. **Money is never a number.** Decimal strings and `bigint` minor units, start to finish.
   `src/lib/money.ts` is the only place that parses them.
2. **One API client.** `src/lib/api/client.ts` owns the envelope, the bearer token, the correlation
   id and the `ApiError`. No feature calls `fetch`.
3. **Roles are mirrored, not invented.** `src/lib/auth/permissions.ts` transcribes the backend's
   role constants. Hide what a role cannot do _and_ let the server enforce it.
4. **Filters live in the URL.** Every filter is a shareable link.
5. **Four states, always.** Loading, error, empty, data — explicitly, on every data surface.
6. **Status is a word plus a colour**, never a colour alone.
7. **Arabic is not optional.** `defineMessages({ en, ar })` fails the build when a key is added to
   `en` without an `ar` counterpart. New strings ship in both languages or they do not ship.

### Universal definition of done

Applies to every task below, in addition to its own acceptance criteria:

- [ ] `npm run verify` passes (`typecheck` + `lint` + `test:cov`, coverage gate held).
- [ ] `npm run format:check` passes.
- [ ] `npm run e2e` passes.
- [ ] Every new user-facing string exists in **both** `en` and `ar` in the feature's own
      `messages.ts`.
- [ ] No new `console.log`, no skipped or `.only` tests, no lowered coverage threshold.
- [ ] Any behaviour change that contradicts `README.md`, `docs/API-CONTRACT.md` or
      `docs/TENANT-OPERATIONS.md` updates that document in the same change.

---

## 1. The task standard

Every task in section 3 follows this shape. Use it for new tasks too.

```markdown
### CC-000 — Imperative title, one line, names the outcome not the activity

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| **Type**                            | Defect · Unfinished · Hardening · Enhancement         |
| **Priority**                        | P1 (correctness/honesty) · P2 (real gap) · P3 (hygiene) |
| **Size**                            | S (< half a day) · M (1–2 days) · L (> 2 days)        |
| **Blocked by**                      | task ids, or —                                        |
| **Needs a decision from the owner** | yes / no                                              |

**Problem.** What is wrong, in plain sentences. Why it matters to someone using the console.

**Evidence.** `path/to/file.ts:12` — what is actually there. Verified, never inferred.

**In scope.** The concrete changes.

**Out of scope.** What this task must NOT do, so it cannot grow.

**Acceptance criteria.** Numbered, checkable, each independently testable.

**Test cases.** A table: id · level · given / when / then. Every AC maps to at least one TC.

**Files likely touched.** A starting map, not a straitjacket.
```

---

## 2. Index

| Id                                                                                                     | Title                                                        | Type       | Pri | Size |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------- | --- | ---- |
| [CC-001](#cc-001--settle-the-tenant-header-flag-so-the-config-and-the-docs-agree)                       | Settle the tenant-header flag so the config and the docs agree | Defect     | P1  | S    |
| [CC-002](#cc-002--finish-the-player-credit-feature-or-delete-its-api-layer)                             | Finish the player-credit feature, or delete its API layer    | Unfinished | P1  | M    |
| [CC-003](#cc-003--boolean-url-filters-read-no-as-yes)                                                   | Boolean URL filters read `no` as _yes_                       | Defect     | P2  | S    |
| [CC-004](#cc-004--bring-docsapi-contractmd-back-in-step-with-the-client)                                | Bring `docs/API-CONTRACT.md` back in step with the client    | Defect     | P2  | S    |
| [CC-005](#cc-005--test-the-shared-balance-limiter-directly)                                             | Test the shared balance limiter directly                     | Hardening  | P2  | S    |
| [CC-006](#cc-006--e2e-the-reconciliation-screen)                                                        | E2E the reconciliation screen                                | Hardening  | P2  | M    |
| [CC-007](#cc-007--e2e-the-payment-rails-screen)                                                         | E2E the payment rails screen                                 | Hardening  | P2  | M    |
| [CC-008](#cc-008--e2e-staff-authority-and-approval-limits)                                              | E2E staff authority and approval limits                      | Hardening  | P2  | M    |
| [CC-009](#cc-009--e2e-the-operator-lifecycle-end-to-end)                                                | E2E the operator lifecycle end to end                        | Hardening  | P2  | M    |
| [CC-010](#cc-010--prove-arabic-and-rtl-in-a-real-browser)                                               | Prove Arabic and RTL in a real browser                       | Hardening  | P2  | M    |
| [CC-011](#cc-011--make-schema-drift-fail-the-suite-instead-of-warning-into-the-void)                    | Make schema drift fail the suite instead of warning into the void | Hardening  | P2  | S    |
| [CC-012](#cc-012--check-formatting-in-ci)                                                               | Check formatting in CI                                       | Hardening  | P3  | S    |
| [CC-013](#cc-013--raise-the-coverage-gate-to-what-the-suite-already-holds)                              | Raise the coverage gate to what the suite already holds      | Hardening  | P3  | S    |
| [CC-014](#cc-014--automated-accessibility-checks)                                                       | Automated accessibility checks                               | Hardening  | P3  | M    |
| [CC-015](#cc-015--decide-whether-money-path-posts-carry-an-idempotency-key)                             | Decide whether money-path POSTs carry an Idempotency-Key     | Enhancement | P2  | M    |
| [CC-019](#cc-019--validate-a-payout-address-on-every-crypto-rail-not-on-the-two-the-seeder-named)       | Validate a payout address on every crypto rail, not on the two the seeder named | Defect      | P1  | S    |
| [CC-021](#cc-021--guard-patch-v1adminpayment-destinationsid--it-currently-has-none)                     | Guard `PATCH /v1/admin/payment-destinations/:id` — it currently has none | Defect      | P1  | S    |

Feature tickets (section 4) — raised by the product owner, not found by analysis:

| Id                                                                                    | Title                                                       | Type    | Pri | Size | Repo            |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------- | --- | ---- | --------------- |
| [CC-016](#cc-016--bind-and-verify-the-telegram-group-chats-an-operator-publishes-into) | Bind and verify the Telegram group chats an operator publishes into | Feature | P1  | L    | backend + console |
| [CC-017](#cc-017--make-the-defaults-a-new-operator-inherits-visible-and-editable)      | Make the defaults a new operator inherits visible and editable | Feature | P1  | M    | backend + console |
| [CC-018](#cc-018--usdt-and-usd-rails-and-who-may-change-a-payout-account)              | USDT and USD rails, and who may change a payout account     | Feature | P1  | L    | backend + console |
| [CC-020](#cc-020--let-an-operator-hand-declare-a-balance-for-every-non-chain-payment-account) | Let an operator hand-declare a balance for every non-chain payment account | Feature | P1  | L    | backend + console |

---

## 3. Tasks

### CC-001 — Settle the tenant-header flag so the config and the docs agree

|                                     |            |
| ----------------------------------- | ---------- |
| **Type**                            | Defect     |
| **Priority**                        | P1         |
| **Size**                            | S          |
| **Blocked by**                      | —          |
| **Needs a decision from the owner** | **Yes** — see "The decision" below |

**Problem.**
`VITE_TENANT_HEADER_ENABLED` decides whether the console sends `X-Tenant-Id` and shows the operator
switcher. Four places in this repository disagree about whether the backend is ready for it, and one
of them contradicts itself inside a single file. This is the one flag whose entire purpose is to
stop the console showing one operator's money under another's name, so a repository that cannot
state its own position on it is in the worst possible state.

**Evidence.**

- `.env.local:11-14` — comment: _"LEAVE THIS FALSE until the backend accepts a tenant claim on HTTP
  requests — today it ignores the header and serves tenant zero."_
- `.env.local:15` — `VITE_TENANT_HEADER_ENABLED=true`. The value contradicts the comment three lines
  above it.
- `.env.example:11-18` — a _different_ comment, saying the backend does carry the claim, and the
  value `true`.
- `README.md:118` — the config table still gives the default as `false`, "Leave off — see below".
- `README.md:155-156` and `docs/API-CONTRACT.md:388` — "ships the switcher behind
  `VITE_TENANT_HEADER_ENABLED` (default off)", and §5 still describes the HTTP tenant claim as an
  open backend item.
- `src/config.ts:26` — `bool(...)` with fallback `false`, so the compiled default is off.
- Meanwhile `src/lib/auth/permissions.ts:113-127` (`mayGrantRole`) already reasons about a
  `tenantOverride`, and `PLATFORM_ADMIN` already carries cross-tenant read capabilities — the code
  has moved on from the docs.

**The decision (ask the owner first).**
Verify against the running backend which is true:

- **(a) The backend now reads `X-Tenant-Id` / carries a tenant claim.** Then `true` is correct and
  the READMEs and `docs/API-CONTRACT.md` §5 are stale.
- **(b) It does not yet.** Then both `.env` files are wrong and must go back to `false`.

Do not guess. Cheapest check: sign in as a `PLATFORM_ADMIN`, select a non-home operator in the
switcher, and confirm the deposit queue actually changes rows.

**In scope.**

- Set the flag to the truthful value in `.env.example` and `.env.local`, with a comment that matches
  the value.
- Update `README.md` (the config table and "The tenant gap" section) and `docs/API-CONTRACT.md` §5
  to describe reality.
- If (a): also update `docs/TENANT-OPERATIONS.md` §8, which still lists the HTTP tenant claim as
  open, and confirm `TenantNotice` (`src/components/layout/tenant-notice.tsx`) is correctly silent.
- Add a test that pins the compiled default so this cannot drift silently again.

**Out of scope.**

- Any change to the switcher's behaviour or to `permissions.ts`. This task makes the repository
  honest; it does not change what the console does when the flag is on.

**Acceptance criteria.**

1. `.env.example` and `.env.local` each carry a value and a comment that agree with each other.
2. `README.md:118`, `README.md` "The tenant gap", and `docs/API-CONTRACT.md` §5 all state the same
   thing as the `.env` files.
3. `src/config.ts` `tenantHeaderEnabled` default is asserted by a test.
4. With the flag **off**, `TenantNotice` renders and `TenantSwitcher` renders nothing.
5. With the flag **on**, `TenantNotice` renders nothing and a `PLATFORM_ADMIN` sees the switcher.
6. With the flag **off**, no request carries an `X-Tenant-Id` header even when a tenant is selected.

**Test cases.**

| Id     | Level     | Given / When / Then                                                                                                                       |
| ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TC-1.1 | unit      | Given no `VITE_TENANT_HEADER_ENABLED` in env · When `config` is evaluated · Then `tenantHeaderEnabled === false`.                          |
| TC-1.2 | unit      | Given the flag off and a selected tenant id · When any `api.get` runs · Then the request has no `X-Tenant-Id` header. (Extend `src/lib/api/client.test.ts`.) |
| TC-1.3 | unit      | Given the flag on and tenant `t-2` selected · When any `api.get` runs · Then `X-Tenant-Id: t-2` is sent.                                   |
| TC-1.4 | component | Given the flag off · When `AppShell` renders for a `PLATFORM_ADMIN` · Then the single-tenant notice is visible and no switcher trigger exists. |
| TC-1.5 | component | Given the flag on · When `AppShell` renders for a `SUPER_ADMIN` · Then still no switcher (the backend ignores the header from non-platform roles — `tenant-switcher.tsx:22-26`). |
| TC-1.6 | manual    | Sign in as `PLATFORM_ADMIN` against the real backend, switch operator, confirm the deposit queue rows change. Record the result in the PR description. |

**Files likely touched.**
`.env.example`, `.env.local`, `README.md`, `docs/API-CONTRACT.md`, `docs/TENANT-OPERATIONS.md`,
`src/config.ts`, `src/lib/api/client.test.ts`, `src/components/layout/tenant-switcher.test.tsx`.

---

### CC-002 — Finish the player-credit feature, or delete its API layer

|                                     |                                    |
| ----------------------------------- | ---------------------------------- |
| **Type**                            | Unfinished                         |
| **Priority**                        | P1                                 |
| **Size**                            | M                                  |
| **Blocked by**                      | —                                  |
| **Needs a decision from the owner** | **Yes** — build it or remove it    |

**Problem.**
Crediting a player — sending money out of the agent float and into a player's Ichancy account — has
a complete, carefully documented API layer and **no product on top of it and no mock underneath it**.
Nothing in `src/features/` imports it, `npm run dev` cannot reach it, and the demo/MSW API has no
handler for the route, so the call would 404 in every test, in demo mode and in the Playwright
suite. It is a vertical slice missing its top and its bottom.

This is the mirror of debit, which _is_ finished (`src/features/players/debit-player-dialog.tsx`),
and it is on the money path in the more dangerous direction: a credit sent twice is the operator's
money, not the player's.

**Evidence.**

- `src/types/player.ts:121-139` — `playerCreditSchema`, `PlayerCredit`, `CreditPlayerBody`, all
  defined.
- `src/lib/api/endpoints.ts:194-196` — `playersApi.credit`, with a comment explaining it is "not
  idempotent, not safe to repeat".
- `src/lib/api/queries.ts:268-290` — `useCreditPlayer`, with `retry: false` and invalidation.
- `grep -rn "useCreditPlayer" src --include="*.tsx"` → **no matches**. No component consumes it.
- `src/mocks/handlers.ts` — has `POST /v1/admin/players/:id/debit` (line 583) and **no**
  `POST /v1/admin/players/:id/credit`.
- `src/mocks/db.ts` — has no credit counterpart to its debit function.
- `docs/API-CONTRACT.md` §4 "Players" documents `ichancy-account` and `debit` and does **not**
  document `credit` or `balance`, so the contract does not vouch for either. **Confirm the endpoint
  exists on the backend before building against it** — see CC-004.

**The decision (ask the owner first).**

- **(a) Build it.** Proceed with the scope below.
- **(b) Remove it.** Delete `playersApi.credit`, `useCreditPlayer`, `playerCreditSchema`,
  `PlayerCredit`, `CreditPlayerBody` and their enum references, and note in `docs/API-CONTRACT.md`
  that the console deliberately does not offer manual credits.

**In scope (option a).**

- A `CreditPlayerDialog`, modelled on `debit-player-dialog.tsx`, reachable from the player detail
  page.
- An MSW handler and a `db.ts` mutation for `POST /v1/admin/players/:id/credit`, mirroring the debit
  handler including its `NEEDS_RECONCILIATION` arm and its "agent float too small" refusal.
- The capability gate. Decide and mirror the backend's role list — do **not** invent one. If the
  backend restricts credit to `SUPER_ADMIN`/`FINANCE_ADMIN`, add the capability to `permissions.ts`
  rather than reusing `players.link`.
- Full `en` + `ar` strings in `src/features/players/messages.ts`.
- The confirmation copy must state plainly that the credit is **not repeatable**, in the same voice
  the debit dialog uses.

**Out of scope.**

- Bulk credit, scheduled credit, or crediting from the deposit queue.
- Any change to the debit flow.

**Acceptance criteria.**

1. A player detail page shows a "Credit player" action to roles that hold the capability, and
   nothing at all to roles that do not.
2. The dialog takes an amount in minor units and a mandatory reason, and refuses to submit without
   both.
3. The amount field accepts only what `src/lib/money.ts` accepts; a malformed amount is refused
   client-side with a named error, not sent.
4. On success the dialog reports the outcome using `playerBalanceBeforeMinor` /
   `playerBalanceAfterMinor` and the player's balance is re-read.
5. On `status: 'NEEDS_RECONCILIATION'` the console states that a human must check Ichancy and offers
   **no retry affordance** of any kind.
6. On failure the dialog never auto-retries and never re-enables submit without the operator
   re-confirming the amount.
7. The MSW handler exists, so demo mode and the Playwright suite exercise the same path.
8. Every new string exists in `en` and `ar`.

**Test cases.**

| Id     | Level     | Given / When / Then                                                                                                              |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| TC-2.1 | component | Given a `SUPPORT` session · When the player detail page renders · Then no credit action is present.                              |
| TC-2.2 | component | Given an authorised session · When the dialog opens and submit is pressed with an empty reason · Then submit is refused and the reason field is described as required. |
| TC-2.3 | component | Given the amount `12.3.4` · When submit is pressed · Then the amount is refused client-side and no request is made.               |
| TC-2.4 | component | Given a successful credit of `50000` minor · Then the dialog shows the before and after balances and the player's balance query is invalidated. |
| TC-2.5 | component | Given the server answers `NEEDS_RECONCILIATION` · Then the outcome text names Ichancy as the place to check, and no "try again" button is rendered. |
| TC-2.6 | component | Given the server answers a 5xx · Then the error is shown with its correlation id and **exactly one** request was made.           |
| TC-2.7 | unit      | Given the MSW handler · When `POST /players/:id/credit` is called with an amount above the mocked agent float · Then it answers the refusal shape, not a success. |
| TC-2.8 | e2e       | Credit a player from the players screen and see the balance change in the table.                                                 |
| TC-2.9 | build     | Removing the `ar` half of any new key fails `npm run typecheck`.                                                                 |

**Files likely touched.**
`src/features/players/credit-player-dialog.tsx` (new), `src/features/players/player-detail-page.tsx`,
`src/features/players/messages.ts`, `src/lib/auth/permissions.ts`, `src/mocks/handlers.ts`,
`src/mocks/db.ts`, `docs/API-CONTRACT.md`, `e2e/players.spec.ts`.

---

### CC-003 — Boolean URL filters read `no` as _yes_

|                                     |        |
| ----------------------------------- | ------ |
| **Type**                            | Defect |
| **Priority**                        | P2     |
| **Size**                            | S      |
| **Blocked by**                      | —      |
| **Needs a decision from the owner** | No     |

**Problem.**
`optionalBool` in the URL search schemas is `z.coerce.boolean()`, which is `Boolean(value)`. Any
non-empty string that is not valid JSON becomes `true`. TanStack Router `JSON.parse`s each search
value and falls back to the raw string, so `?linked=true` and `?linked=false` are fine — but
`?linked=no`, `?unclaimedOnly=False` and `?isActive=off` all arrive as strings and are read as
**true**. A link that says "not linked" filters to "linked", silently.

The console's own UI always writes real JSON booleans, so this only bites a hand-typed or
hand-edited link. But "a reviewer can send a colleague the exact queue they are looking at" is a
stated design property of this codebase (`README.md`, rule 4), and `search-schemas.ts:38-45` already
goes to some trouble to make _string_ filters survive the router's parsing. Booleans were missed.

**Evidence.**

- `src/app/search-schemas.ts:51` — `const optionalBool = z.coerce.boolean().optional().catch(undefined);`
- Used by `depositSearchSchema.unclaimedOnly`, `playerSearchSchema.linked`,
  `staffSearchSchema.isActive`, `paymentMethodSearchSchema.isActive` /
  `includeInactiveDestinations`, `tenantSearchSchema.create`.
- Measured, zod 4: `'false' → true`, `'no' → true`, `'0' → true`, `false → false`, `0 → false`.
- Measured, `parseSearchWith(JSON.parse)`: `?linked=no → {linked:"no"}`,
  `?unclaimedOnly=False → {unclaimedOnly:"False"}`.
- `src/app/search-schemas.test.ts` has no case for a boolean filter arriving as a non-JSON string.

**In scope.**

- Replace `optionalBool` with a parser that accepts real booleans, and the strings `'true'`,
  `'false'`, `'1'`, `'0'` (case-insensitively), and treats anything else as **absent** — the same
  "unparseable falls back to the default view" rule the file already states at line 20.
- Tests for every filter that uses it.

**Out of scope.**

- Changing which filters exist, or how the UI writes them.

**Acceptance criteria.**

1. `?linked=false`, `?linked=FALSE`, `?linked=0` all parse to `false`.
2. `?linked=true`, `?linked=TRUE`, `?linked=1` all parse to `true`.
3. `?linked=no`, `?linked=maybe`, `?linked=` all parse to `undefined` (filter absent), never `true`.
4. A real boolean `false` still parses to `false`, and `pruneSearch({ unclaimedOnly: false })` still
   keeps the key (`search-schemas.test.ts:145`).
5. Every schema using `optionalBool` is covered by at least one case.

**Test cases.**

| Id     | Level | Given / When / Then                                                                                             |
| ------ | ----- | ---------------------------------------------------------------------------------------------------------------- |
| TC-3.1 | unit  | Table-driven over `['false','FALSE','0',false,0]` → `false`.                                                     |
| TC-3.2 | unit  | Table-driven over `['true','TRUE','1',true,1]` → `true`.                                                         |
| TC-3.3 | unit  | Table-driven over `['no','off','maybe','']` → `undefined`.                                                       |
| TC-3.4 | unit  | `depositSearchSchema.parse({ unclaimedOnly: 'no' })` → `unclaimedOnly` is `undefined`.                            |
| TC-3.5 | unit  | Same for `playerSearchSchema.linked`, `staffSearchSchema.isActive`, `paymentMethodSearchSchema.isActive` and `includeInactiveDestinations`, `tenantSearchSchema.create`. |
| TC-3.6 | e2e   | Open `/players?linked=no` · Then the screen shows the unfiltered list, not the linked-only list.                  |

**Files likely touched.**
`src/app/search-schemas.ts`, `src/app/search-schemas.test.ts`, `e2e/players.spec.ts`.

---

### CC-004 — Bring `docs/API-CONTRACT.md` back in step with the client

|                                     |                                                          |
| ----------------------------------- | -------------------------------------------------------- |
| **Type**                            | Defect                                                   |
| **Priority**                        | P2                                                       |
| **Size**                            | S                                                        |
| **Blocked by**                      | CC-001, CC-002 (settle those decisions first, then write them down) |
| **Needs a decision from the owner** | No                                                       |

**Problem.**
`docs/API-CONTRACT.md` opens by claiming everything in it "was read out of the controllers, DTOs and
`prisma/schema.prisma` — not guessed." Two endpoints the client calls today are not in it, and its
§5 describes a state of the world the rest of the repository has moved past. A contract document
that is trusted and stale is more dangerous than no document.

**Evidence.**

- `src/lib/api/endpoints.ts:206-215` calls `GET /v1/admin/players/:id/balance` — not documented.
- `src/lib/api/endpoints.ts:194-196` calls `POST /v1/admin/players/:id/credit` — not documented.
- `src/types/player.ts:141+` documents the balance shape in code comments only.
- `docs/API-CONTRACT.md:380-401` (§5) still describes the HTTP tenant claim as open, while
  `.env.example` asserts the opposite and `permissions.ts` already models a tenant override.
- `docs/TENANT-OPERATIONS.md` is dated "Status, 2026-08-22" and its §6 endpoints are all now
  implemented in `tenantsApi` (`endpoints.ts:400+`) — that part is in step; §8 needs re-checking.

**In scope.**

- Document `GET /players/:id/balance` and `POST /players/:id/credit` in §4: path, query, response
  shape, role list, and the repeatability warning credit needs.
- Re-check §5 against the answer settled in CC-001 and rewrite it.
- Re-check `docs/TENANT-OPERATIONS.md` §8 against the current backend and re-date the status line.
- Confirm the role table in §3 still matches `src/lib/auth/permissions.ts` — in particular the
  `PLATFORM_ADMIN` read capabilities, which the code now grants (`permissions.ts:52-70`) and the
  table's "Tenants: everything" row does not mention.

**Out of scope.**

- Changing any client behaviour. This task only writes down what is already true.

**Acceptance criteria.**

1. Every function exported from `src/lib/api/endpoints.ts` corresponds to a documented endpoint.
2. Every capability in `ROLE_CAPABILITIES` is reflected in the §3 role table.
3. §5 states the actual current position on the tenant claim, dated.
4. `docs/TENANT-OPERATIONS.md` §8 is re-verified and re-dated.

**Test cases.**

| Id     | Level      | Given / When / Then                                                                                                                                                                 |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-4.1 | unit (new) | A test that walks the exported keys of `depositsApi`, `playersApi`, `paymentMethodsApi`, `adminsApi`, `reconciliationApi`, `tenantsApi` and asserts each path string appears in `docs/API-CONTRACT.md`. This is the mechanism that stops the drift recurring — prefer it to a manual check. |
| TC-4.2 | unit (new) | A test asserting every `Capability` in `CAPABILITIES` appears in the §3 table.                                                                                                        |
| TC-4.3 | review     | A human confirms §5 against the running backend.                                                                                                                                     |

**Files likely touched.**
`docs/API-CONTRACT.md`, `docs/TENANT-OPERATIONS.md`, `src/lib/api/endpoints.contract.test.ts` (new).

---

### CC-005 — Test the shared balance limiter directly

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | S         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
`src/lib/concurrency.ts` is the gate that stops the players table firing a page of Ichancy balance
reads at once and earning Cloudflare challenges instead of numbers. It has **no test file**. Its
coverage — 66.66% statements, 50% functions — comes entirely from incidental exercise by the players
tests, and the two properties that actually matter (the ceiling is never exceeded; a failing task
returns its slot) are not asserted anywhere. Its own doc comment says `active` and `waiting` exist
"for tests and diagnostics"; there are no tests.

A limiter that leaks a slot wedges the whole balance column after the first 429 — silently, and only
in production, because nothing here would catch it.

**Evidence.**
`src/lib/concurrency.ts` (75 lines, no sibling `concurrency.test.ts`); coverage report row
`concurrency.ts | 66.66 | 62.5 | 50 | 69.56 | 31,50-53,70-73`.

**In scope.**
A `src/lib/concurrency.test.ts` covering the limiter's contract, plus one test that
`BALANCE_CONCURRENCY` is actually applied by `playersApi.balance`.

**Out of scope.**
Changing `createLimiter`'s behaviour. If a test reveals a defect, raise it as a new task rather than
fixing it inside a test-only change.

**Acceptance criteria.**

1. Never more than `max` tasks run concurrently, verified with deferred promises rather than timers.
2. Tasks start in FIFO order (the code shifts, deliberately — `concurrency.ts:40-44`).
3. A task that **rejects** returns its slot: a queued task still runs afterwards.
4. A task that throws synchronously also returns its slot.
5. `createLimiter(0)`, `createLimiter(-1)` and `createLimiter(1.5)` each throw `RangeError`.
6. `active` and `waiting` report correctly while tasks are pending.
7. `playersApi.balance` rejects with `AbortError` when its signal aborts **while queued**, and does
   not consume a slot on a request nobody is waiting for (`endpoints.ts:207-214`).
8. `concurrency.ts` reaches 100% statements and functions.

**Test cases.**

| Id     | Level | Given / When / Then                                                                                                                    |
| ------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TC-5.1 | unit  | Given `createLimiter(2)` and 5 never-resolving tasks · Then exactly 2 started, `active === 2`, `waiting === 3`.                         |
| TC-5.2 | unit  | Given the above · When task 1 resolves · Then task 3 starts (FIFO), not task 5.                                                        |
| TC-5.3 | unit  | Given `createLimiter(1)` and a task that rejects · When it rejects · Then the queued task runs and the rejection still surfaces to its own caller. |
| TC-5.4 | unit  | Given a task that throws synchronously · Then the slot is released.                                                                    |
| TC-5.5 | unit  | `createLimiter(0 / -1 / 1.5 / NaN)` each throw `RangeError`.                                                                           |
| TC-5.6 | unit  | Given a limiter at capacity and an already-aborted signal on a queued balance read · When a slot frees · Then it rejects `AbortError` and performs no fetch. |
| TC-5.7 | unit  | Given 10 concurrent `playersApi.balance` calls against MSW · Then the maximum observed in-flight count is `BALANCE_CONCURRENCY`.        |

**Files likely touched.**
`src/lib/concurrency.test.ts` (new), `src/lib/api/endpoints.test.ts` (new or extended).

---

### CC-006 — E2E the reconciliation screen

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
The Playwright suite covers `auth`, `deposits`, `players` and `platform`. Reconciliation — breaks,
float sync, rail ageing and the ledger invariant checks — has component tests but has never been
driven through the real bundle. It is the screen that decides whether the books are believed, and it
is the screen with the most tabs, the most filters and the most write actions.

**Evidence.**
`e2e/` contains `auth.spec.ts`, `deposits.spec.ts`, `players.spec.ts`, `platform.spec.ts`,
`fixtures.ts` — and nothing else. Component tests exist for every reconciliation part
(`src/features/reconciliation/*.test.tsx`).

**In scope.**
`e2e/reconciliation.spec.ts` covering the three tabs, the URL contract, and the write actions against
the MSW mock API.

**Out of scope.**
New reconciliation features; changes to the mock fixtures beyond what the spec needs.

**Acceptance criteria.**

1. The breaks list renders with its severity, category and status, and the tab lives in the URL
   (`reconciliationSearchSchema.tab`).
2. Filtering by status/category/severity narrows the list and lands in the URL; reloading that URL
   reproduces the same list.
3. Opening a break opens the detail sheet as a shareable link (`?selected=`), and Escape closes it
   and cleans the URL.
4. Resolving a break requires a note and removes it from the open list.
5. "Sync agent float" reports its delta and says whether it is below the watermark.
6. The rail-ageing tab renders its buckets and names stale account codes.
7. "Run invariant checks" renders both the clean and the violating outcome.
8. A `VIEWER` (read-only on reconciliation, per `permissions.ts:101`) sees the data and none of the
   act buttons.

**Test cases.**

| Id     | Level | Given / When / Then                                                                                          |
| ------ | ----- | -------------------------------------------------------------------------------------------------------------- |
| TC-6.1 | e2e   | Signed in · When `/reconciliation` opens · Then open breaks are listed with a status word, not just a colour.  |
| TC-6.2 | e2e   | When the tab is switched to Rail ageing · Then the URL carries `tab=ageing` and a reload keeps that tab.       |
| TC-6.3 | e2e   | When severity is filtered to ≥4 · Then lower-severity rows disappear and the URL carries `minSeverity=4`.      |
| TC-6.4 | e2e   | When a break row is clicked · Then `?selected=` appears and the detail sheet shows the expected/actual/delta.  |
| TC-6.5 | e2e   | When Escape is pressed · Then the sheet closes and `selected` leaves the URL.                                  |
| TC-6.6 | e2e   | When resolve is submitted with an empty note · Then it is refused; with a note · Then the break leaves the open list. |
| TC-6.7 | e2e   | When float sync runs · Then the delta and the watermark verdict are both shown.                                |
| TC-6.8 | e2e   | When invariants run against a fixture with a violation · Then the violation is named with its subject and delta. |
| TC-6.9 | e2e   | Signed in as `VIEWER` · Then resolve / assign / sync / correct controls are absent.                            |

**Files likely touched.**
`e2e/reconciliation.spec.ts` (new), `e2e/fixtures.ts`, possibly `src/mocks/fixtures.ts`.

---

### CC-007 — E2E the payment rails screen

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
Payment methods and destinations are where a deposit's money is actually _sent_. A wrong
`accountIdentifier` on an active destination misroutes real transfers. The screen has component
tests and no end-to-end coverage.

**In scope.**
`e2e/payment-methods.spec.ts` covering the method list, the destination list, create/edit for both,
the immutability rules and the deactivate-not-delete rule.

**Acceptance criteria.**

1. Methods list with their rail, currency and active state; the rail and active filters land in the
   URL.
2. Selecting a method opens its destinations as a shareable link (`?selected=`), and
   `includeInactiveDestinations` is honoured from the URL.
3. Creating a method enforces `code` as SCREAMING_SNAKE and rejects a lowercase code client-side.
4. Editing a method offers **no** field for `code`, `rail` or `currencyCode` — they are immutable
   (`docs/API-CONTRACT.md` §4).
5. Editing a destination offers no field for `accountIdentifier` — immutable.
6. Deactivating a method or destination removes it from the default view but it reappears with the
   include-inactive filter; nothing is described as "deleted".
7. Amount fields (min/max, daily cap) reject a malformed decimal client-side.
8. A `SUPPORT` role (read only, `permissions.ts:99`) sees the lists and no write controls.

**Test cases.**

| Id     | Level | Given / When / Then                                                                                 |
| ------ | ----- | ----------------------------------------------------------------------------------------------------- |
| TC-7.1 | e2e   | `/payment-methods` lists a method with its rail and currency.                                        |
| TC-7.2 | e2e   | Filtering by rail lands in the URL and a reload reproduces it.                                        |
| TC-7.3 | e2e   | Selecting a method shows its destinations and `?selected=` in the URL.                                |
| TC-7.4 | e2e   | Creating a method with code `bank_syr` is refused before any request.                                 |
| TC-7.5 | e2e   | The edit dialog for an existing method has no code / rail / currency inputs.                          |
| TC-7.6 | e2e   | The edit dialog for a destination has no account-identifier input.                                    |
| TC-7.7 | e2e   | Deactivating a destination removes it from the list; enabling "show inactive" brings it back marked inactive. |
| TC-7.8 | e2e   | A daily cap of `10.00.00` is refused client-side.                                                     |
| TC-7.9 | e2e   | Signed in as `SUPPORT` · Then no create / edit / deactivate controls.                                 |

**Files likely touched.**
`e2e/payment-methods.spec.ts` (new), `e2e/fixtures.ts`.

---

### CC-008 — E2E staff authority and approval limits

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
Approval limits are the mechanism that bounds who may decide money. They are versioned — setting one
closes the previous version and history is never rewritten — and an admin with no open version
cannot approve anything at all. That is subtle, it is rendered as a timeline rather than a form, and
it has never been driven end to end.

**Evidence.**
`docs/API-CONTRACT.md` §4 "Approval limits"; `src/features/staff/approval-limit-timeline.tsx`
(96.55% statements, no e2e).

**In scope.**
`e2e/staff.spec.ts` covering the directory, its filters, the admin dialog's role rules, and the
approval-limit timeline.

**Acceptance criteria.**

1. The staff list renders with roles and active state; role and active filters land in the URL.
2. Adding an administrator refuses an empty Telegram id and an empty display name.
3. The role picker offers `PLATFORM_ADMIN` **only** when `mayGrantRole` allows it — i.e. the actor
   holds it and no tenant override is selected (`permissions.ts:113-127`).
4. Opening an admin shows their approval-limit history newest first, with the open version marked.
5. Setting a new limit adds a version and marks the previous one closed; the previous one is still
   visible.
6. Ending the open limit leaves the admin with no open version, and the UI says so in words.
7. A `FINANCE_ADMIN` (reads the directory, cannot write it — `permissions.ts:85-88`) sees the list
   and the timeline and no write controls.
8. `ADMIN_SELF_MODIFICATION` and `ADMIN_LAST_SUPER_ADMIN` errors are shown as sentences that name who
   can fix them, not as raw codes.

**Test cases.**

| Id     | Level | Given / When / Then                                                                              |
| ------ | ----- | -------------------------------------------------------------------------------------------------- |
| TC-8.1 | e2e   | `/staff` lists admins with role and status; `?role=REVIEWER` narrows it.                          |
| TC-8.2 | e2e   | The add dialog refuses an empty Telegram id.                                                       |
| TC-8.3 | e2e   | Signed in as `SUPER_ADMIN` · Then the role picker has no `PLATFORM_ADMIN` option.                  |
| TC-8.4 | e2e   | Signed in as `PLATFORM_ADMIN` with no tenant selected · Then `PLATFORM_ADMIN` is offered.          |
| TC-8.5 | e2e   | Opening an admin shows the limit timeline newest first.                                            |
| TC-8.6 | e2e   | Setting a limit adds a version; the previous one is still listed and marked closed.                |
| TC-8.7 | e2e   | Ending the open limit leaves a stated "cannot approve anything" condition.                         |
| TC-8.8 | e2e   | Signed in as `FINANCE_ADMIN` · Then no add / edit / set-limit controls.                            |
| TC-8.9 | e2e   | Deactivating the last super admin surfaces the `ADMIN_LAST_SUPER_ADMIN` refusal in plain words.    |

**Files likely touched.**
`e2e/staff.spec.ts` (new), `e2e/fixtures.ts`, `src/mocks/handlers.ts` (if the error arms need mocking).

---

### CC-009 — E2E the operator lifecycle end to end

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
`docs/TENANT-OPERATIONS.md` §7 lays out a seven-step loop for bringing an operator online: create,
register webhook, push command menus, add yourself as an admin, activate, sign in. The console
implements all of it — `tenant-setup-checklist.tsx`, `tenant-telegram-panel.tsx`,
`tenant-ichancy-panel.tsx`, `add-me-admin-dialog.tsx`, `tenant-status-actions.tsx`.
`e2e/platform.spec.ts` covers four assertions and none of that sequence. It is the
highest-consequence flow in the product and the least end-to-end-tested.

**Evidence.**
`e2e/platform.spec.ts` is 61 lines and tests: landing on `/tenants`, switching operator,
staff-not-money, switcher hidden from non-platform roles. `src/features/tenants/tenant-operations.tsx`
sits at 76.66% statements / 60% functions — the lowest in the feature tree.

**In scope.**
`e2e/tenants.spec.ts` walking the whole §7 loop against the mock API.

**Acceptance criteria.**

1. Creating an operator needs only display name, bot token, Ichancy username and password; the
   Advanced section states what each blank field will be filled with.
2. The created operator lands **SUSPENDED**, and the list says so.
3. The detail panel shows the server-resolved defaults (slug, currency, thresholds, expiry) read back
   from the create response.
4. The setup checklist reflects real state: `hasWebhookPath` is **not** shown as delivery status;
   delivery is `health.bot.webhookMatches` (`docs/TENANT-OPERATIONS.md` §6.6).
5. Register webhook → the panel reports the URL and `registered: true`; remove webhook → it reports a
   **null** URL as "not configured", never as an empty string.
6. Push command menus reports how many commands were set.
7. "Add me as an admin here" creates a `SUPER_ADMIN` inside the new operator.
8. Activate verifies the agent and flips the status to ACTIVE; a failing verification leaves it
   SUSPENDED with the reason named.
9. `sharesAgentWith` is rendered as operator **slugs** and explains the shared Ichancy session (§6.1).
10. `floatMinor: null` is rendered as "no comparison was possible", never as healthy (§6.3).
11. Changing the agent id on an operator with linked players surfaces `TENANT_AGENT_HAS_PLAYERS` with
    the player count (§6.4).
12. A bad bot token surfaces as a field-level validation message (§6.5).

**Test cases.**

| Id      | Level | Given / When / Then                                                                       |
| ------- | ----- | ------------------------------------------------------------------------------------------- |
| TC-9.1  | e2e   | Create with the four required fields · Then the new row appears, SUSPENDED.                |
| TC-9.2  | e2e   | The Advanced section names the default each blank field resolves to.                        |
| TC-9.3  | e2e   | The detail panel shows a resolved slug and currency straight after create.                  |
| TC-9.4  | e2e   | Before registering, the checklist does not claim delivery is configured.                    |
| TC-9.5  | e2e   | Register webhook · Then the URL and registered state are shown.                             |
| TC-9.6  | e2e   | Remove webhook · Then it reads "not configured", with no empty-string URL.                  |
| TC-9.7  | e2e   | Push menus · Then the command count is reported.                                            |
| TC-9.8  | e2e   | Add-me-as-admin · Then a `SUPER_ADMIN` row exists for that operator.                        |
| TC-9.9  | e2e   | Activate · Then status is ACTIVE.                                                           |
| TC-9.10 | e2e   | Activate against a mocked signin failure · Then it stays SUSPENDED and the reason is named. |
| TC-9.11 | e2e   | An operator sharing an agent shows the other operator's slug and the session warning.       |
| TC-9.12 | e2e   | Health with `floatMinor: null` is not rendered as healthy.                                  |
| TC-9.13 | e2e   | Changing the agent id with players present shows the count that would be orphaned.          |
| TC-9.14 | e2e   | An invalid bot token shows a field-level message, not a generic failure.                    |

**Files likely touched.**
`e2e/tenants.spec.ts` (new), `e2e/fixtures.ts`, `src/mocks/handlers.ts`, `src/mocks/db.ts`.

---

### CC-010 — Prove Arabic and RTL in a real browser

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
The Arabic half of the console is guarded by the compiler — `defineMessages` will not accept an `en`
key without an `ar` counterpart — which guarantees the _strings exist_. It guarantees nothing about
the _layout_. `src/lib/i18n/locales.ts` states the intent plainly: "the whole console mirrors …
half-mirrored is worse than not mirrored", and "numbers stay Western, in both languages". Neither is
asserted anywhere. No test switches the locale and looks at a rendered page.

**Evidence.**
`src/lib/i18n/i18n.test.ts` (211 lines) tests the message machinery — plurals, interpolation,
fallback — not rendered direction. No e2e spec sets a locale.

**In scope.**
An `e2e/i18n.spec.ts` plus a small number of component-level direction assertions.

**Acceptance criteria.**

1. Switching to Arabic sets `dir="rtl"` and `lang="ar"` on the document element.
2. The sidebar renders on the trailing edge in Arabic and the leading edge in English.
3. Pagination chevrons point the correct way in each direction.
4. Amounts render with **Western digits** in both locales (`1,500.00`, never `١٬٥٠٠٫٠٠`).
5. Dates and relative times render in Arabic words with Western digits.
6. The language choice survives a reload.
7. No English string is visible on the deposit queue, the players list or the login screen in Arabic
   mode.
8. Table columns, dialog close buttons and the review sheet all mirror — spot-check the three most
   complex surfaces, not every screen.

**Test cases.**

| Id      | Level     | Given / When / Then                                                                            |
| ------- | --------- | ------------------------------------------------------------------------------------------------ |
| TC-10.1 | e2e       | Switch to Arabic · Then `document.documentElement` has `dir="rtl"` and `lang="ar"`.             |
| TC-10.2 | e2e       | In Arabic · Then the sidebar's bounding box is on the right of the viewport.                    |
| TC-10.3 | e2e       | In Arabic on the deposits queue · Then an amount cell matches `/[0-9]/` and not `/[٠-٩]/`.      |
| TC-10.4 | e2e       | In Arabic · Then a relative time reads in Arabic words.                                          |
| TC-10.5 | e2e       | Reload after switching · Then Arabic persists.                                                  |
| TC-10.6 | e2e       | In Arabic on `/deposits` · Then no element text matches a known English label list.             |
| TC-10.7 | component | Render the review sheet under each direction · Then logical-property classes resolve to mirrored physical sides. |
| TC-10.8 | e2e       | In Arabic · Then the "next page" chevron points left.                                           |

**Files likely touched.**
`e2e/i18n.spec.ts` (new), `e2e/fixtures.ts`, `src/lib/i18n/i18n.test.ts`,
`src/components/common/pagination.tsx` tests.

---

### CC-011 — Make schema drift fail the suite instead of warning into the void

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P2        |
| **Size**                            | S         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
`parseResponse` deliberately never throws: a backend that changes shape must not blank the screen a
cashier is working in, so it `console.warn`s and passes the raw value through
(`src/lib/api/client.ts:200-215`). That is right for production and wrong for the test suite, where a
mock handler that drifts from its zod schema produces a warning nobody reads and a green build. The
comment even claims "drift is loud in the console and in tests" — in tests it is not; it is a warning
among 1042 passing assertions.

**Evidence.**
`src/lib/api/client.ts:204-214` — `console.warn` then `return value as T`. `src/test/setup.ts` does
not fail on console output.

**In scope.**

- Fail the vitest run when `parseResponse` warns: either a spy in `src/test/setup.ts` that throws on
  that specific warning, or an opt-in strict mode the test setup enables.
- Fix whatever drift this exposes between `src/mocks/` and `src/types/`.

**Out of scope.**

- Changing production behaviour. The console must still degrade gracefully against a real backend.
- Failing the suite on _unrelated_ console warnings (React's, a library's). Scope the assertion to
  the `[api]` prefix.

**Acceptance criteria.**

1. A mock handler returning a shape that violates its schema fails the test that calls it, naming the
   endpoint and the offending field.
2. Production behaviour is unchanged: a drifted response still reaches the UI with a warning.
3. The whole existing suite passes with the new check on — any drift it uncovers is fixed, not
   suppressed.
4. The escape hatch, if any, is explicit and per-test, not global.

**Test cases.**

| Id      | Level | Given / When / Then                                                                                                  |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| TC-11.1 | unit  | Given a handler that omits a required field · When the endpoint is called in a test · Then the test fails with the endpoint name in the message. |
| TC-11.2 | unit  | Given `parseResponse` outside the test setup · Then it still returns the raw value and does not throw.                 |
| TC-11.3 | suite | `npm run test` is green with the check enabled.                                                                       |

**Files likely touched.**
`src/test/setup.ts`, `src/lib/api/client.ts`, `src/lib/api/client.test.ts`, `src/mocks/handlers.ts`.

---

### CC-012 — Check formatting in CI

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P3        |
| **Size**                            | S         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
`package.json` defines `format:check`, and `.github/workflows/ci.yml` never runs it. Formatting
drifts into review diffs, where it costs attention that should go to the money path.

**Evidence.**
`package.json` scripts: `"format:check": "prettier --check \"src/**/*.{ts,tsx,css}\""`.
`.github/workflows/ci.yml` `verify` job runs `typecheck`, `lint`, `test:cov` only.

Note the existing `format:check` glob covers `src/` only, while `format` also writes `e2e/**/*.ts`
and the root config files. The check should cover the same set the writer does, or the two commands
disagree about what "formatted" means.

**In scope.**

- Widen `format:check` to match `format`'s file set.
- Add a `Format` step to the `verify` job, before or alongside `Lint`.
- Run `npm run format` once and commit the result if anything changes.

**Acceptance criteria.**

1. `npm run format:check` and `npm run format` cover the same files.
2. CI fails on an unformatted file in `src/`, `e2e/` or the root configs.
3. The repository is clean under the widened check at the time the task lands.

**Test cases.**

| Id      | Level | Given / When / Then                                                                |
| ------- | ----- | ------------------------------------------------------------------------------------ |
| TC-12.1 | ci    | Given a deliberately misformatted `e2e/*.ts` on a branch · Then CI fails at the Format step. |
| TC-12.2 | local | `npm run format:check` exits 0 on a clean tree.                                      |

**Files likely touched.**
`package.json`, `.github/workflows/ci.yml`.

---

### CC-013 — Raise the coverage gate to what the suite already holds

|                                     |                                                    |
| ----------------------------------- | -------------------------------------------------- |
| **Type**                            | Hardening                                          |
| **Priority**                        | P3                                                 |
| **Size**                            | S                                                  |
| **Blocked by**                      | CC-005 (raise once, after the limiter tests land)   |
| **Needs a decision from the owner** | No                                                 |

**Problem.**
The gate is 85/80/85/85. The suite actually holds 90.86 statements, 85.19 branches, 90.27 functions,
92.36 lines. That is roughly six points of slack in which coverage can silently fall without CI
noticing — and `README.md` states the rule for this file: "Raise it, do not lower it."

**Evidence.**
`vitest.config.ts:41-46` vs the measured summary in the baseline table at the top of this file.

**In scope.**
Raise the thresholds to just under the current measurements (a point of headroom, no more), and
record the new numbers in `README.md`.

**Out of scope.**
Writing tests purely to move the number. If a threshold cannot be raised without new tests, raise it
to what is held today and leave the rest.

**Acceptance criteria.**

1. Thresholds are raised to within ~1 point of the measured values.
2. `npm run test:cov` passes on a clean checkout.
3. `README.md`'s "gated at …" line matches `vitest.config.ts`.
4. A deliberately deleted test file makes the gate fail.

**Test cases.**

| Id      | Level  | Given / When / Then                                              |
| ------- | ------ | ------------------------------------------------------------------ |
| TC-13.1 | ci     | `npm run test:cov` passes at the new thresholds.                  |
| TC-13.2 | ci     | Deleting `src/lib/money.test.ts` locally makes `test:cov` fail.   |
| TC-13.3 | review | `README.md` and `vitest.config.ts` state the same numbers.        |

**Files likely touched.**
`vitest.config.ts`, `README.md`.

---

### CC-014 — Automated accessibility checks

|                                     |           |
| ----------------------------------- | --------- |
| **Type**                            | Hardening |
| **Priority**                        | P3        |
| **Size**                            | M         |
| **Blocked by**                      | —         |
| **Needs a decision from the owner** | No        |

**Problem.**
The console is built on Radix primitives precisely so that dialogs, menus and selects are accessible
without reimplementing focus traps, and its component tests query by role throughout — both good
signs. But nothing _checks_: there is no axe dependency and no automated assertion about contrast,
labelling, focus order or landmark structure. A screen used for a whole shift, in two directions,
with a keyboard, deserves the check.

**Evidence.**
`package.json` contains no `axe` dependency of any kind.

**In scope.**

- Add `@axe-core/playwright` and run a scan on each main screen in the e2e suite, in both `ltr` and
  `rtl`.
- Fix the serious and critical violations it reports.
- Assert keyboard reachability for the deposit review flow specifically — it is the flow an operator
  repeats hundreds of times a shift.

**Out of scope.**

- Chasing every "minor" and "moderate" axe finding. Land serious/critical first; log the rest.
- A visual redesign.

**Acceptance criteria.**

1. An axe scan runs against Overview, Deposits, Players, Payment rails, Reconciliation, Staff,
   Tenants, Settings and Login.
2. Zero `serious` or `critical` violations on those screens, in both directions.
3. The deposit queue → claim → review → approve path is completable with the keyboard alone.
4. Focus returns to the invoking control when a dialog or sheet closes.
5. The scan is part of `npm run e2e` and fails CI on a regression.

**Test cases.**

| Id      | Level | Given / When / Then                                                             |
| ------- | ----- | --------------------------------------------------------------------------------- |
| TC-14.1 | e2e   | Each listed screen · axe scan · Then no serious/critical violations.             |
| TC-14.2 | e2e   | Same, with the locale set to Arabic.                                             |
| TC-14.3 | e2e   | Tab from the queue to a row, claim, review and approve using only the keyboard.  |
| TC-14.4 | e2e   | Open and Escape the review sheet · Then focus is back on the row that opened it. |
| TC-14.5 | e2e   | Every form control on the create-operator dialog has an accessible name.         |

**Files likely touched.**
`package.json`, `e2e/a11y.spec.ts` (new), `e2e/fixtures.ts`, whichever components the findings name.

---

### CC-015 — Decide whether money-path POSTs carry an Idempotency-Key

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| **Type**                            | Enhancement                                           |
| **Priority**                        | P2                                                    |
| **Size**                            | M                                                     |
| **Blocked by**                      | CC-004 (the contract needs to be trustworthy first)   |
| **Needs a decision from the owner** | **Yes**                                               |

**Problem.**
`src/lib/api/client.ts:88-89,129-131` supports an `Idempotency-Key` header, and
`docs/API-CONTRACT.md` §1 says the backend accepts it on POSTs and replays the original result.
**No call site anywhere in the console sends one.** The only reference outside the client is a unit
test.

That matters most for the two calls the codebase itself flags as dangerous. `playersApi.debit` and
`playersApi.credit` both carry comments saying they are "not idempotent and not safe to repeat"
because _Ichancy_ has no idempotency key — but the backend's own replay would make a duplicated
_HTTP_ request safe, which is a different problem from a duplicated _Ichancy_ call. A double-submit,
a flaky network retry at the browser layer, or an operator's double click are all HTTP-layer
duplicates that a key would absorb.

**The decision (ask the owner first).**

1. Confirm with the backend which routes honour `Idempotency-Key` and for how long a key is replayed.
2. Decide whether a key is generated per _attempt_ (absorbs network-layer duplicates only) or per
   _intent_ (absorbs an operator's double click too, which is the more useful behaviour and the
   riskier one to get wrong).

Do not implement before both are answered. A key the backend ignores gives false confidence on
exactly the calls where confidence must be earned.

**In scope (once decided).**

- Send a key on `deposits.approve`, `deposits.reject`, `deposits.claim`, `deposits.release`,
  `players.debit`, `players.credit`, and the tenant write operations.
- The key is generated where the _intent_ is formed (when the dialog is opened / the form is
  submitted), not inside the client, so a retry of the same intent reuses it.
- Tests that a retried mutation reuses the key and a fresh intent gets a new one.

**Out of scope.**

- Turning off `retry: false` on any mutation. That guard stays regardless
  (`src/lib/api/queries.ts:255-290`).
- Any change to how `NEEDS_RECONCILIATION` is presented — it must still never offer a retry.

**Acceptance criteria.**

1. Every money-path POST the backend honours a key for sends one.
2. The key is stable across a retry of the same operator intent and different across intents.
3. A double-click on approve results in **one** effective decision, verified against the mock.
4. `retry: false` remains on debit and credit.
5. `NEEDS_RECONCILIATION` still shows no retry affordance.
6. `docs/API-CONTRACT.md` records which routes honour a key and the replay window.

**Test cases.**

| Id      | Level     | Given / When / Then                                                            |
| ------- | --------- | -------------------------------------------------------------------------------- |
| TC-15.1 | unit      | Given an approve mutation · Then the request carries `Idempotency-Key`.         |
| TC-15.2 | unit      | Given the same intent retried after a network failure · Then the same key is sent. |
| TC-15.3 | unit      | Given the dialog is closed and reopened · Then a different key is sent.         |
| TC-15.4 | component | Double-click approve · Then one request is dispatched, or two with one key.     |
| TC-15.5 | component | Debit still never auto-retries.                                                 |
| TC-15.6 | component | `NEEDS_RECONCILIATION` still renders no retry control.                          |

**Files likely touched.**
`src/lib/api/endpoints.ts`, `src/lib/api/queries.ts`, the deposit and player dialogs,
`docs/API-CONTRACT.md`.

---

### CC-019 — Validate a payout address on every crypto rail, not on the two the seeder named

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| **Type**                            | Defect                                                |
| **Priority**                        | P1 (correctness/honesty)                              |
| **Size**                            | S (< half a day)                                      |
| **Blocked by**                      | —                                                     |
| **Needs a decision from the owner** | no                                                    |

**Problem.** The backend applies **no address check at all** to a payout account on a crypto rail
whose method code is not literally `USDT_TRC20` or `USDT_BEP20`. The operator's own rail is coded
`USDT`, so theirs is one of the unchecked ones — and `accountIdentifier` cannot be edited after
creation by design, so a bad value is permanent and every player on that rail is sent to it.

This is the same root cause as the chain-check bug that answered `skipped` for every real deposit
for months: a method code is a name somebody types, so it cannot be a lookup key. That instance was
fixed on both sides; this one was missed because it is inert rather than wrong — it does not fail,
it just silently declines to check.

Two things in the console currently claim this control exists. `wallet-address.ts` says "the backend
refuses a malformed address on `POST /destinations`, **and that refusal is the control**" — the
client-side check is documented as only adding timing and language. It is in fact the only check
there is, and a `curl` with a staff token skips it entirely.

**Evidence.** Verified in `../Telegram-mini-app`, not inferred:

- `src/modules/payment-method/services/payment-destination.service.ts:40-43` —
  `WALLET_NETWORK_BY_METHOD_CODE` is keyed on `USDT_TRC20_CODE` / `USDT_BEP20_CODE`.
- Same file, `:214-215` — `const network = WALLET_NETWORK_BY_METHOD_CODE[method.code]; if (network
  === undefined) return;`. An unrecognised code returns before `walletAddressProblem()` is ever
  called, so nothing is validated.
- Contrast `src/modules/payment-method/services/destination-balance.service.ts:71` and
  `src/modules/deposit/services/deposit-chain-check.service.ts`, both of which were already moved to
  `detectWalletNetwork(address)` and are told the method code by nobody.
- Console side, stating the control that is missing:
  `src/features/payment-methods/wallet-address.ts` header, "WHY THE CONSOLE CHECKS SOMETHING THE
  BACKEND ALSO CHECKS".

**In scope.** Backend only. Gate the check on `method.rail === 'CRYPTO'` and take the network from
the address, exactly as the balance read and the deposit chain-check already do. Delete
`WALLET_NETWORK_BY_METHOD_CODE`. Decide and encode what a CRYPTO rail with an identifier on no chain
means on create — refusing it is the expected answer, since the console already refuses it in the
form and the seeded `SEED-PLACEHOLDER-…` rows are written by provisioning rather than through this
path.

**Out of scope.** Cross-network policy (which chain a rail is "supposed" to be on). Nothing knows
that any more and nothing should: every destination is verified against the chain of its own
address, which is what lets one method hold a TRC20 and a BEP20 account. Do not reintroduce a table
of codes to answer it. Also out of scope: editing `accountIdentifier`, which stays immutable.

**Acceptance criteria.**

1. A destination created on a CRYPTO rail coded `USDT` with a malformed address is refused with
   `PAYMENT_METHOD_INVALID`, naming the field.
2. A well-formed TRC20 address is accepted on that same rail, and so is a well-formed BEP20 one.
3. A destination on a non-crypto rail is unaffected: no shape is asserted on an account number the
   server has no business asserting.
4. `WALLET_NETWORK_BY_METHOD_CODE` no longer exists, and a grep for a payment-method code used as a
   chain lookup key returns nothing in either repository.
5. `src/features/payment-methods/wallet-address.ts`'s claim that the backend refusal is the control
   becomes true; if the decision goes the other way, that comment is corrected in the same change.

**Test cases.**

| Id      | level   | given / when / then                                                                                             |
| ------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| TC-19.1 | backend | A CRYPTO method coded `USDT` · When a destination is created with `not-an-address` · Then refused, field named.  |
| TC-19.2 | backend | The same method · When created with a `T…` address · Then accepted.                                             |
| TC-19.3 | backend | The same method · When created with a `0x…` address · Then accepted — one method may hold both chains.           |
| TC-19.4 | backend | A CASH_OFFICE method · When created with `SHAM-DAM-0091` · Then accepted, unvalidated.                           |
| TC-19.5 | backend | A CRYPTO method coded `USDT_TRC20` · When created with a `0x…` address · Then the address decides, not the code. |

**Files likely touched.**
_Backend:_ `src/modules/payment-method/services/payment-destination.service.ts`, its spec.
_Console:_ `src/features/payment-methods/wallet-address.ts` (comment only, if the decision changes).

---

### CC-021 — Guard `PATCH /v1/admin/payment-destinations/:id` — it currently has none

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| **Type**                            | Defect                                                |
| **Priority**                        | P1 (correctness/honesty)                              |
| **Size**                            | S (< half a day)                                      |
| **Blocked by**                      | —                                                     |
| **Needs a decision from the owner** | no                                                    |

**Problem.** The route that changes a payment destination's label, holder name, priority, daily cap
and active state — every mutable field on the account players are told to pay into — carries **no**
`@AdminAuth(...)` decorator at all. Every sibling route on the same controller is gated; this one
was missed, silently, and nothing in the test suite would have caught it because no test exercises
role enforcement on this controller.

This was found while scoping CC-020 (a hand-declared balance), which was about to add its fields to
this same write surface. Writing a new field onto an unguarded route would have inherited the bug
silently, which is why this is split out rather than folded into CC-020 — the same reasoning that
kept CC-019 separate from the auto-credit work that found it.

**Evidence.** Verified in `Telegram-mini-app`, not inferred:

- `src/modules/payment-method/controllers/admin-payment-method.controller.ts:114-122` —
  `createDestination` (`POST`) carries `@AdminAuth(...PAYMENT_METHOD_MANAGER_ROLES)`.
- Same file, `:143-150` — `updateDestination` (`PATCH`) carries **only** `@Patch('payment-destinations/:id')`.
  No `@AdminAuth` anywhere above it.
- `:152-159` — `deactivateDestination` (`DELETE`) carries `@AdminAuth(...PAYMENT_METHOD_MANAGER_ROLES)`.
  So the create and deactivate neighbours of this exact route are both gated; only the one in between
  is not.
- `src/core/auth/guards/auth.guard.ts:11-12` — the guard's own header comment: _"A route with NO auth
  decorator at all is still authenticated — any valid principal passes. That is the fail-closed
  default; `@PlayerAuth()`/`@AdminAuth()` narrow it."_ Confirmed in code: `enforceRequirement()`
  (`:112-133`) returns `true` whenever `requirement === undefined`.
- `src/core/auth/guards/roles.guard.ts:42-43` — same shape: `if (requirement === undefined ||
  requirement.kind !== 'ADMIN') return true;`. With no `@AdminAuth` on the handler, this guard never
  even reaches the role check.
- Net effect: **any authenticated admin, of any role — `SUPPORT`, `VIEWER`, whichever roles exist —
  can call this route and change a destination's label, holder name, priority, daily cap and active
  state**, none of which `PAYMENT_METHOD_READER_ROLES` is supposed to be able to touch
  (`payment-method.constants.ts:52-69`, the boundary argued there is about who may redirect players'
  money, and this route is exactly that action).
- A second, milder defect in the same file: `:124,136-137` — `destinationBalance` carries **two**
  `@AdminAuth(...)` calls, `PAYMENT_METHOD_MANAGER_ROLES` above the `@Get` decorator and
  `PAYMENT_METHOD_READER_ROLES` below it. Both call `SetMetadata` on the same key
  (`src/common/decorators/auth.decorator.ts:34-35`), and TypeScript's `__decorate` applies decorators
  bottom-to-top, so the topmost one — `PAYMENT_METHOD_MANAGER_ROLES` — wins and silently overwrites
  the reader grant. The handler's own doc comment (`:125-135`) says "Read-gated, because a balance is
  a fact about the operator, not an action against it" — untrue today: `REVIEWER`/`SUPPORT` get a 403
  reading a wallet balance they are supposed to be allowed to see. Overly strict rather than a hole,
  so lower urgency than the missing guard above, but the same root cause (a stray decorator on a
  shared controller) and cheap to fix in the same pass.
- No test anywhere in the repo asserts role enforcement for this controller:
  `grep -rn "payment-destinations\|createDestination\|updateDestination\|deactivateDestination"
  --include=*.spec.ts` finds no controller spec, and `grep -rn "INSUFFICIENT_ROLE" --include=*.spec.ts
  src/modules` finds nothing under `payment-method` at all. `payment-destination.service.spec.ts` only
  covers the address-network rule (`assertAddressBelongsToNetwork`); the controller has no spec file.

**In scope.**

- Add `@AdminAuth(...PAYMENT_METHOD_MANAGER_ROLES)` to `updateDestination`, matching its `create` and
  `deactivate` neighbours.
- Fix the doubled decorator on `destinationBalance`: keep exactly one `@AdminAuth`, with
  `PAYMENT_METHOD_READER_ROLES` (the comment's stated intent, and the least-privilege reading — a
  balance read is not the write CC-019/CC-020 evidence is about).
- Add `admin-payment-method.controller.spec.ts` (or extend an e2e/integration harness if that is this
  module's convention) asserting every route's role requirement, so this class of bug — a decorator
  silently missing or silently overwritten — fails a test instead of shipping.

**Out of scope.**

- Any change to which roles are IN `PAYMENT_METHOD_MANAGER_ROLES` / `PAYMENT_METHOD_READER_ROLES` —
  this is about the gate being present and correct, not about redrawing the boundary.
- CC-020's new declared-balance route is not this route and is written from scratch with its own
  guard — it does not inherit this bug, but its author should read this ticket before copying any
  decorator pattern from this file.

**Acceptance criteria.**

1. `PATCH /v1/admin/payment-destinations/:id` refuses a caller whose role is not in
   `PAYMENT_METHOD_MANAGER_ROLES` with `INSUFFICIENT_ROLE`, and nothing is written.
2. `GET /v1/admin/payment-destinations/:id/balance` accepts every role in
   `PAYMENT_METHOD_READER_ROLES` (in particular `REVIEWER` and `SUPPORT`) and refuses everyone else.
3. `createDestination` and `deactivateDestination` are unchanged and still pass their existing
   behaviour.
4. A test walks every handler on `AdminPaymentMethodController` and asserts it carries exactly one
   `AUTH_REQUIREMENT_KEY` metadata value — this is the mechanism that stops a second stray decorator
   silently overwriting a first one from recurring on this controller.

**Test cases.**

| Id      | Level   | Given / When / Then                                                                                          |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| TC-21.1 | backend | Given a `SUPPORT` token · When `PATCH /payment-destinations/:id` is called with `{ isActive: false }` · Then `403 INSUFFICIENT_ROLE` and the row is unchanged. |
| TC-21.2 | backend | Given a `SUPER_ADMIN` token · When the same call is made · Then it succeeds, as today.                        |
| TC-21.3 | backend | Given a `REVIEWER` token · When `GET /payment-destinations/:id/balance` is called · Then it succeeds (currently 403 — this is the regression this ticket fixes). |
| TC-21.4 | backend | Given a `VIEWER`-equivalent role with neither reader nor manager membership · When either route is called · Then both refuse. |
| TC-21.5 | unit    | Reflect every handler on `AdminPaymentMethodController` · Then each carries exactly one `AUTH_REQUIREMENT_KEY` value, and it is the one the route's own name implies (list vs. get vs. write). |

**Files likely touched.**
`src/modules/payment-method/controllers/admin-payment-method.controller.ts`,
`src/modules/payment-method/controllers/admin-payment-method.controller.spec.ts` (new).

---

## 4. Feature tickets

These three come from the product owner, not from analysis. Each was checked against the **backend**
(`../Telegram-mini-app`, NestJS 11 + Prisma 7) as well as this console, because in all three cases a
good part of what was asked for already exists on one side and not the other. Every ticket says which
repository each piece of work lands in.

> **Read this first.** The backend has moved ahead of `docs/TENANT-OPERATIONS.md`. Creating an
> operator now also registers its webhook, pushes its command menus, activates it and provisions its
> default payment rails — all inside `TenantService.create` → `provision()`
> (`src/modules/tenant/services/tenant.service.ts:244`). The docs still describe those as manual
> steps, and this console's setup checklist is built on the old model. CC-017 covers it.

---

### CC-016 — Bind and verify the Telegram group chats an operator publishes into

|                                     |                                                                  |
| ----------------------------------- | ---------------------------------------------------------------- |
| **Type**                            | Feature                                                          |
| **Priority**                        | P1                                                               |
| **Size**                            | L                                                                |
| **Repo**                            | backend (`Telegram-mini-app`) **and** console                    |
| **Blocked by**                      | —                                                                |
| **Needs a decision from the owner** | Decided 2026-09-15 — see the decision record below               |

**Problem.**
An operator's bot publishes into Telegram groups. There are exactly **two**, and they already exist
as columns — but a chat is bound by typing a raw numeric id into a form, with nothing anywhere
checking that the id is real, that it is the group the person meant, or that the bot is even a member
of it. Get it wrong and the failure is silent: review cards stop arriving and no screen says why.

The two chats, and what each is for, from the schema:

| Column        | Required | What the bot sends there                                           |
| ------------- | -------- | ------------------------------------------------------------------ |
| `adminChatId` | yes      | "Where review cards and operational alerts go."                    |
| `feedChatId`  | no       | "OPTIONAL customer-facing mirror of credited deposits. Null = off." |

So the ask — a place to enter group ids after making the bot an admin there — is **half built**. What
is missing is everything that makes it safe: discovering the id, proving delivery, and letting the
operator who owns the group manage it.

**Evidence.**

_Backend:_

- `prisma/schema.prisma`, `model Tenant` — `adminChatId BigInt`, `feedChatId BigInt?`, with the two
  doc comments quoted above.
- `src/core/telegram/services/bot.service.ts:224` — admin messages go to
  `(await this.registry.current()).adminChatId`; `:238-240` — feed messages go to `feedChatId`, and
  return `null` when it is unset. Both correctly per-tenant.
- `src/core/telegram/services/tenant-bot.registry.ts:112-113,151-152` — both ids are loaded per tenant.
- `src/modules/tenant/controllers/tenant-admin.controller.ts:80-95` — the create route's own comment:
  _"their Telegram id becomes `adminChatId` when the request does not name a group … a chat id in a
  payload is a claim, and the id we already authenticated is a fact."_ The backend already
  distinguishes a claimed chat from a proven one — and then never proves a claimed one.
- **No endpoint anywhere sends a test message, calls `getChat`, or calls `getChatMember`.** Nothing
  validates a bound chat.
- `src/modules/admin/services/report-schedule.cron.ts:230` — `const { feedChatId, feedFullDetail } =
  this.config.telegram;` reads the **env**, not the tenant row. Same class of bug as the three in
  `docs/TENANT-OPERATIONS.md` §4, on the scheduled-report path. Flagged here; fix it as part of this
  ticket or split it out.

_Console:_

- `src/features/tenants/tenant-form-dialog.tsx:117-118,147-148,343-355,526-527` — both ids are
  editable, as free-text fields validated only by `CHAT_ID_RE`.
- `src/features/tenants/tenant-detail-panel.tsx:173-181` — both are displayed, copyable.
- `src/features/tenants/tenant-telegram-panel.tsx` — shows webhook, bot username, pending updates,
  last error. Says **nothing** about either chat.
- Both are `PLATFORM_ADMIN`-only: they live on the Tenants screen and ride
  `PATCH /v1/admin/tenants/:id`, which is `@AdminAuth(AdminRole.PLATFORM_ADMIN)`. A tenant's own
  `SUPER_ADMIN` cannot see or change the group their own bot posts into.

**Decision record (owner, final, 2026-09-15).** This supersedes the options below, which are kept as
the history of the question. The contract is `docs/API-CONTRACT.md`, Tenants → "Staff and feed
groups", "GET /:id/health — chats" and Admin directory → "Linking a staff account to Telegram".

1. **An operator may be created with no staff group, and stays SUSPENDED until one is bound.**
   Creation no longer defaults `adminChatId` to the creating admin's Telegram id (a person's private
   chat is never a staff group); `TenantView.adminChatId` is `string | null`. `POST /:id/activate`
   refuses with 422 `TENANT_STAFF_GROUP_REQUIRED` while it is null, so provisioning reports
   `activated: false` for such a create. Starting a deposit for a legacy ACTIVE row with no group is
   refused with the same code.
2. **Primary binding path: an "Add bot to staff group" button.** It asks
   `POST /v1/admin/tenants/:id/telegram/bind-links { purpose }` for a one-time
   `https://t.me/<bot>?startgroup=<nonce>&admin=post_messages+delete_messages+pin_messages+manage_chat`
   link (15 minutes, one use). Telegram sends `/start@<bot> <nonce>` in the group the owner picks; the
   backend matches the nonce to the operator and purpose, verifies the chat (group or supergroup, bot
   present, administrator, can post), binds it, confirms in the group and posts review cards for
   deposits already waiting. **Fallback:** groups the bot joined any other way appear in
   `GET /v1/admin/tenants/:id/telegram/chats` and are bound with `PUT …/telegram/chats/:purpose`,
   verified the same way. The option (a) `/bind_admin` command and the `POST …/chats/test` route
   below were NOT built.
3. **Only the PLATFORM_ADMIN binds or changes a staff or feed group** (decision 2 below: platform, not
   the operator's SUPER_ADMIN). Every route is on `/v1/admin/tenants`.
4. **Staff who approve in the group link their Telegram with a one-time code.** The console shows a
   code (`POST /v1/admin/admins/:id/telegram-link-code`); the staff member sends `/link <code>` to the
   operator's bot in a private chat; the backend stores that update's `from.id`. One use, 10 minutes,
   rate limited, audited; `DELETE /v1/admin/admins/:id/telegram-link` unlinks. `AdminUserView` gains
   `telegramLinked`. `telegramUserId` stays refused on create and update.
5. **The feed group uses the same link and picker**, with `purpose: FEED`.
6. **Decision 3 below (more than two chats): no.** Exactly two, as the schema has.

Also decided with it: `GET /:id/health` reports Ichancy in fake mode as `ok: false, fake: true` (and
every Ichancy-derived result carries `ichancyFake`), because an `ok: true` beside a made-up float was
taken for a real connection.

Console built (branch `feat/staff-group`): nullable `adminChatId` with a red "no staff group" warning
on the operator panel; "Staff group" and "Feed group" checklist steps whose action is the link button
plus a picker of that operator's discovered chats that re-reads every few seconds while open; a
"bot removed from the group" alert from `health.chats`; fake-mode notices on the Ichancy panel,
checklist, created alert, activation toast, import card and float sync; "Link Telegram" / "Unlink" on
the staff record; en and ar for all of it; MSW handlers and tests for every route.

Acceptance criteria below that no longer apply as written: 3 and 9's "test message" (not built), and
8 was already true in the backend (`report-schedule.cron.ts` reads the operator's own chats). The
evidence quoted under "Backend" is from before the multi-tenant rewrite and is stale.

**The decision (ask the owner first).** _(Historical — answered above.)_

1. **How a chat gets bound.** Two options, and the recommendation is to build both — they solve
   different halves:
   - **(a) Bot command, in the group — recommended as primary.** Someone adds the bot to the group as
     an admin and sends `/bind_admin` or `/bind_feed`. The bot reads `chat.id` off the update itself,
     checks the sender is a `SUPER_ADMIN` of that tenant, writes the column, and replies confirming.
     This is the only option where the id can never be mistyped, because nobody ever types it — and
     it inherently proves the bot is in the group and can post.
   - **(b) Typed id, plus a "Send a test message" button.** Keeps the current form, adds proof. Needed
     anyway for an operator repointing a chat from a desk, and as the way to re-verify a binding that
     has gone quiet.
2. **Who may change a chat.** Today: `PLATFORM_ADMIN` only. The group belongs to the operator, so a
   `SUPER_ADMIN` arguably should own its own. Note this is the **opposite** boundary to payment
   destinations (CC-018), where the backend deliberately keeps the platform admin out — decide it on
   the same grounds: who is harmed by a wrong value. A wrong chat id leaks an operator's deposit
   cards into the wrong group.
3. **More than two chats?** The ask said "group**s**". Today the schema allows exactly two, each with
   a distinct meaning. If the requirement is genuinely an arbitrary list of destinations, that is a
   new `tenant_chats` table and a much larger change — say so now rather than discovering it later.

> **Open question for the owner.** The request referred to publishing "as images I sent". No images
> reached this conversation, so this ticket assumes the existing deposit-card format
> (`src/modules/deposit/telegram/deposit-card.util.ts`) and changes nothing about what is posted —
> only where, and whether it arrives. If a new card layout was intended, that is a separate ticket.

**In scope.**

_Backend:_

- `POST /v1/admin/tenants/:id/chats/test` — takes `{ chat: 'admin' | 'feed' }`, sends a real message
  to that chat through **that tenant's** bot, and answers what happened.
- `GET /v1/admin/tenants/:id/chats` — for each chat: the bound id, the title from `getChat`, whether
  the bot is a member, whether it is an administrator, and whether it may post.
- Option (a): `/bind_admin` and `/bind_feed` bot commands, authorised against the tenant's staff, and
  added to the pushed command menus (`setup-bot.command.ts`).
- Fix `report-schedule.cron.ts:230` to read the tenant row rather than `config.telegram`.

_Console:_

- A **Chats** card on the operator detail panel, beside the Telegram card: both chats, their titles,
  their verified state, a "Send a test message" button each, and a plain sentence when the feed chat
  is off (it is optional — off is a valid state, not a fault).
- Whatever binding UI follows from decision 1.
- `en` + `ar` strings for all of it.

**Out of scope.**

- Changing what the bot posts, or the card layout.
- An arbitrary number of chats per operator, unless decision 3 says otherwise.
- Anything about the webhook — that already has its own panel and its own controls.

**Acceptance criteria.**

1. The operator detail panel shows both chats with their **Telegram group title**, not just a number.
2. Each chat shows whether the bot is a member, whether it is an administrator, and whether it can
   post — as three distinct facts, because they fail separately and are fixed differently.
3. "Send a test message" posts to the real group through that operator's bot and reports success or
   the exact Telegram error.
4. A chat id that Telegram rejects (`chat not found`, `bot is not a member`, `not enough rights`) is
   reported with the sentence naming who fixes it and how — never as a generic failure.
5. An unset `feedChatId` renders as "off", explicitly, and never as an error or an empty value.
6. Binding a chat never overwrites the other chat, and never silently swaps admin for feed.
7. Whatever binding method decision 1 chooses, the bound id is **verified before it is saved** —
   nothing may write a chat id the bot has not just successfully posted to.
8. Scheduled reports go to the tenant's own `feedChatId ?? adminChatId`, not to the env's.
9. The role decided in decision 2 can change a chat, and every other role sees the values read-only.

**Test cases.**

| Id       | Level     | Given / When / Then                                                                                           |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| TC-16.1  | backend   | Given a tenant whose bot is an admin in group `-1001234` · When the test endpoint is called · Then a message is sent through **that tenant's** token and `ok:true` is returned. |
| TC-16.2  | backend   | Given a bot that is not a member · Then the endpoint answers a named error, and the chat is **not** saved.       |
| TC-16.3  | backend   | Given a bot that is a member but not an administrator · Then "member, not admin" is reported distinctly from "not a member". |
| TC-16.4  | backend   | Given `/bind_admin` from a user who is not staff of that tenant · Then it is refused and nothing is written.     |
| TC-16.5  | backend   | Given `/bind_admin` from a `SUPER_ADMIN` in a group · Then `adminChatId` becomes that group and `feedChatId` is untouched. |
| TC-16.6  | backend   | Given a tenant with `feedChatId` set · When the report cron runs · Then it posts to the **tenant's** feed chat, not the env's. |
| TC-16.7  | component | The chats card renders member / admin / can-post as three separate indicators.                                  |
| TC-16.8  | component | `feedChatId === null` renders as "off", with no error styling.                                                  |
| TC-16.9  | component | A failed test message renders the Telegram error text and the correlation id.                                    |
| TC-16.10 | component | A role without the chat-write capability sees the values and no controls.                                        |
| TC-16.11 | e2e       | Open an operator, send a test message to the admin chat, see the success state.                                  |
| TC-16.12 | build     | Every new key exists in `en` and `ar`.                                                                            |

**Files likely touched.**
_Backend:_ `src/modules/tenant/controllers/tenant-admin.controller.ts`,
`src/modules/tenant/services/tenant-operations.service.ts`,
`src/modules/tenant/dtos/tenant-operations.view.ts`, `src/core/telegram/services/bot.service.ts`,
`src/core/telegram/commands/setup-bot.command.ts`,
`src/modules/admin/services/report-schedule.cron.ts`.
_Console:_ `src/features/tenants/tenant-chats-panel.tsx` (new),
`src/features/tenants/tenant-detail-panel.tsx`, `src/features/tenants/tenant-actions.ts`,
`src/features/tenants/messages.ts`, `src/lib/api/endpoints.ts`, `src/lib/api/queries.ts`,
`src/types/tenant.ts`, `src/mocks/handlers.ts`, `docs/API-CONTRACT.md`,
`docs/TENANT-OPERATIONS.md`.

---

### CC-017 — Make the defaults a new operator inherits visible and editable

|                                     |                                                     |
| ----------------------------------- | ----------------------------------------------------- |
| **Type**                            | Feature                                             |
| **Priority**                        | P1                                                  |
| **Size**                            | M                                                   |
| **Repo**                            | backend (`Telegram-mini-app`) **and** console       |
| **Blocked by**                      | —                                                   |
| **Needs a decision from the owner** | No — but read "What is already true" before starting |

**What is already true.**
The question behind this ticket was whether a newly added operator gets the same configuration as the
first one. **It already does**, and by more than was assumed. `TenantService.create` resolves every
optional field from a single `PlatformDefaults` row, then calls `provision()`, which:

1. registers the operator's Telegram webhook,
2. pushes its command menus,
3. provisions its **default payment rails**, and
4. activates it —

and reports the outcome of each step in a `provisioning` object on the create response.

**Problem.**
Two things are wrong with that, and neither is that the defaults are missing.

**First: the defaults are invisible.** `PlatformDefaults` is a single settings row that decides the
Ichancy base URL, the agent id, the currency, the dual-approval threshold, the float low-watermark
and the deposit expiry for every operator created from now on. There is **no endpoint that reads or
writes it** and no screen anywhere. It is seeded from env on first run and after that can only be
changed with SQL. The console's create form shows hints saying a field "defaults to the platform
default" without being able to say what that value is.

**Second: the console throws the provisioning report away.** `tenantsApi.create` parses the response
with `tenantSchema`, which is a `looseObject`, so the `provisioning` block passes straight through
untyped and unread. The console then shows a six-step setup checklist — register webhook, push menus,
activate — for steps the backend has usually **already done**, and never surfaces the one field that
matters most on a minute-old operator: `paymentMethodsNeedAccounts`.

**Evidence.**

_Backend:_

- `prisma/schema.prisma`, `model PlatformDefaults` — `id Int @id @default(1)` with the comment
  _"Always 1 — this table holds settings, not rows."_ Fields: `ichancyBaseUrl`, `ichancyAgentId`
  (nullable), `currencyCode`, `dualApprovalThresholdMinor`, `agentFloatLowWatermarkMinor`,
  `depositExpiryMinutes`.
- `src/modules/tenant/services/platform-defaults.service.ts` — the service exists.
- `src/modules/tenant/controllers/tenant-admin.controller.ts` — routes are `@Controller('v1/admin/tenants')`
  and cover list, get, create, patch, activate, suspend, webhook ×2, bot-setup, health, ichancy, bot.
  **There is no platform-defaults route.**
- `src/modules/tenant/services/tenant.service.ts:198` — `const defaults = await this.platformDefaults.current();`
- `:244-245` — `const { row, provisioning } = await this.provision(created); return { ...toTenantView(row), provisioning };`
- `:317-329` — the provisioning block: `webhookRegistered`, `webhookUrl`, `webhookError`,
  `menusPushed`, `menuScopes`, `menuError`, `activated`, `activationError`, `paymentMethodsCreated`,
  `paymentMethodsError`, `paymentMethodsNeedAccounts`.
- `src/modules/tenant/dtos/tenant-operations.view.ts:171-176` — the comment on
  `paymentMethodsNeedAccounts`: _"a player paying into a placeholder has sent money nowhere, so the
  console must say it out loud until real accounts replace them."_ The console does not.

_Console:_

- `src/lib/api/endpoints.ts` — `create: (body) => api.post(tenantSchema, '/v1/admin/tenants', { body })`.
  `tenantSchema` has no `provisioning`.
- `grep -rn "provisioning\|paymentMethodsNeedAccounts" src/` → **no matches** outside CSS placeholders.
- `src/features/tenants/tenant-setup-checklist.tsx:14-26` — the checklist's own doc comment describes
  a new operator as landing "SUSPENDED with a webhook path Telegram has never heard of", which is the
  pre-`provision()` world.

_Docs:_

- `docs/TENANT-OPERATIONS.md` §1 — "`POST /v1/admin/tenants` does five things", ending "Writes the row
  **SUSPENDED**", and "Ledger accounts are not seeded". §7 lists register-webhook, push-menus and
  activate as manual steps 3–6. All now stale.

**In scope.**

_Backend:_

- `GET /v1/admin/platform-defaults` and `PATCH /v1/admin/platform-defaults`, `PLATFORM_ADMIN` only,
  answering the same view both times.
- Validate on write the way tenant create does: a currency that exists, thresholds as minor-unit
  strings, `depositExpiryMinutes` in a sane range.
- Changing a default must **not** retroactively change existing operators. Say so in the response and
  in the doc.

_Console:_

- A **Platform defaults** panel on the Tenants screen (or a platform section of Settings), showing
  every default with its current value, editable by `PLATFORM_ADMIN`.
- Type `provisioning` in `src/types/tenant.ts` and surface it after a create: what succeeded, what
  failed, and specifically a prominent warning when `paymentMethodsNeedAccounts` is true, linking to
  that operator's payment rails.
- Rework `tenant-setup-checklist.tsx` so a step the backend already completed shows as done rather
  than as a to-do — driven by the create response and by `GET /health`, not by an assumption.
- Have the create form's "Advanced" hints show the **actual** default value rather than the phrase
  "the platform default".

_Docs:_ update `docs/TENANT-OPERATIONS.md` §1 and §7, and `docs/API-CONTRACT.md` §4.

**Out of scope.**

- Per-operator overrides of anything not already on `UpdateTenantBody`.
- Retrofitting defaults onto existing operators.
- Changing what `provision()` does. This ticket makes it visible, not different.

**Acceptance criteria.**

1. A `PLATFORM_ADMIN` can read every field of `PlatformDefaults` in the console.
2. A `PLATFORM_ADMIN` can change them, with the same validation tenant create applies.
3. Every other role gets a 403 from the endpoint and no link to the screen.
4. Changing a default leaves existing operators untouched, and the UI says so before saving.
5. The create form's Advanced hints name the actual value each blank field will take.
6. After creating an operator, the console reports each provisioning step's outcome — webhook, menus,
   activation, payment rails — from the response, not from a second round of guessing.
7. When `paymentMethodsNeedAccounts` is true, the console says the operator's rails point at
   placeholder accounts and that players paying into one have sent money nowhere, with a link to fix
   it. This warning persists on the operator until real accounts replace the placeholders.
8. The setup checklist marks an already-completed step as done.
9. A provisioning step that **failed** is shown as failed with its error text and the control to
   retry it.
10. `docs/TENANT-OPERATIONS.md` §1 and §7 describe what `create` actually does today.

**Test cases.**

| Id       | Level     | Given / When / Then                                                                                            |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| TC-17.1  | backend   | `GET /v1/admin/platform-defaults` as `PLATFORM_ADMIN` · Then all six fields are returned.                        |
| TC-17.2  | backend   | Same as `SUPER_ADMIN` · Then 403.                                                                                |
| TC-17.3  | backend   | `PATCH` with a currency that has no `Currency` row · Then `VALIDATION_FAILED` naming the field.                  |
| TC-17.4  | backend   | `PATCH` the deposit expiry · Then an existing tenant's `depositExpiryMinutes` is unchanged.                       |
| TC-17.5  | backend   | Create a tenant after a `PATCH` · Then the new tenant inherits the new value.                                    |
| TC-17.6  | component | The defaults panel renders all six values and is read-only for a non-platform role.                              |
| TC-17.7  | component | Given a create response with `paymentMethodsNeedAccounts: true` · Then the placeholder warning renders with a link to that operator's rails. |
| TC-17.8  | component | Given `webhookRegistered: true` · Then the checklist's webhook step is done, not to-do.                          |
| TC-17.9  | component | Given `menusPushed: false` with a `menuError` · Then the step shows failed, with the error and a retry control.  |
| TC-17.10 | unit      | `tenantSchema` parses a response carrying `provisioning` with no drift warning (see CC-011).                     |
| TC-17.11 | e2e       | Create an operator end to end · Then the provisioning summary lists all four steps with their outcomes.          |
| TC-17.12 | build     | Every new key exists in `en` and `ar`.                                                                            |

**Files likely touched.**
_Backend:_ `src/modules/tenant/controllers/tenant-admin.controller.ts`,
`src/modules/tenant/services/platform-defaults.service.ts`, `src/modules/tenant/dtos/tenant.dto.ts`,
`src/modules/tenant/dtos/tenant.view.ts`.
_Console:_ `src/features/tenants/platform-defaults-panel.tsx` (new),
`src/features/tenants/tenant-setup-checklist.tsx`, `src/features/tenants/tenant-form-dialog.tsx`,
`src/features/tenants/tenants-page.tsx`, `src/features/tenants/messages.ts`, `src/types/tenant.ts`,
`src/lib/api/endpoints.ts`, `src/lib/api/queries.ts`, `src/mocks/handlers.ts`, `src/mocks/db.ts`,
`docs/API-CONTRACT.md`, `docs/TENANT-OPERATIONS.md`.

---

### CC-018 — USDT and USD rails, and who may change a payout account

|                                     |                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------ |
| **Type**                            | Feature                                                                |
| **Priority**                        | P1                                                                     |
| **Size**                            | L                                                                      |
| **Repo**                            | backend (`Telegram-mini-app`) **and** console                          |
| **Blocked by**                      | —                                                                      |
| **Needs a decision from the owner** | **Yes** — three decisions, and one of them contradicts a backend boundary |

**What is already true.**
Two of the three things asked for are built.

- **Sham Cash and Syriatel Cash already ship with every operator.**
  `src/core/payments/default-payment-methods.ts` defines four defaults — `BANK_TRANSFER_MAIN`,
  `EWALLET_MAIN`, `SHAM_CASH` (`شام كاش`) and `SYRIATEL_CASH` (`سيريتيل كاش`) — and
  `provisionDefaultPaymentMethods` is called on every tenant create (`tenant.service.ts:298`). Both
  Syrian rails ride `MOBILE_WALLET`, both ask for a process number, both carry Arabic instructions.
- **A tenant can already edit its own financial settings.** `paymentMethods.write` is held by
  `SUPER_ADMIN` and `FINANCE_ADMIN` (`src/lib/auth/permissions.ts:73-92`), the backend agrees
  (`PAYMENT_METHOD_MANAGER_ROLES`), and the Payment rails screen has full create/edit for methods and
  destinations, including the account identifier that is the wallet address.

**Problem.**
What is missing is USDT, a second currency, a guard on the addresses, and a decision about the
platform admin.

**1. There is no USDT rail, on either network.** `DEFAULT_PAYMENT_METHODS` has nothing on the `CRYPTO`
rail. The driver already exists (`src/modules/payment-method/rails/crypto-manual.driver.ts`), so this
is method specs and seeding, not new machinery. TRC20 and BEP20 must be **two separate methods**, not
one method with two destinations: they are different chains, and USDT sent to a BEP20 address from a
TRC20 wallet is gone. A player picks the network, so the network must be the thing they pick.

**2. There is no USD.** `PaymentMethod.currencyCode` is a single currency, `Tenant.currencyCode` is a
single currency, and only `NSP` is seeded (`prisma/seed/currency.seed.ts:12`,
`SEED_CURRENCY_CODE = 'NSP'`). A dollar rail therefore needs a `USD` `Currency` row **and** an answer
to a question this ticket cannot answer for you — see decision 2.

**3. Every default destination is a placeholder, and nothing says so.**
`accountIdentifier: 'SEED-PLACEHOLDER-SHAMCASH-0000'`, `accountHolder: 'REPLACE ME'`. The backend
computes `destinationIsPlaceholder` per method and reports `paymentMethodsNeedAccounts` on create —
and the console has no idea either exists (see CC-017). A brand-new operator can be activated, take a
deposit, and send a player's money to a string that is not an account.

**4. Nothing validates a crypto address.** The destination form's only address rule is that the field
is non-empty. A mistyped TRC20 address is an irreversible loss, unlike a mistyped bank number which
usually just bounces.

**5. The platform admin is deliberately locked out of payout accounts.** The ask was that a platform
admin be able to edit an operator's financial settings too. The backend refuses this **on purpose**,
with the reasoning written down:

> `PAYMENT_METHOD_MANAGER_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN']`
> — `PAYMENT_METHOD_READER_ROLES` includes `PLATFORM_ADMIN`, annotated:
> _"PLATFORM_ADMIN reads and does not write. A payment destination is a real bank account or wallet
> belonging to the tenant, and editing one redirects where players' money is sent — the platform
> operator is not who should be doing that, however senior the role sounds."_

This console mirrors that exactly (`permissions.ts:52-70` grants `paymentMethods.read` and not
`paymentMethods.write`). Granting the write is a **backend** change first, and it removes a control
that was put there deliberately. It is a decision, not a task.

**Evidence.**

_Backend:_

- `src/core/payments/default-payment-methods.ts:33-36` — the four codes; `:100-165` — the four specs;
  `:141-142`, `:157-158` — the placeholder identifiers; `:180+` — `provisionDefaultPaymentMethods`.
- `src/modules/payment-method/rails/` — `crypto-manual.driver.ts` present alongside
  `bank-transfer`, `cash-agent`, `ewallet`, `manual-rail`.
- `src/modules/payment-method/payment-method.constants.ts` — the two role lists and the argued
  boundary quoted above.
- `prisma/seed/currency.seed.ts:12` — `SEED_CURRENCY_CODE = 'NSP'`, the only currency seeded.
- `prisma/schema.prisma`, `model PaymentDestination` — `accountIdentifier String`, no format
  constraint; `@@unique([paymentMethodId, accountIdentifier])`.
- `default-payment-methods.ts:44-58` — `DEFAULT_MIN_AMOUNT_MINOR = 2_500_000n` (25,000.00 NSP),
  because _"Ichancy refuses `depositToPlayer` under 25,000.00"_. A USD rail needs its own floor;
  25,000 **USD** would be absurd and 25,000 minor-USD is $250.

_Console:_

- `src/lib/auth/permissions.ts:52-70` — `PLATFORM_ADMIN` has `paymentMethods.read`, not `.write`.
- `src/features/payment-methods/destination-form-dialog.tsx:259` — the account identifier input, with
  an IBAN-shaped placeholder and no format validation.
- `grep -rn "placeholder" src/` finds no awareness of `SEED-PLACEHOLDER`.

**The decisions (ask the owner first).**

1. **USDT networks.** Confirm TRC20 and BEP20 only, as two separate methods. Confirm the display
   names players will read (Arabic, like the two cash rails?) and the min/max for each.
2. **What a USD rail credits.** This is the hard one. The ledger and the Ichancy agent float are in
   the tenant's currency. A player deposits $100 — what lands in their Ichancy balance, and at what
   rate? Three shapes, and they are very different amounts of work:
   - **(a) USD is display only**, converted at a rate the operator sets, credited in NSP. Needs a rate
     source and a rounding rule, and the rate used must be recorded on the deposit.
   - **(b) USD is a real second currency** end to end — ledger accounts, float, reconciliation. Large.
   - **(c) Only for operators whose `Tenant.currencyCode` is already USD.** Smallest, and it makes
     "ShamCash dollar and NSP" mean two different operators rather than two rails on one.
   **Do not start the USD half of this ticket until this is answered.** The USDT and placeholder
   halves are independent and can proceed.
3. **Platform admin write access.** Grant it, or keep the boundary? If granting: it must be a backend
   change to `PAYMENT_METHOD_MANAGER_ROLES` first, this console's mirror second, and the reasoning in
   `payment-method.constants.ts` must be rewritten rather than deleted — whoever wrote it will
   otherwise put it back.

**In scope.**

_Independent of the decisions — do this first:_

- Console: surface placeholder destinations. A method whose only active destination starts with
  `SEED-PLACEHOLDER` is shown as **not ready to take money**, on the rails screen, on the operator
  detail panel, and on the overview. Wording must say a player paying into it has sent money nowhere.
- Console + backend: validate crypto addresses by network — TRC20 (`T` + 33 base58) and BEP20
  (`0x` + 40 hex) — with a confirm step that shows the address back before saving.

_After decision 1:_

- Backend: add `USDT_TRC20` and `USDT_BEP20` to `DEFAULT_PAYMENT_METHODS`, rail `CRYPTO`, with their
  own min/max, `requiresReference: true` (the transaction hash), a reference pattern per chain, and
  placeholder destinations that follow the existing convention.
- Console: render the network on the rails screen so the two are never confused.

_After decision 2:_ the USD work that shape implies.

_After decision 3:_ the role change, backend first.

**Out of scope.**

- Automatic on-chain confirmation. These are `MANUAL_PROOF` rails like the rest; a human checks the
  hash.
- Withdrawals. This is the deposit path only.
- Rewriting the rotation, sticky-destination or fee logic.

**Acceptance criteria.**

1. A method whose only active destination is a `SEED-PLACEHOLDER` is shown as not ready to take
   money, everywhere it appears, in both languages.
2. That warning clears the moment a real active destination exists, and returns if the last real one
   is deactivated.
3. `USDT_TRC20` and `USDT_BEP20` exist as two separate methods on every newly created operator.
4. Each names its network in a way a player cannot misread, and the two are never presented as
   interchangeable.
5. A TRC20 address is refused in the BEP20 form and vice versa, before any request is sent.
6. Saving a crypto destination shows the address back for confirmation before it is written.
7. Re-running `provisionDefaultPaymentMethods` against an operator that has already replaced its
   accounts does not touch its destinations — the existing contract
   (`default-payment-methods.ts:175-178`) still holds, and there is a test proving it.
8. A `SUPER_ADMIN` and a `FINANCE_ADMIN` can still add and edit a wallet address for their own
   operator.
9. The role boundary matches decision 3 in **both** repositories, with the console mirroring the
   backend and neither offering an action the other refuses.
10. Any USD work matches the shape chosen in decision 2, and no USD rail ships with a minimum
    inherited from the NSP floor.

**Test cases.**

| Id       | Level     | Given / When / Then                                                                                                |
| -------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| TC-18.1  | component | Given a method whose only active destination starts with `SEED-PLACEHOLDER` · Then the rails screen marks it not ready and says money sent there goes nowhere. |
| TC-18.2  | component | Given a real active destination is added · Then the warning disappears without a reload.                             |
| TC-18.3  | component | Given the real destination is deactivated, leaving only the placeholder · Then the warning returns.                  |
| TC-18.4  | component | Given the BEP20 destination form and a `T…` address · Then it is refused client-side, naming the network mismatch.    |
| TC-18.5  | component | Given the TRC20 form and a `0x…` address · Then likewise.                                                            |
| TC-18.6  | component | Given a valid address · When save is pressed · Then a confirm step shows the address back before the request.        |
| TC-18.7  | backend   | Create a tenant · Then six default methods exist, including `USDT_TRC20` and `USDT_BEP20` on the `CRYPTO` rail.      |
| TC-18.8  | backend   | Re-run provisioning on a tenant with a real destination · Then that destination is byte-for-byte unchanged.          |
| TC-18.9  | backend   | Given a USDT method · Then its min/max are its own, not `DEFAULT_MIN_AMOUNT_MINOR`.                                  |
| TC-18.10 | component | A `SUPER_ADMIN` can add a wallet address to a USDT method.                                                            |
| TC-18.11 | component | A `PLATFORM_ADMIN` sees exactly what decision 3 allows — and the backend refuses exactly the same set.               |
| TC-18.12 | e2e       | Replace a placeholder wallet address end to end and watch the not-ready warning clear.                               |
| TC-18.13 | build     | Every new key exists in `en` and `ar`.                                                                                |

**Files likely touched.**
_Backend:_ `src/core/payments/default-payment-methods.ts`,
`src/modules/payment-method/payment-method.constants.ts`,
`src/modules/payment-method/rails/crypto-manual.driver.ts`,
`src/modules/payment-method/services/payment-destination.service.ts`, `prisma/seed/currency.seed.ts`.
_Console:_ `src/features/payment-methods/destination-form-dialog.tsx`,
`src/features/payment-methods/method-list.tsx`, `src/features/payment-methods/destination-list.tsx`,
`src/features/payment-methods/messages.ts`, `src/features/tenants/tenant-detail-panel.tsx`,
`src/lib/auth/permissions.ts`, `src/types/payment-method.ts`, `src/mocks/fixtures.ts`,
`src/mocks/handlers.ts`, `docs/API-CONTRACT.md`.

---

### CC-020 — Let an operator hand-declare a balance for every non-chain payment account

|                                     |                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------ |
| **Type**                            | Feature                                                                |
| **Priority**                        | P1                                                                     |
| **Size**                            | L                                                                      |
| **Repo**                            | backend (`Telegram-mini-app`) **and** console                          |
| **Blocked by**                      | —                                                                      |
| **Needs a decision from the owner** | **Yes** — three decisions, none of them blocking the backend/console plumbing |

**What is already true.**
Live balances are solved for the one rail that can answer for itself: a `CRYPTO` destination reads
its balance off the chain (`WalletBalance`, `GET /v1/admin/payment-destinations/:id/balance`,
`destination-balance.service.ts`). Every other rail — Sham Cash, Syriatel Cash, a bank account — has
no API to ask, and today says so in words: `financial.balance.untracked`, "No balance is tracked for
this account yet." The console's own code already names what belongs here and defers it on purpose:

> `method-account-card.tsx:381-388` — _"The operator has since asked for a DECLARED balance per
> account per platform ('300 usd in usdt trc20, 200 usd sham cash') — a figure a human types for the
> rails no chain can answer for. When that exists it belongs in this component and nowhere else... No
> endpoint is assumed for it here."_

and the messages file, next to the untracked copy: `messages.ts:282-283` — _"Declared balances are
what will fill this line — see `AccountBalance`."_ This ticket is that line.

**Problem.**
An operator is presently tracking these figures somewhere off-platform — a notebook, a phone note —
because the console has nowhere to put a number nobody can verify by API. The number is real to the
operator (it decides whether they trust a rail enough to keep sending players to it) and it is
explicitly **not** ledger money: it must never be credited, debited, or read by any deposit,
reconciliation or ledger code path. It is bookkeeping, displayed back to the person who typed it, with
a timestamp so they know how old it is.

**Evidence.**

_Backend — the pattern to mirror, verified:_

- `prisma/schema.prisma:495-526`, `model PaymentDestination` — `dailyCapMinor BigInt? @map("daily_cap_minor")` (`:511`) is the existing precedent for a nullable minor-unit money column on this exact
  model: optional, operator-set, never defaulted.
- `prisma/schema.prisma:715-748`, `model ExchangeRate` — `setByAdminId String? @map("set_by_admin_id") @db.Uuid` (`:734-735`) **with a real FK relation** —
  `setBy AdminUser? @relation("ExchangeRateSetBy", fields: [setByAdminId], references: [id], onDelete: Restrict)` (`:742`). This is the closer precedent for "who set this hand-typed figure" than a
  bare, relationless column: it is in the same module family (payment/money configuration, not a
  polymorphic actor like `AuditLog.actorId`), and `ReconciliationBreak.resolvedByAdminId`
  (`:1347-1349,1363`) is FK'd the same way. Give `declaredBalanceSetByAdminId` a real relation to
  `AdminUser`, named distinctly (e.g. `"PaymentDestinationDeclaredBalanceSetBy"`), rather than a bare
  column — nothing in this module needs the relationless style `AuditLog.actorId` uses for a genuinely
  polymorphic actor.
- **Re-verified 2026-08-27, exhaustively, because a later brief for this same ticket asserted the
  opposite.** Grepped every `*AdminId … @db.Uuid` column in `prisma/schema.prisma`: `setByAdminId`
  (`ExchangeRate`, `:735`→`:742`), `decidedByAdminId` (`DepositRequest`, `:794`→`:836`; `PlayerDebit`,
  `:988`→`:1001`), `secondApproverAdminId` (`DepositRequest`, `:796`→`:837`), `revokedByAdminId`
  (`SelfExclusion`, `:1433`→`:1439`), `assignedToAdminId`/`resolvedByAdminId` (`ReconciliationBreak`,
  `:1347-1349`→`:1362-1363`) — **all six** carry `@relation(fields: [xAdminId], references: [id],
  onDelete: Restrict)`. Zero counterexamples exist for a single-purpose `*AdminId` column. The only
  relationless actor columns in the whole schema are the genuinely polymorphic ones that pair an id
  with an `ActorType`/`*Type` enum because the actor is not always an admin — `AuditLog.actorId`,
  `LedgerTransaction.actorId`, `DepositTransition.actorId`, `PlayerLimit.setById`,
  `SelfExclusion.requestedById`. `declaredBalanceSetByAdminId` has no such polymorphism (the audit row
  already records the generic actor; this column exists only to say *which admin*), so it takes the
  six-for-six FK pattern, not the polymorphic one. **A brief instructing "plain uuid column, no FK
  relation, matching how other setBy uuid columns are done" is factually wrong about this codebase —
  there is no such precedent to match — and must not be followed.**
- `src/modules/payment-method/dtos/payment-destination.dto.ts:55-60,92-96` — `dailyCap` DTO field:
  `@IsOptional() @IsString() @Transform(trim) @Matches(MONEY_STRING_REGEX, {...})`. Mirror this for
  the balance field on the new dedicated DTO.
- `src/modules/payment-method/dtos/payment-destination.dto.ts:116-123` — `AdminPaymentDestinationView`
  is exactly the interface `toAdminDestinationView` (below) fills in; the four new fields join it the
  same way `dailyCap: string | null` already does.
- `src/modules/payment-method/services/payment-destination.service.ts:55-68` — `toAdminDestinationView`:
  `dailyCap: destination.dailyCapMinor === null ? null : formatMinorToDecimal(destination.dailyCapMinor)`.
  The same ternary, against `declaredBalanceMinor`, is the whole job of exposing the formatted string.
- `src/modules/payment-method/services/payment-destination.service.ts:88-134` (`create`),
  `:136-178` (`update`) — both wrap the write and the `this.audit.write(tx, {...})` call in the same
  transaction, and both build a `before`/`after` snapshot (`:237-247`, `snapshot()`) that already
  stringifies `dailyCapMinor` with `?.toString() ?? null` for the JSON column. The declared-balance
  write needs the identical shape: one transaction, one audit row, a snapshot that includes the four
  new fields.
- `src/modules/payment-method/utils/money-input.util.ts:25-32` (`toMinorOrNull`) and `:10-23`
  (`toMinorOrThrow`, throwing `ValidationError` with `CommonErrorCodes.INVALID_AMOUNT` on a malformed
  decimal) — the exact function `dailyCap` already runs through. Use it unchanged; do not write a
  second parser.
- `src/common/helpers/money.util.ts:15` — `DEFAULT_MONEY_SCALE = 2`. `dailyCap` already ignores the
  method's own currency scale and always formats at 2dp; the declared balance should do the same for
  consistency, since (per the next bullet) its currency is not even the ledger's.
- `src/modules/payment-method/controllers/admin-payment-method.controller.ts:114-122` (`createDestination`) and `:152-159` (`deactivateDestination`) — the guard pattern to copy:
  `@AdminAuth(...PAYMENT_METHOD_MANAGER_ROLES)` directly above the route decorator. **Do not** copy
  `updateDestination` (`:143-150`) — see CC-021, filed alongside this ticket: that route currently
  carries no `@AdminAuth` at all. This is exactly why a dedicated route is the safer choice here, not
  merely the "clearer and auditable" one — folding this onto the general update endpoint would inherit
  a live, unguarded write path.
- `src/modules/payment-method/payment-method.constants.ts:52-56` — `PAYMENT_METHOD_MANAGER_ROLES =
  ['SUPER_ADMIN', 'FINANCE_ADMIN']`. The same boundary argued at `:63-69` for why `PLATFORM_ADMIN`
  reads and does not write applies here without adjustment: a declared balance is part of a
  destination's configuration, not a new kind of thing.
- `prisma/migrations/20260826140000_chain_settlements/migration.sql` — the SQL comment style to
  follow (WHY-first, `══` banners for load-bearing sections) and the latest applied-or-written
  migration; a new migration's timestamp must sort after `20260826140000`. Directory listing
  confirms no migration exists after it as of this writing.

_Console — the pattern to mirror, verified:_

- `src/features/payment-methods/method-account-card.tsx:394-417` (`AccountBalance`) — the ONE place a
  balance is allowed to appear on this card, by the component's own header comment. Today it branches
  only on `network === null` (chain vs. not). It needs a second, independent branch: the declared
  balance, shown for **every** destination — chain and non-chain alike, per the operator's own
  examples ("300 usd in usdt trc20" is a declared figure on a crypto rail sitting beside the live
  chain read). Labelled so the two are never confused — "our records" beside "on-chain now", never
  merged into one figure.
- `src/features/payment-methods/wallet-balance.tsx` — the sibling component to model the new UI on:
  its own query, its own four states, `TimeAgo` (`src/components/common/time.tsx:10-30`) for the
  "checked …" line (`:100-104`), and the hard rule stated in its header — an unknown figure must never
  render as a zero. The declared balance's version of that rule is softer: **zero IS a valid declared
  answer** (an operator can truthfully type "0" for an empty till), so the empty state here is "no
  figure has been typed", not "the figure could not be read" — a different sentence from
  `financial.balance.untracked`'s current wording, which needs to change to something like "add
  balance" rather than implying nothing can ever be known.
- `src/features/payment-methods/destination-form-dialog.tsx:60-71` — `capField`, the exact
  Zod validation shape to mirror for the new amount field: `MONEY_STRING_REGEX` format check, no
  leading `-`, and `isRoundTrippableAmount` (`rail-money.ts:28-34`) so a figure the console cannot
  round-trip through minor units is refused before it is sent.
- `src/features/payment-methods/destination-form-dialog.tsx:208-211` — the comment recording that
  `dailyCap`, once set, **cannot currently be cleared** through the console UI because "the update
  body has no way to say 'none'" (an empty string is omitted from the request rather than sent).
  `UpdatePaymentDestinationBody` (`src/types/payment-method.ts:88-91`) types every field as
  optional-when-absent, with no explicit-null case. The declared balance does not get to inherit that
  gap — "clearing both fields clears the balance" is a stated requirement — so its body type must
  admit an explicit `null`, not just "field omitted", and the dedicated endpoint's DTO must accept
  `null` as "clear this", distinctly from "omitted" (which cannot occur, because every call to this
  endpoint replaces the whole declared-balance state — see the decision on partial updates, below).
- `src/types/payment-method.ts:35-48` — `paymentDestinationSchema` is `z.looseObject`, so the four new
  wire fields need to be added as typed, nullable members (`declaredBalance: z.string().nullable()`,
  etc.) rather than left to pass through untyped.
- `src/lib/api/endpoints.ts:262-274` — `paymentMethodsApi.updateDestination` already uses
  `api.patch`; the new call is `api.patch(paymentDestinationSchema,
  '/v1/admin/payment-destinations/${id}/declared-balance', { body })` — same client, same envelope,
  no new machinery.
- `src/lib/api/queries.ts:433-443` (`usePaymentMutation`) — every destination mutation invalidates
  `paymentMethodKeys.all` on success; the new hook uses the same helper, so the card refetches for
  free.
- `src/lib/auth/permissions.ts:22-23,156-157` — `paymentMethods.write` is the capability already
  gating every other destination-write control on this card; the new "Add/edit balance" control uses
  the same `<Can capability="paymentMethods.write">` (`src/components/common/can.tsx:13-24`), no new
  capability needed.
- `src/mocks/fixtures.ts:534-615` — the six destination fixtures need the four new fields (mixed:
  some set, some `null`, so the empty state and the populated state both have fixture coverage).
- `src/mocks/handlers.ts:773-780` (list), `:820-842` (create/update/delete) — a new
  `http.patch('/v1/admin/payment-destinations/:id/declared-balance', ...)` handler joins these,
  writing the four fields onto the matched row in `db.destinations` the same way the existing PATCH
  handler does.
- `src/features/payment-methods/financial-page.test.tsx:140-153,183-190` — two EXISTING tests assert
  the literal copy `'No balance is tracked for this account yet.'` for a cash method and a bank-coded
  destination. Both will need rewriting once that copy is replaced by the empty "add balance" state —
  they are not incidental collateral, they are pinning the exact behaviour this ticket changes.

**The decisions (ask the owner first — none of them block starting the plumbing above).**

1. **Currency-label shape.** `PaymentMethod.currencyCode` on the console form is validated
   `^[A-Z]{3}$` (`method-form-dialog.tsx:82-85`) because every seeded currency code happens to be
   three letters. The backend column for this new field is `VARCHAR(8)` and the two examples given —
   `USD`, `NSP` — both happen to fit three letters too, but nothing requires that: an operator typing
   `USDT` for a crypto rail's own declared figure is four. Decide the validation regex once
   (recommend `^[A-Z]{2,8}$`, letters only, bounded by the column width) rather than each side
   guessing differently.
2. **Staleness.** Flagged explicitly in `docs/USDT-RAILS-STATE.md:183-185`: _"Cash rails have no chain
   to ask, so those would be hand-declared and would go stale silently — needs a decision before
   building."_ `ExchangeRate` has a real staleness model (`isStale`, `maxAgeHours`,
   `exchange-rate.dto.ts`) because a stale rate silently mis-prices every deposit behind it — real,
   automatic consequences. A stale declared balance has none: nothing reads it but a human looking at
   the card. Recommend **no** staleness model for v1 — a plain "updated 6 days ago" via `TimeAgo` and
   trust the operator to judge it, matching how `dailyCap` and every other hand-set figure on this
   card works today. If the owner wants a warning past some age (mirroring the exchange-rate pattern),
   that is a larger, separate decision — say so explicitly rather than half-building it.
3. **Whole-state replacement vs. partial update.** The endpoint sets `declaredBalanceMinor`,
   `declaredBalanceCurrency`, `declaredBalanceUpdatedAt` and `declaredBalanceSetByAdminId` together, as
   one fact ("this account currently declares to hold X"). Confirm the body is `{ balance: string |
   null, currency: string | null }` where the two must agree — both present (a new declaration) or
   both `null` (clear) — never one without the other, and add a CHECK constraint enforcing that
   pairing at the database level too (`(declared_balance_minor IS NULL) = (declared_balance_currency
   IS NULL)`), the same belt-and-braces the `chain_settlements` migration argues for its own CHECKs.

**In scope.**

_Backend:_

- Prisma migration adding `declaredBalanceMinor BigInt?`, `declaredBalanceCurrency String?
  @db.VarChar(8)`, `declaredBalanceUpdatedAt DateTime?`, `declaredBalanceSetByAdminId String?
  @db.Uuid` (with an FK relation to `AdminUser`, per the evidence above) to `PaymentDestination`.
  Timestamped after `20260826140000_chain_settlements`. CHECK constraints: `declared_balance_minor >=
  0` (zero is a valid answer, unlike a chain balance — do not copy `chain_settlement_amount_positive`'s
  strict `> 0`), and the null-pairing CHECK from decision 3. Run `npx prisma format` and `npx prisma
  generate`. **Do not run `prisma migrate deploy`** — the operator applies it.
- `PATCH /v1/admin/payment-destinations/:id/declared-balance`, its own DTO, gated
  `@AdminAuth(...PAYMENT_METHOD_MANAGER_ROLES)` (copy the pattern from `createDestination`, not from
  `updateDestination` — see CC-021). Writes all four columns in one transaction with one
  `payment_destination.declared_balance_set` (or `_cleared`) audit row, before/after snapshotted like
  every other destination mutation.
- `declaredBalance` (formatted string), `declaredBalanceMinor` (string), `declaredBalanceCurrency`,
  `declaredBalanceUpdatedAt` (ISO) added to `AdminPaymentDestinationView` and `toAdminDestinationView`,
  null when unset — the same shape `dailyCap` already has.
- Tests mirroring `payment-destination.service.spec.ts`'s style: set-and-echo, clear-nulls-all-four,
  a non-manager role refused, a malformed decimal refused, round-trip through the admin view. Add
  `admin-payment-method.controller.spec.ts` coverage for the new route while CC-021 is adding that
  file anyway (coordinate, do not duplicate).

_Console:_

- `AccountBalance` (`method-account-card.tsx`) grows a declared-balance section, shown for every
  destination regardless of rail, clearly labelled apart from `WalletBalance`'s live chain figure.
  Empty state (`declaredBalance === null`): replaces `financial.balance.untracked`'s current wording
  with an "add balance" affordance gated by `<Can capability="paymentMethods.write">`. Set state:
  amount + currency + `TimeAgo` "updated …" stamp.
- A small edit dialog (new file, e.g. `declared-balance-dialog.tsx`) reusing `Dialog`/`Field` from
  `form-field.tsx` and the existing `capField`-style validation — do not build a new form primitive.
  Amount field: decimal string, non-negative, round-trippable (mirror `capField`). Currency field:
  short text, validated per decision 1. Clearing both fields and saving sends the explicit-null clear.
- `declaredBalance`, `declaredBalanceMinor`, `declaredBalanceCurrency`, `declaredBalanceUpdatedAt`
  (all nullable) added to `paymentDestinationSchema`/`PaymentDestination` in
  `src/types/payment-method.ts`, plus a `SetDeclaredBalanceBody` type admitting the explicit-null
  clear shape.
- `paymentMethodsApi.setDeclaredBalance` in `endpoints.ts`; `useSetDeclaredBalance` in `queries.ts`
  using the existing `usePaymentMutation` invalidation helper.
- MSW handler in `handlers.ts`; the four fields added to every destination fixture in `fixtures.ts`
  (mixed set/unset, so both card states have fixture coverage without inventing new IDs).
- `en` + `ar` keys in the payment-methods `messages.ts` for: the "our records" label, the empty state
  and its call to action, the dialog's title/fields/hints, and the currency-format validation message.
  Real Arabic, not transliteration — `رصيد` (balance), `حُدّث` (updated), matching the register already
  used across this file's existing `financial.*` keys.
- Rewrite `financial-page.test.tsx:140-153,183-190` for the new empty-state copy, and extend it (or a
  new `method-account-card.test.tsx`) with the populated-state assertions below.

**Out of scope.**

- Any deposit, credit, ledger or reconciliation code path reading `declaredBalance*`. It is
  display-only; a test in this ticket (see acceptance criteria) proves nothing reads it outside the
  admin view and the card.
- Sham Cash session cookies/tokens — untouched, out of scope, live secrets.
- `PUT`, anywhere. The new route is `PATCH`.
- Any change to `WalletBalance` or the live chain-read path — the two figures sit side by side and
  neither is derived from the other.
- CC-021's fix to `updateDestination`/`destinationBalance` — filed separately; this ticket's new route
  is written correctly from the start and does not depend on that ticket landing first, but its
  author should read CC-021 before touching this controller.
- A staleness/expiry model, unless decision 2 above says otherwise.

**Acceptance criteria.**

1. Setting a balance on a destination stores and echoes back `declaredBalance`, `declaredBalanceMinor`,
   `declaredBalanceCurrency`, `declaredBalanceUpdatedAt`, and `declaredBalanceSetByAdminId` resolves to
   the calling admin (verified server-side, not client-supplied).
2. Sending the explicit clear (`balance: null, currency: null`) nulls all four displayed fields.
3. A role outside `PAYMENT_METHOD_MANAGER_ROLES` is refused with `INSUFFICIENT_ROLE`; nothing is
   written.
4. A malformed decimal (`"12.3.4"`, a leading `-` where refused, more than 2 fractional digits if that
   remains the scale) is refused with `INVALID_AMOUNT` naming the field; nothing is written.
5. The value round-trips through `toAdminDestinationView` byte-for-byte (decimal in, same decimal
   string out, not renormalised to a different number of trailing zeros than `formatMinorToDecimal`
   already produces for every other money field).
6. The account card shows the declared balance, its currency, and a relative "updated" stamp for
   every rail — including a crypto rail that also shows a live `WalletBalance` — with the two
   unmistakably labelled apart.
7. When unset, the card shows an "add balance" affordance instead of the old "untracked" sentence,
   visible only to `paymentMethods.write` holders; a reader-only role sees no affordance and no stale
   claim that nothing can ever be known.
8. The edit dialog validates the amount the same way `capField` does and refuses to submit a
   non-decimal amount client-side, before any request is sent.
9. Clearing both fields in the dialog and saving clears the balance on the card.
10. `declaredBalanceMinor`/`declaredBalanceCurrency` are not read by any deposit, credit, ledger or
    reconciliation service — a test walks those modules (or greps them) and finds no reference.
11. Every new user-facing string exists in `en` and `ar`.

**Test cases.**

| Id       | Level     | Given / When / Then                                                                                                  |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| TC-20.1  | backend   | Set `{ balance: '200.00', currency: 'USD' }` on a destination · Then the admin view echoes all four fields, and `declaredBalanceSetByAdminId` is the caller's id, not anything sent in the body. |
| TC-20.2  | backend   | Given a balance already set · When `{ balance: null, currency: null }` is sent · Then all four fields are `null` on the next read. |
| TC-20.3  | backend   | Given `{ balance: '100', currency: null }` (mismatched pair) · Then refused — the pairing CHECK/DTO rule, not a partial write. |
| TC-20.4  | backend   | Given a `SUPPORT`-equivalent (reader-only) token · When the route is called · Then `403 INSUFFICIENT_ROLE` and the row is unchanged. |
| TC-20.5  | backend   | Given `{ balance: '12.3.4', currency: 'USD' }` · Then `INVALID_AMOUNT` naming `balance`; nothing written. |
| TC-20.6  | backend   | Set `'0'` · Then it round-trips as `'0.00'`, not treated as absent — zero is a valid declared answer. |
| TC-20.7  | backend   | Set a balance, then deactivate the destination · Then the balance survives deactivation unchanged (declaring a figure and retiring an account are independent acts). |
| TC-20.8  | backend   | A grep/module test confirms no file under `deposit`, `ledger`, `reconciliation` imports or reads `declaredBalanceMinor`/`declaredBalanceCurrency`. |
| TC-20.9  | component | A destination with a declared balance renders the amount, its currency and an "updated …" relative stamp, labelled apart from the live chain figure on a crypto rail. |
| TC-20.10 | component | A destination with no declared balance renders the "add balance" affordance for a `paymentMethods.write` role and nothing (no stale "untracked" claim, no affordance) for a read-only role. |
| TC-20.11 | component | The edit dialog rejects `'12.3.4'` client-side; no request is sent. |
| TC-20.12 | component | Clearing both fields in the dialog and saving results in the card showing the empty state again. |
| TC-20.13 | component | A role without `paymentMethods.write` sees the declared figure (or its empty state) but no edit control anywhere on the card. |
| TC-20.14 | build     | Every new key exists in `en` and `ar`.                                                                                     |

**Files likely touched.**
_Backend:_ `prisma/schema.prisma`, `prisma/migrations/<new>/migration.sql`,
`src/modules/payment-method/dtos/payment-destination.dto.ts`,
`src/modules/payment-method/services/payment-destination.service.ts`,
`src/modules/payment-method/services/payment-destination.service.spec.ts`,
`src/modules/payment-method/controllers/admin-payment-method.controller.ts` (and its new spec, shared
with CC-021).
_Console:_ `src/features/payment-methods/method-account-card.tsx`,
`src/features/payment-methods/declared-balance-dialog.tsx` (new),
`src/features/payment-methods/financial-page.test.tsx`, `src/features/payment-methods/messages.ts`,
`src/types/payment-method.ts`, `src/lib/api/endpoints.ts`, `src/lib/api/queries.ts`,
`src/mocks/handlers.ts`, `src/mocks/fixtures.ts`, `docs/API-CONTRACT.md`.

---

## 5. Deliberately not in this backlog

Things that look like gaps and are not, recorded so nobody re-raises them:

- **No refresh token.** By design — admins get an access token only, the console watches `expiresAt`
  and signs out cleanly (`docs/API-CONTRACT.md` §2, `src/lib/auth/auth-provider.tsx:80-98`).
- **The tenant switcher is hidden from `SUPER_ADMIN`.** By design — the backend ignores
  `X-Tenant-Id` from non-platform roles, so offering the choice would be a lie
  (`tenant-switcher.tsx:22-26`).
- **`PLATFORM_ADMIN` cannot approve a deposit.** By design, and deliberately not a superset of
  `SUPER_ADMIN` — approval is bounded by an `admin_approval_limits` row that a platform admin has
  none of (`permissions.ts:41-70`).
- **Deleting anything.** Nothing on the money path is deleted; `DELETE` deactivates
  (`docs/API-CONTRACT.md` §4).
- **Balances are read four at a time.** By design — one upstream Ichancy call per player through
  Cloudflare (`endpoints.ts:150-160`, `concurrency.ts`).
- **A queue tile can say "20+".** By design — the queue is cursor paginated and sends no total; the
  console does not invent one (`overview-page.tsx:12-18`).
