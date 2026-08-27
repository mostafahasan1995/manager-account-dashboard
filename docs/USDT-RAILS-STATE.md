# USDT rails — where we got to

Handoff note. Two repos:

- **BACKEND** `c:\Users\Mustafa\personal\Telegram-mini-app`
- **CONSOLE** `c:\Users\Mustafa\personal\New folder\manager-account-dashboard`

## Verified state at stop

| | |
|---|---|
| Backend | **1750 tests / 110 suites passing**, `tsc` clean, `eslint` clean |
| Console | **97 files / 1259 tests passing**, `tsc` clean, `eslint` clean, coverage **90.97 / 85.77 / 90.30 / 92.32** over the 90/84/89/91 gate. Integrator pass over both agents' work completed 2026-08-26. |
| Committed | Nothing since `2cd2463`. Everything below is working-tree only. |

---

## The flow, as built

Player picks USDT → bot shows the operator's wallet → player pays → player sends the tx hash →
we read the chain → priced at the USDT→NSP rate → credited.

Money **out** (payouts) stays manual and always was: `player-debit.service.ts` is
*"admin-initiated only: there is no player-facing request, no queue"*.

---

## Bugs found and fixed (all were live in shipped code)

These are the ones worth remembering, because each shared a root cause worth not repeating.

1. **BSC USDT has 18 decimals, not 6.** Verified by calling `decimals()` on the live contract.
   `USDT_SCALE = 6` was applied to both chains, so every BEP20 deposit would have credited **10¹²
   times** its value. Fixed with `USDT_DECIMALS` + `toCanonicalUsdtMinor()`.

2. **TronGrid `Approval` events were credited as payments.** `/transactions/trc20` returns TRC20
   *events*, not payments. An `Approval` has the same shape but moves nothing — anyone could emit one
   for ten million USDT naming the operator's wallet, for a few cents. `type` was declared on the
   interface and set to `'Transfer'` in every fixture, then never read in production code.

   > **Both of the above passed all their tests.** The fixtures encoded the same wrong assumption as
   > the code. A test that agrees with the code about the world proves only that they agree.

3. **The whole chain-check was inert for real rails.** `networkFor()` keyed on the seeded codes
   `USDT_TRC20`/`USDT_BEP20`. The operator's actual rail is coded `USDT`, so it returned null,
   `check()` answered `skipped`, and no deposit on it was ever verified — silently. Now the chain is
   read off the **address** (`T…` = TRC20, `0x…` = BEP20). An address cannot lie about its chain the
   way a name can.

4. **Rate editing failed with a CORS error.** `@Put('usdt')` was the only PUT in 75 routes and
   `main.ts` allows `GET/POST/PATCH/DELETE/OPTIONS`. Now POST, plus `core/http/cors-methods.ts` +
   spec that walks every route decorator and fails the build on an unreachable verb.

5. **Same transfer creditable more than once** — case variants (`ABC…`/`abc…` are two rows to a
   case-sensitive index, one transfer to Tron) and cross-tenant (the old index keys on
   `payment_method_id`, which is per-operator). Closed by the `chain_settlements` table.

6. **Unconfirmed blocks** — the Tron query now passes `only_confirmed=true`.

---

## Backend: what exists

### `src/core/chain/`
- `chain-verifier.types.ts` — `ChainVerifier` port, six-outcome `ChainVerificationStatus`,
  `ChainBalance` (a **union**, so `balance ?? 0n` cannot be written — an outage must never render as
  an empty wallet), `USDT_DECIMALS`, `toCanonicalUsdtMinor()`, `fromAddress` on `ChainVerification`.
- `tron-verifier.service.ts` — TronGrid. Checks `type === 'Transfer'`, the contract, the destination
  in code (not just via `only_to`), and the reported decimals against expectation.
- `bsc-verifier.service.ts` — plain JSON-RPC. `balanceOf` selector `0x70a08231`, verified live.
- Specs: 48 tests incl. `balance-read.spec.ts`.

### Deposit path
- `deposit-chain-check.service.ts` — joins chain truth to the rate. **Asymmetric tolerance**: any
  shortfall → human (zero tolerance); small overage → auto. The asymmetry is load-bearing — a round
  1,000,000 NSP deposit is 75.7575… USDT and no wallet sends fractions of a cent, so requiring
  exactness would refer nearly every deposit to a person.
- `auto-credit-decision.ts` + spec (26 tests) — the guards. Pure function; see Auto-deposit below.
- `deposit-review.service.ts` — `Approver` gained a third variant `{ kind: 'CHAIN'; evidence }`,
  deliberately **not** a flavour of the test-mode `AUTO` (which means "nobody checked anything" and
  is refused in production).

### Elsewhere
- `core/payments/wallet-address.ts` — per-network validation, `detectWalletNetwork()`.
- `payment-destination.service.ts` — refuses a cross-network address **server-side** on create.
- `destination-balance.service.ts` — `GET /v1/admin/payment-destinations/:id/balance`, 30s cache,
  failures deliberately not cached.
- `agent-float-read.service.ts` — `GET /v1/admin/agent-float`. Deliberately **not** routed through
  the float *sync*, which calls Ichancy and opens a reconciliation break on disagreement — behind a
  pill on every screen that would file a break per page load and bury the real ones.
- `core/http/cors-methods.ts` + spec.

### Migrations — **`chain_settlements` NOT YET APPLIED**
- `20260826120000_exchange_rates` — applied ✅
- `20260826140000_chain_settlements` — **written, not applied.** Run `npm run prisma:deploy`.
  `UNIQUE (network, tx_hash)`, tenant-blind on purpose; `CHECK (tx_hash = lower(tx_hash))`.
  Deliberately absent from `TENANT_SCOPED_MODELS`, and `tenant-scope.extension.spec.ts` asserts that
  absence so nobody "fixes" it back into the hole.

### Config (new, all off by default)
`DEPOSIT_AUTO_CREDIT_CHAIN_VERIFIED`, `DEPOSIT_AUTO_CREDIT_MAX_MINOR`,
`DEPOSIT_AUTO_CREDIT_DAILY_MAX_MINOR`, `DEPOSIT_AUTO_CREDIT_MAX_RATE_AGE_MINUTES` (default 360).
The env schema **refuses to boot** if the flag is on without both ceilings — no defaults, because a
default is a number nobody chose governing money nobody is watching.

---

## Console: what exists

`financial-page.tsx`, `method-account-card.tsx` (was `usdt-rail-card.tsx` — it is no longer only
about USDT), `wallet-balance.tsx`, `usdt-rate-panel.tsx`, `seed-placeholder.ts`, `agent-float-pill.tsx`
(mounted at `topbar.tsx:138`), `wallet-address.ts` (reworked to detect by address, with a regression
test for a rail named plain `USDT`), plus mocks and tests. Route `/financial`, nav label
"Financial settings" / "الإعدادات المالية".

Deposit side: `chain-verdict.tsx` + `chain-money.ts`, mounted at `deposit-review-sheet.tsx:139` and
read again by `approve-dialog.tsx` off the same query key.

---

## Auto-deposit — COMPLETE

The full path works: player pays → sends hash → deposit submitted → a `chain` queue job looks at the
chain → still confirming, so it looks again in 45s → confirmed → decision runs → credited.

- `auto-credit-decision.ts` — pure, 26 tests. Every guard is one testable case.
- `deposit-auto-credit.service.ts` — gather (chain, known wallets, ceilings, float) → decide → write.
  The gather CANNOT be in a transaction: a transaction may be replayed by the serialization retry
  helper, and a replayed TronGrid call is at best wasted quota and at worst a different answer.
- `DepositReviewService.approveFromChainEvidence()` — re-enters the ONE existing `finalizeApproval`,
  and writes the `chain_settlements` row in the SAME transaction so the unique index rolls the ledger
  postings back with it. Re-checks two things inside the transaction: nobody has claimed it, and the
  hash has not been swapped (a player can re-submit a reference on a queued deposit).
- `ChainWatchProcessor` on a new `chain` queue — re-enqueues itself rather than throwing, because
  BullMQ's `attempts` budget is for TRANSPORT failures and "still confirming" is not a failure.
  45s × 20 = 15 minutes of patience, then it waits for a human.
- Config in `.env.example`, off by default; the process refuses to boot with the flag on and either
  ceiling unset.

**Rate-change narrowing also landed**: `confirmLargeChange` no longer comes off the request body
unchecked — only SUPER_ADMIN may override the implausible-jump guard, logged loudly. Written as a
narrowing, not four-eyes: rates have no second-approver machinery and the comment says so.

## Loose end, needing a decision

**The platform-defaults slice is orphaned.** `platformDefaultsApi`, `usePlatformDefaults`,
`useUpdatePlatformDefaults`, its query keys, types and MSW handlers all exist and are coherent — and
no component or test references any of them. It is left over from CC-017 in docs/TASKS.md, where the
backend endpoint and the console client landed but the UI panel never did.

Left exactly as it is on purpose: wiring it adds a feature nobody asked for in this thread, and
deleting it throws away most of a task that was asked for earlier. Both are scope changes, so it is
your call.

## Unfinished — pick up here

**~~1. Console verification.~~ DONE** — see the table at the top. The suite was also genuinely
flaky and is no longer: every failure was a `findBy*` or test-timeout expiring under v8 coverage
instrumentation, never an assertion about content, so `asyncUtilTimeout` (`src/test/setup.ts`) and
`testTimeout` (`vitest.config.ts`) were raised. Deadlines only — nothing that can turn a failing
expectation into a passing one. Three consecutive clean runs.

**~~2. Financial settings should cover EVERY rail.~~ DONE** — `/financial` lists methods unfiltered
and `MethodAccountCard` decides what it can truthfully say from the RAIL and the ADDRESS. A `SHAM`
cash method shows its account with an edit control; a `USDT` crypto method shows its chain badge and
live balance. Pinned by `financial-page.test.tsx`.

**~~3. Verify the float pill is actually MOUNTED in `topbar.tsx`.~~ DONE** — `topbar.tsx:138`, and
`topbar.test.tsx` pins the mount rather than only the component, so it cannot be orphaned again.


**~~5. Surface the chain verdict in the console.~~ DONE** — `GET /v1/admin/deposits/:id/chain-check`
as its own resource, its own query-key root outside `depositKeys.all` (a review action invalidates
that whole namespace), rendered by `ChainVerdict` in the review sheet and offered as a one-click
amount in the approve dialog. `deposits-page.test.tsx` pins the N+1 rule: the queue asks about no
row, opening one deposit asks exactly once.

> **Still owed by the backend.** The endpoint does not exist yet. Until it ships, an opened deposit
> gets a 404, which the panel renders as `unavailable` — our outage, not a verdict against the
> player — so it degrades honestly rather than blocking review.


**7. Per-account declared balances** (operator's idea: *"300 usd in usdt trc20, 200 usd sham cash,
2,000,000 nsp sham cash"*). Crypto half is built and reads live. Cash rails have no chain to ask, so
those would be hand-declared and would go stale silently — needs a decision before building.

---

## Open adversarial findings not yet closed

From a 3-lens review of the auto-credit design (23 findings; 8 critical, 11 high). Closed so far:
Approval events, 18-decimals, case-variant/cross-tenant replay, unconfirmed blocks, sender binding
(designed, decision function written). Still open:

- **Tron reports a fabricated confirmation depth** — `TronVerifierService` returns
  `confirmations: required` unconditionally, so `pending` is unreachable on TRC20. Either give it a
  real depth check or have auto-credit refuse when depth was not genuinely measured.
- **No runtime kill switch** — the flag is env-only, so disabling it needs a redeploy of every worker.
- **Ceilings are deployment-global** env values in a per-tenant, multi-currency system.
- **A payout address is still unvalidated on the rails operators actually create** — NEW, found
  during the integrator pass, and the same root cause as bug 3 above rather than a new one.
  `payment-destination.service.ts:214` looks the network up in a table keyed on
  `USDT_TRC20`/`USDT_BEP20` and `return`s when the code is unknown, so a rail coded `USDT` — the
  operator's own — gets no address check at all on create. `accountIdentifier` is immutable by
  design, so a bad paste is permanent. The console's `wallet-address.ts` says the backend refusal
  "is the control" and its own check only adds timing and language; that is currently untrue, and
  the console check is the only one there is. Written up as **CC-019** in `docs/TASKS.md`.

Full findings: `journal.jsonl` under
`.claude/projects/<project>/<session>/subagents/workflows/wf_e395f28c-415/`.

---

## Operator context worth keeping

- Their rail is coded **`USDT`**, not `USDT_TRC20`. Never key logic on method codes.
- Rate in use: **13,200 NSP per USDT** (old pound; they confirmed this deliberately).
- TronGrid key is in their `.env` (gitignored). They consider it monitor-only and chose not to rotate.
- BSC uses the public RPC `https://bsc-dataseed.bnbchain.org` — no key.
- Language: the console is used in **Arabic**. Every string needs a real `ar` translation.
