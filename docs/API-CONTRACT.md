# The backend contract this console is built against

Source of truth: `../Telegram-mini-app` (`ichancy-cashier-backend`, NestJS 11 + Prisma 7).
Everything below was read out of the controllers, DTOs and `prisma/schema.prisma` — not guessed.

---

## 1. The envelope

Every JSON response — success or failure — is wrapped:

```ts
interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: { correlationId: string; timestamp: string; [key: string]: unknown };
}
```

Paginated endpoints put the page info **in `meta`**, not in `data`:

- offset pages add `{ total, limit, offset, hasMore }`
- cursor pages add `{ limit, nextCursor, hasMore }`

`data` is the plain array in both cases. The client unwraps this in one place
(`src/lib/api/client.ts`) so no feature ever touches the envelope.

**Money is never a number.** Amounts cross the wire as decimal strings (`"1500.00"`) and/or minor
units as strings (`"150000"`). A 64-bit Telegram id and a chat id are strings for the same reason.
`src/lib/money.ts` is the only place that parses them.

**Errors** carry a stable `code` (e.g. `DEPOSIT_NOT_FOUND`, `ADMIN_INACTIVE`, `VALIDATION_FAILED`).
Validation failures put the offending field messages in `details.fields: string[]`.

Useful headers: `x-correlation-id` (echoed, show it in error toasts), `retry-after` and
`x-ratelimit-*` on 429, `idempotency-key` accepted on POSTs.

---

## 2. Authentication

There are **two** doors into an admin session, and they answer different questions.

Both are public routes, both answer the same `AdminSessionView`, and both hand back an **access
token only — there is no admin refresh token**. When it expires the admin signs in again. The
console therefore watches `expiresAt`, warns before expiry, and signs out cleanly on any 401. Every
other call sends `Authorization: Bearer <accessToken>`.

```
AdminSessionView = { accessToken, expiresAt, admin, tenantId, tenantSlug }
                   admin = { id, telegramUserId, role, displayName }
```

### 2a. Bot code — "I am this person"

The admin sends `/console` to the tenant's Telegram bot, gets a one-time code, and exchanges it:

```
POST /v1/admin/auth/bot-code        { code }  ->  AdminSessionView
```

- Rate limited to 10 attempts per minute, blocked for 5 after that.
- Any role. **This is the only way to sign in as a `PLATFORM_ADMIN`**, which has no Ichancy agent of
  its own to prove itself with.
- An invalid _and_ an expired code both answer `BOT_CODE_INVALID` on purpose. Do not tell them apart
  in the UI either.

### 2b. Ichancy agent account — "I am this operator"

An operator **is** an Ichancy agent: `ichancyUsername` / `ichancyPassword` on its tenant row are the
account that registers its players and holds its float. Those are what it signs in with, and the
session it gets back is that operator's `SUPER_ADMIN`.

```
POST /v1/admin/auth/ichancy   { username, password, operatorSlug? }  ->  AdminSessionView
```

- Rate limited to 10 attempts per minute, blocked for **15** after that — longer than the code
  route, because a bot code dies in five minutes on its own and a password does not.
- Verified against the **sealed password on the tenant row**, in constant time. It is deliberately
  not a live Ichancy `signin()`: the question is "do you hold the credential this deployment
  registers players with", the row was already proved by a real signin at activation, and putting
  Cloudflare on the login path would make an upstream outage into a lockout.
- Which `admin_users` row the session becomes: the active `SUPER_ADMIN` whose `username` equals the
  agent login, else the **oldest** active `SUPER_ADMIN` (the operator's first owner). Never a
  `PLATFORM_ADMIN`, and never any other role.
- **If the operator has no staff at all, the first successful sign-in creates its agent principal**
  — a `SUPER_ADMIN` row with `username` = the agent login and the reserved
  `telegram_user_id = 0` (Telegram numbers users from 1 up, so it can never collide, and no bot
  update can ever resolve to it). This is not a convenience: `POST /v1/admin/tenants` writes a
  tenant, a bot, a webhook and payment rails and **no staff**, so without it every new operator was
  born unable to open the console. Just-in-time, audited as `admin.user.agentPrincipalCreated` by
  the `SYSTEM` actor, and idempotent — `@@unique([tenantId, username])` settles a race.
- Consequence worth knowing: decisions taken through this door are attributed to the operator's
  agent principal, **not to a named person**. An operator that needs per-person attribution adds
  staff and has them sign in with bot codes.
- `operatorSlug` is **absent** on the first attempt. Two tenants may share one Ichancy agent — it is
  how a second operator is tested, and `TenantIchancyHealth.sharesAgentWith` already reports the
  coupling — so when they do, the server names them rather than picking one.

Its four failures, and why they are four and not one:

| Code                          | Status | Means                                                                                                                                |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `AGENT_CREDENTIALS_INVALID`   | 401    | No non-CLOSED operator holds that username and password. Says no more.                                                               |
| `AGENT_OPERATOR_AMBIGUOUS`    | 409    | Right credentials, several operators. `details.operators[{slug, displayName}]` — re-send with `operatorSlug`.                        |
| `AGENT_OPERATOR_NOT_ACTIVE`   | 403    | Right credentials, operator SUSPENDED.                                                                                               |
| `AGENT_OPERATOR_HAS_NO_OWNER` | 403    | Right credentials, and the operator's agent principal was deactivated or demoted. Not "no staff yet" — that case provisions instead. |

Nothing is said about which operators exist until the password is right; everything said afterwards
is about an operator the caller has already proved they run. Only the first of the four is fixed by
retyping, which is why the console gives each of the other three its own sentence naming who can fix
it — collapsing them into "sign-in failed" leaves an owner with correct credentials retyping them.

`AGENT_OPERATOR_AMBIGUOUS` is a **question, not a failure**: the console keeps the credential, shows
the operator picker, and re-submits with the chosen slug.

---

## 3. Roles

`AdminRole`: `PLATFORM_ADMIN | SUPER_ADMIN | FINANCE_ADMIN | REVIEWER | SUPPORT | VIEWER`.

`PLATFORM_ADMIN` runs the _platform_ (tenants) **and is the owner superset**: by the operator's
explicit decision it holds every capability every other role holds, plus the platform-level ones.
This reverses the original design, which deliberately kept it out of money decisions — see the long
note on its entry in `permissions.ts`. Its money decisions are unbounded by an approval limit (the
backend `RolesGuard` and the approval-limit evaluator both exempt it) and still land in the ledger
and the audit trail like anybody else's. `SUPER_ADMIN` runs _one tenant_ and still cannot touch
tenants.

Every row names the `Capability` in `src/lib/auth/permissions.ts` that mirrors it, and
`endpoints.contract.test.ts` fails if a capability exists there with no row here. Re-read against
the backend constants on 2026-08-25.

| Capability (`permissions.ts`) | Roles                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `deposits.read`               | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, VIEWER, PLATFORM_ADMIN |
| `deposits.decide`             | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                                  |
| `deposits.retryCredit`        | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `deposits.sweep`              | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `players.read`                | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, PLATFORM_ADMIN         |
| `players.link`                | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `paymentMethods.read`         | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, PLATFORM_ADMIN         |
| `paymentMethods.write`        | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `admins.read`                 | SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN                            |
| `admins.write`                | SUPER_ADMIN, PLATFORM_ADMIN                                           |
| `reconciliation.read`         | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, VIEWER, PLATFORM_ADMIN          |
| `reconciliation.act`          | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `tenants.manage`              | PLATFORM_ADMIN                                                        |
| `platformFinance.read`        | PLATFORM_ADMIN                                                        |
| `telegramDestinations.read`   | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, PLATFORM_ADMIN                  |
| `telegramDestinations.write`  | SUPER_ADMIN, PLATFORM_ADMIN                                           |
| `reports.publish`             | SUPER_ADMIN, FINANCE_ADMIN, PLATFORM_ADMIN                            |

**`PLATFORM_ADMIN` was once a reader that wrote almost nothing.** That is no longer true, and the
reversal was deliberate: the operator holds only the platform-admin account and needed it to do
everything. WHICH tenant an action touches is decided by the tenant it is operating in — its home
(tenant zero) when nothing is selected, or another once picked in the switcher. The `X-Tenant-Id`
override is how it REACHES another tenant, never a gate on whether the action is allowed.

**`telegramDestinations.write` is the opposite boundary to payment destinations, on purpose.** The
platform admin is kept out of an operator's payout accounts because a wrong payout address costs the
operator money; a wrong Telegram chat leaks that same operator's deposit cards into the wrong group,
and the operator is both the party harmed and the party who knows which group is right. So their own
`SUPER_ADMIN` owns it. Same question asked twice — who is harmed by a wrong value — with different
answers, rather than one blanket rule.

`admins.write` carries one extra rule the table cannot express: `mayGrantRole` refuses to hand out
`PLATFORM_ADMIN` unless the actor already holds it **and** is operating with no tenant override,
because `admin_users` is keyed on (tenant, telegram id) and the row would otherwise land inside an
operator as a tenant-scoped login holding platform authority.

The console hides what a role cannot do **and** the server enforces it. Both, not either.

---

## 4. Endpoints

### Deposits — `/v1/admin/deposits` (cursor paginated)

```
GET    /v1/admin/deposits
       ?status=SUBMITTED,UNDER_REVIEW   (comma separated; defaults to the reviewable set)
       &playerId= &paymentMethodId= &shortId= &externalReference=
       &createdFrom= &createdTo=        (ISO-8601)
       &minAmount=1500.00 &maxAmount=
       &unclaimedOnly=true
       &sort=newest|oldest|amount_desc|amount_asc
       &cursor= &limit=                 (1..100, default 20)
GET    /v1/admin/deposits/:id
POST   /v1/admin/deposits/:id/claim            -> ReviewOutcome
POST   /v1/admin/deposits/:id/release          -> ReviewOutcome
POST   /v1/admin/deposits/:id/approve          { verifiedAmount?: {amount,currencyCode}, note? }
POST   /v1/admin/deposits/:id/reject           { rejectionCode, rejectionNote? }
POST   /v1/admin/deposits/:id/retry-credit     { reason? }   -> 202 { requeued, creditKeyEpoch }
GET    /v1/admin/deposits/:id/chain-check       -> the on-chain verdict (see below)
GET    /v1/admin/deposits/:id/proofs/:proofId/url      -> { url, streamPath, expiresInSeconds }
GET    /v1/admin/deposits/:id/proofs/:proofId/content  -> the image bytes (needs the bearer token)
POST   /v1/admin/deposits/maintenance/sweep    -> { expired, released, reaped }
POST   /v1/admin/deposits/manual               { playerId, amountMinor, reason }
                                               -> 202 { shortId, status, amount:{minor,amount,currency}, outcome }
```

`POST /deposits/manual` records a hand-paid credit as a MANUAL DEPOSIT on the INTERNAL `MANUAL_CREDIT`
rail and hands it to the same `approve()` → credit-worker spine a normal deposit uses — so the player
is credited seconds later (async), a large one lands in `PENDING_SECOND_APPROVAL`, and the Ichancy
minimum is refused up front (422 `AMOUNT_BELOW_MINIMUM`). `DECIDE_ROLES` (SUPER_ADMIN, FINANCE_ADMIN,
REVIEWER) — the same money-decide set as debit. The console reaches it via `playersApi.credit(id, …)`.

`ReviewOutcome` is a discriminated union — the console must render all six arms:

```ts
| { kind: 'approved'; deposit; ledgerTransactionId: string }
| { kind: 'awaiting_second_approval'; deposit }
| { kind: 'rejected'; deposit }
| { kind: 'claimed'; deposit }
| { kind: 'released'; deposit }
| { kind: 'alreadyHandled'; status: DepositStatus | null }   // NOT an error: someone else decided
```

`AdminDepositView` (row and detail are the same shape):

```
shortId, status, claimed|verified|credited|fee: { minor, amount, currency },
externalReference, senderAccount, proofCount, createdAt, expiresAt, submittedAt, decidedAt,
creditedAt, rejectionCode, rejectionNote,
destination: { methodCode, methodName, instructions, requiresReference, label,
               accountIdentifier, accountHolder } | null,
id, playerId, playerTelegramUserId, playerTelegramUsername, paymentMethodId, reviewStartedAt,
decidedByAdminId, secondApproverAdminId, creditVerifiedBy, creditAttempts, creditKeyEpoch,
riskFlags: string[], requiresSecondApproval,
proofs: [{ id, source, mimeType, sizeBytes, sha256, width, height, createdAt }]
```

`DepositStatus`: `DRAFT AWAITING_PROOF SUBMITTED UNDER_REVIEW PENDING_SECOND_APPROVAL APPROVED
CREDITING CREDITED CREDIT_FAILED NEEDS_RECONCILIATION REJECTED EXPIRED REVERSED`

`RejectionCode`: `DUPLICATE_PROOF PROOF_UNREADABLE PROOF_MISSING AMOUNT_MISMATCH
REFERENCE_NOT_FOUND WRONG_DESTINATION SENDER_MISMATCH SUSPECTED_FRAUD LIMIT_EXCEEDED
PLAYER_INELIGIBLE EXPIRED OTHER`

#### What the chain says about one deposit — `GET /v1/admin/deposits/:id/chain-check`

The on-chain verdict for a single crypto deposit, so a reviewer in this console sees what the
Telegram admin card already showed: how much USDT actually arrived, and what it is worth at the
operator's rate. Readable by anyone who can read deposits.

```
{ outcome: 'verified'|'pending'|'mismatch'|'suspect'|'missing'|'unavailable'|'skipped',
  network: 'TRC20'|'BEP20'|null,
  summary: string,
  arrived:    { asset: 'USDT', scale: 6, minor, amount } | null,
  creditable: { minor, amount, currency }               | null,
  txHash, fromAddress, confirmations, requiredConfirmations, checkedAt }
```

- **Its own resource, never a field on the deposit view.** Answering it costs a chain call, so
  folding it into `AdminDepositView` would make `GET /v1/admin/deposits` do that once per row. The
  console fetches it for the single deposit open in the review panel and from nowhere else — it has
  a query-key root of its own so that claiming or releasing a deposit cannot invalidate it.
- **`arrived` is NOT a `MoneyView`.** It is USDT at **scale 6**; the console's money helpers default
  to 2, and `99500000` rendered at that default reads `995,000.00` — wrong by 10,000× in the exact
  figure a reviewer decides on. It carries `asset` rather than `currency` precisely so it is not
  assignable to `MoneyView`. `creditable` **is** tenant currency at the normal scale.
- **`suspect` is not a weaker `mismatch`.** The transfer is real, confirmed and paid a wallet that is
  not the operator's — everything a reviewer normally checks is present, which is what makes it
  convincing. It must read as a stop, and it carries no `creditable`.
- **`unavailable` is not a refusal.** It means our node did not answer; it says nothing about the
  deposit and must never be rendered as a finding against the player. `pending` and `suspect` also
  carry `creditable: null` — nothing to credit yet, and nothing that should be credited, in that
  order.
- `skipped` for a deposit with no chain behind it (bank, cash, mobile wallet). `404` for a deposit
  that does not exist.
- **Not polled.** Fetched on mount and on an explicit refresh, five-minute `staleTime` — see
  `useDepositChainCheck` in `src/lib/api/queries.ts`.

### Players — `/v1/admin/players` (offset paginated)

```
GET  /v1/admin/players?status=&telegramUserId=&linked=true|false&search=&limit=&offset=
GET  /v1/admin/players/:id
GET  /v1/admin/players/:id/balance
     -> { playerId, balanceMinor, currencyCode, readAt }
POST /v1/admin/players/:id/ichancy-account
     -> { playerId, ichancyPlayerId, ichancyLogin, created, agentId }
POST /v1/admin/players/:id/debit
     { amountMinor, reason }
     -> { debitId, playerId, amountMinor, status, playerBalanceBeforeMinor,
          playerBalanceAfterMinor, verifiedBy, reason, decidedBy, createdAt }
```

Roles, read out of `src/modules/player/player.constants.ts` on 2026-08-25 and matching
`permissions.ts` exactly:

| Route                   | Backend constant               | Roles                                                         |
| ----------------------- | ------------------------------ | ------------------------------------------------------------- |
| list, get, **balance**  | `PLAYER_READER_ROLES`          | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, PLATFORM_ADMIN |
| `POST /ichancy-account` | `PLAYER_ICHANCY_MANAGER_ROLES` | SUPER_ADMIN, FINANCE_ADMIN                                    |
| `POST /debit`           | `PLAYER_DEBIT_DECIDE_ROLES`    | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                          |

The table above is the backend's per-route constant, and `PLATFORM_ADMIN` appears in it only as a
reader. That is the constant, not the effective answer: the backend `RolesGuard` short-circuits
`PLATFORM_ADMIN` past every role list (see §3), so the owner account satisfies these routes too. The
constants are left narrow deliberately — they still describe who a TENANT's roles are — and the
superset is expressed in one place rather than smeared across every list.

`GET /:id/balance` is ONE upstream Ichancy call, through Cloudflare, per player. There is no bulk
form. The console gates these at four concurrently across the whole app (`src/lib/concurrency.ts`);
a page of them fired at once earns challenges instead of numbers.

> **A manual credit EXISTS, and it is not under `/players`.** This block used to say there was no
> manual credit at all; that was true when it was written and has not been since. Corrected here
> because the two halves of this document disagreed, and the wrong half is the one somebody reads
> before writing a screen.
>
> `POST /v1/admin/players/:id/credit` still does not exist and never will. Crediting a player is
> **`POST /v1/admin/deposits/manual`** (§ Deposits above): it records a MANUAL DEPOSIT on the
> internal `MANUAL_CREDIT` rail and hands it to the existing deposit → approve → credit spine. So
> there is no second money path — the same worker, the same Ichancy verify-by-delta, the same float
> guard, and the same four-eyes rule as any other deposit.
>
> That answers the question this block used to leave open. Crediting is the direction where a
> mistake spends the operator's float rather than the player's, and it needed `admin_approval_limits`
> to bound it — riding the deposit spine is what gives it that bound, rather than exempting it.
> A large manual credit lands in a second approver's queue exactly like a large real deposit.
>
> The console reaches it as `playersApi.credit(id, …)`, which puts `playerId` in the BODY because the
> route lives under `/deposits` — the module that owns the machinery — not under `/players`.

`AdminPlayerView`: `id, telegramUserId, telegramUsername, firstName, lastName, languageCode, status,
currencyCode, ichancyLinked, createdAt, lastSeenAt, ichancyPlayerId, ichancyLogin,
ichancyRegisteredAt, phone`.

`PlayerStatus`: `PENDING_ICHANCY ACTIVE SUSPENDED SELF_EXCLUDED CLOSED`.

`POST .../ichancy-account` is safe to repeat: `created:false` means the player was already linked.

`PlayerDebitStatus`: `DEBITED REJECTED NEEDS_RECONCILIATION`. `verifiedBy` is the `CreditVerifiedBy`
enum, and is null until something proves the debit.

`POST .../debit` is the opposite of the account call in every way that matters. It takes money OUT
of a player's Ichancy account and back into the agent float, it is admin-initiated (no player
request, no queue, no second approver), and it is **not idempotent and not safe to repeat** —
Ichancy has no idempotency key, so a second call is a second debit. The server verifies by reading
the balance before and after; when it still cannot tell, it answers `NEEDS_RECONCILIATION`, which
means a human checks Ichancy. The console must never turn that into a retry.

### Payment methods and destinations — `/v1/admin`

```
GET    /v1/admin/payment-methods?isActive=&rail=
GET    /v1/admin/payment-methods/:id
POST   /v1/admin/payment-methods
PATCH  /v1/admin/payment-methods/:id
DELETE /v1/admin/payment-methods/:id                    (deactivates — nothing is ever deleted)
GET    /v1/admin/payment-methods/:id/destinations?includeInactive=true
POST   /v1/admin/payment-methods/:id/destinations
PATCH  /v1/admin/payment-destinations/:id
PATCH  /v1/admin/payment-destinations/:id/declared-balance
DELETE /v1/admin/payment-destinations/:id
GET    /v1/admin/payment-destinations/:id/balance       (chain wallets only — see below)
```

`PATCH .../declared-balance` sets a hand-typed balance for an account no chain can be asked about
(a cash office, a bank): `{ balance, currency }` to set — a decimal string and a 2–8 letter code —
or `{ balance: null, currency: null }` to clear. Display-only bookkeeping; it never moves money.
Returns the destination view, whose `declaredBalance` / `declaredBalanceCurrency` /
`declaredBalanceUpdatedAt` carry it back. Manager roles only.

Create method: `{ code (SCREAMING_SNAKE), displayName, rail, currencyCode, verificationMode,
minAmount, maxAmount, feeFixed?, feeBps?, requiresReference?, referencePattern?, instructions?,
isActive?, sortOrder? }`. Update takes the same fields minus `code`, `rail`, `currencyCode`, which
are immutable.

Destination: `{ label, accountIdentifier, accountHolder?, isActive?, priority?, dailyCap?, notes? }`.
Update cannot change `accountIdentifier`.

`PaymentRail`: `BANK_TRANSFER MOBILE_WALLET CASH_OFFICE CRYPTO INTERNAL`.
`VerificationMode`: `MANUAL_PROOF REFERENCE_MATCH AUTO_STATEMENT NONE`.

#### What a payout wallet holds — `GET /v1/admin/payment-destinations/:id/balance`

The on-chain balance of one USDT destination, so an operator can see their own wallet without
leaving the console. Readable by anyone who can read the rails.

```
{ network: 'TRC20' | 'BEP20' | null, address, asset: 'USDT', scale: 6,
  balanceMinor: string | null, balance: string | null,
  checkedAt, problem: string | null, detail: string | null }
```

- **`network` is detected from the ADDRESS, never from the method code**, and is `null` when the
  identifier is not a chain address at all — which is what every freshly provisioned rail holds
  (`SEED-PLACEHOLDER-…`) until somebody pastes a wallet. That case is a **200 with a `problem`**, not
  a 4xx: an unconfigured rail is an expected state, not a fault. A consumer must not require a
  network to render the answer, and must not name one the server did not send.

- **`balanceMinor` and `balance` are NULLABLE, and that is the entire point of this shape.** Reading
  costs a call to a third-party chain explorer, which is rate-limited and occasionally down, so
  there are three answers and not two: a number, a refusal, and _the chain did not tell us_. The
  third comes back **200 with `balanceMinor: null`**, not a 5xx and never a `0` — the request was
  fine, it is the ANSWER that is missing. `problem` carries the machine code and `detail` one human
  sentence, both non-null exactly when the balance is.
- A console must render that as an explicit unknown. **Zero is a real answer** — an empty wallet —
  and an outage displayed as `0.00 USDT` tells somebody with money in that wallet that it is gone.
- `scale` is sent rather than assumed: USDT carries six decimals on both chains, and a balance
  rendered at the default two is wrong by a factor of ten thousand.
- `409 DESTINATION_NOT_ON_CHAIN` for a bank or mobile-wallet destination; `404` for a destination
  that does not exist.
- **Not polled by the console.** Fetched on mount and on an explicit refresh, with a two-minute
  `staleTime` — see `useWalletBalance` in `src/lib/api/queries.ts`.

### Admin directory — `/v1/admin/admins` (offset paginated)

```
GET    /v1/admin/admins?role=&isActive=&limit=&offset=
GET    /v1/admin/admins/:id
POST   /v1/admin/admins        { telegramUserId, displayName, role, username? }
PATCH  /v1/admin/admins/:id    { displayName?, role?, isActive?, username? }
DELETE /v1/admin/admins/:id    (deactivates)
```

`AdminUserView`: `id, telegramUserId, username, displayName, role, isActive, lastLoginAt, createdAt`.
Known errors: `ADMIN_SELF_MODIFICATION`, `ADMIN_LAST_SUPER_ADMIN`, `ADMIN_ALREADY_EXISTS`.

### Approval limits — `/v1/admin`

```
GET    /v1/admin/admins/:adminUserId/approval-limits    (full history, newest first)
POST   /v1/admin/admins/:adminUserId/approval-limits
       { currencyCode, maxSingleApproval, maxDailyApproval, secondApprovalAbove? }
DELETE /v1/admin/approval-limits/:id                    (ends the version — revokes authority)
```

Setting a limit **creates a new version and closes the previous one**; history is never rewritten.
An admin with no open version cannot approve anything. The UI shows this as a timeline, not as a
form with one editable row.

`ApprovalLimitView`: `id, adminUserId, currencyCode, maxSingleApproval, maxDailyApproval,
secondApprovalAbove, effectiveFrom, effectiveTo, createdAt`.

### The agent float — `/v1/admin/reconciliation/agent-float`

The read lives beside its sync sibling, on `ReconciliationController`. The console pill was originally
pointed at `/v1/admin/agent-float`, which 404s — so the top-bar pill rendered nothing in a real
deployment — and now calls the real path. See `src/components/layout/agent-float-pill.tsx`.

```
GET /v1/admin/reconciliation/agent-float  -> { currencyCode, balanceMinor, balance,
                                               lowWatermarkMinor, isLow, checkedAt }
```

Reads the tenant's `ICHANCY_AGENT_FLOAT` balance. Gated on `reconciliation.read`.

`isLow` is the server's own comparison against `AGENT_FLOAT_LOW_WATERMARK_MINOR` — the same constant
`DepositReviewService` refuses an approval under, and the same one the `/float` Telegram command
alarms on. The console never recomputes it: one rule, one place.

`balanceMinor` and `lowWatermarkMinor` are decimal strings of minor units; `balance` is the same
figure preformatted, e.g. `"1320000.00"`. `checkedAt` is ISO-8601.

### Reconciliation — `/v1/admin/reconciliation`

Paths are written in full here, not relative to the heading. `endpoints.contract.test.ts` reads
every path out of `src/lib/api/endpoints.ts` and looks for it in this file, and a document that
sometimes abbreviates is a document that check cannot read.

```
GET  /v1/admin/reconciliation/breaks?status=&category=&minSeverity=1..5&cursor=&limit=
     (cursor paginated; defaults to OPEN + INVESTIGATING)
GET  /v1/admin/reconciliation/breaks/:id
POST /v1/admin/reconciliation/breaks/:id/assign          -> BreakView
POST /v1/admin/reconciliation/breaks/:id/resolve  { status: RESOLVED|WRITTEN_OFF|FALSE_POSITIVE, note }
POST /v1/admin/reconciliation/breaks/:id/correct-float { note } -> { ledgerTransactionId, deltaMinor }
POST /v1/admin/reconciliation/agent-float/sync           -> { currencyCode, ledgerMinor, ichancyMinor,
                                                              deltaMinor, breakId, belowWatermark }
GET  /v1/admin/reconciliation/rail-ageing                -> { generatedAt, rows[], staleAccountCodes[] }
POST /v1/admin/reconciliation/invariants/run             -> { ok, checkedAt, violations[], truncated }
```

`BreakView`: `id, category, status, severity, currencyCode, expected|actual|delta: {minor, amount},
depositRequestId, playerId, ledgerAccountId, ichancyCallId, detail, dedupeKey, detectedAt,
assignedToAdminId, resolvedAt, resolvedByAdminId, resolutionNote, resolutionTxId`.

`BreakCategory`: `AGENT_FLOAT_MISMATCH PLAYER_BALANCE_MISMATCH MISSING_CREDIT DUPLICATE_CREDIT
UNIDENTIFIED_RECEIPT LEDGER_IMBALANCE ORPHAN_ICHANCY_CALL STUCK_DEPOSIT`.
`BreakStatus`: `OPEN INVESTIGATING RESOLVED WRITTEN_OFF FALSE_POSITIVE`. `severity` is 1..5.

Rail ageing row: `{ accountId, accountCode, currencyCode, paymentMethodId, balanceMinor,
oldestUnsettledAt, buckets: [{ label, fromDays, toDays, debitMinor, creditMinor, netMinor,
entryCount }] }`.

Invariant violation: `{ invariant, subject, currencyCode, expectedMinor, actualMinor, deltaMinor,
detail }`.

### Tenants — `/v1/admin/tenants` (PLATFORM_ADMIN only)

```
GET   /v1/admin/tenants          -> { tenants: TenantView[] }   <- note the wrapper object
GET   /v1/admin/tenants/:id
POST  /v1/admin/tenants          -> 201, always lands SUSPENDED
PATCH /v1/admin/tenants/:id      { displayName?, adminChatId?, feedChatId?,
                                   dualApprovalThresholdMinor?, agentFloatLowWatermarkMinor?,
                                   depositExpiryMinutes? }
POST  /v1/admin/tenants/:id/activate     (verifies the Ichancy agent with a real signin)
POST  /v1/admin/tenants/:id/suspend

POST   /v1/admin/tenants/:id/webhook     -> TenantWebhookView   (tells Telegram where to deliver)
DELETE /v1/admin/tenants/:id/webhook     -> TenantWebhookView   (stops delivery; keeps serving)
POST   /v1/admin/tenants/:id/bot-setup   -> { commandsSet, scopes[] }
GET    /v1/admin/tenants/:id/health      -> { bot, ichancy, counts }
PATCH  /v1/admin/tenants/:id/ichancy     { ichancyBaseUrl?, ichancyUsername?, ichancyPassword?,
                                           ichancyAgentId? }  -> TenantView
PATCH  /v1/admin/tenants/:id/bot         { botToken }          -> TenantView
```

The six operational routes above were documented only in `docs/TENANT-OPERATIONS.md` §6 until
2026-08-25, while the console had been calling them for some time. Their behaviour is argued there
in detail; what matters here is the shape and these three traps:

- `TenantWebhookView.url` is **nullable**. After a DELETE there is no URL to report, and a screen
  rendering `""` would be claiming a registration that is gone.
- `health.bot.webhookMatches` is the delivery question, not `hasWebhookPath`. A bot can hold a
  webhook that points at some other host and be dead to this deployment.
- `PATCH /ichancy` refuses a new `ichancyAgentId` once the operator has players
  (`TENANT_AGENT_HAS_PLAYERS`): repointing an agent under existing players orphans them from the
  tree their balances live in. The password is write-only in both directions — sealed on arrival,
  never returned, so omitting it means "leave the sealed one alone".

Create, required: `{ displayName (1..120), botToken, ichancyUsername, ichancyPassword }`.

Create, optional — each has a server-side default, and an omitted one must be **absent** from the
JSON rather than `""` or `null`, or the backend stores the empty value instead of resolving the
default: `{ slug?, adminChatId?, feedChatId?, ichancyBaseUrl?, ichancyAgentId?, currencyCode?,
dualApprovalThresholdMinor?, agentFloatLowWatermarkMinor?, depositExpiryMinutes? }`.

What fills them in: `slug` ← `slugify(displayName)`, de-duplicated with `-2`, `-3`, … on collision;
`adminChatId` ← the Telegram id of the PLATFORM_ADMIN making the request; `feedChatId` ← nothing, it
stays optional with no default; everything else ← the single **PlatformDefaults** settings row
(DB-backed, seeded from the deployment's env values on first run, read through one service).

`ichancyAgentId` is the exception: supplied → PlatformDefaults → tenant zero's `ichancyAgentId` →
**400 naming the field**. Ichancy `signin()` returns only a token pair, so an agent id can never be
derived from the credentials — there is no lookup. Two tenants sharing an agent id is allowed and is
how a second operator gets tested.

The response is the same `TenantView` as before, with **every field populated**: the defaults are
resolved server-side and visible in it, which is what the console's detail panel reads after create.

`TenantView`: `id, slug, displayName, status, hasWebhookPath, adminChatId, feedChatId, botUsername,
ichancyBaseUrl, ichancyUsername, ichancyAgentId, currencyCode, dualApprovalThresholdMinor,
agentFloatLowWatermarkMinor, depositExpiryMinutes, createdAt, updatedAt, counts?: {players,
deposits}`.

`slug` and `currencyCode` are immutable after creation. Secrets are never returned; the webhook path
is reported only as `hasWebhookPath`. A new tenant lands SUSPENDED on purpose — nothing can verify
from a form that the agent id is the right one, so activating is a second, deliberate act.

`TenantStatus`: `ACTIVE SUSPENDED CLOSED`.

### The crypto rate — `/v1/admin/exchange-rates`

What one USDT is worth in the operator's own currency. A player deposits on a USDT rail and is
credited in that currency, so something has to say how much.

```
GET /v1/admin/exchange-rates/usdt   -> ExchangeRateView | null
POST /v1/admin/exchange-rates/usdt   { rate, sourceNote?, confirmLargeChange? }  -> ExchangeRateView
```

`ExchangeRateView`: `{ quoteAsset, currencyCode, rate, rateMinor, source, sourceNote, setByAdminId,
effectiveFrom, isStale, maxAgeHours }`.

**Roles: `SUPER_ADMIN` and `FINANCE_ADMIN` write; everyone who can read the rails can read it.**
Exactly the boundary a payout account already follows, and for the same reason: this number decides
how much of the OPERATOR's money a deposit is worth, so it belongs to the operator. `PLATFORM_ADMIN`
reads and does not write.

- **Versioned, never mutated.** Setting a rate closes the previous one and records a new row. A
  deposit records which version priced it, so editing the rate cannot retroactively change what
  somebody was already paid. Same shape as `admin_approval_limits`, for the same reason.
- `rate` is a **decimal string** (`"13200.00"`), never a JSON number. It multiplies every deposit on
  the rail, so a value that lost precision in transit loses it on all of them at once. `rateMinor`
  is sent alongside because a screen re-deriving one from the other would be a second place for the
  scale to be wrong.
- **Four guards**, each for a specific failure: the rate must be positive (service _and_ a `CHECK`
  constraint); it may not move more than **20%** from the one it replaces without
  `confirmLargeChange: true`; it may not be older than **24 hours** when a deposit is priced; and
  pricing **floors**, so a remainder can only ever under-credit.
- The jump guard is what catches a misplaced decimal (900%) and the Syrian **redenomination
  confusion — a factor of 100**. It refuses with `422 RATE_IMPLAUSIBLE_JUMP` naming both numbers.
  It cannot protect the FIRST rate, which has nothing to compare against; the console's
  worked-example confirmation is what guards that one.
- `GET` answers `null` when nobody has set a rate, and reports a stale one with `isStale: true`
  rather than as an error — a screen has to be able to say _why_ the rail is refusing deposits, and
  it cannot say that from a 4xx. Only the deposit path treats staleness as a refusal.

### Sham Cash session — `/v1/admin/shamcash`

The operator's external Sham Cash cashier account, linked by pasting its **browser-session cookies**.
Sham Cash encrypts every API call with a key its own front-end mints per request, which we cannot
reproduce — so the balance is read by replaying the operator's session in a headless browser and
parsing the rendered page, not through their API. This resource stores that session.

```
GET    /v1/admin/shamcash/session   -> { linked, updatedAt }
POST   /v1/admin/shamcash/session   { accessToken, authToken, forge? }  -> { linked, updatedAt }
DELETE /v1/admin/shamcash/session   -> { linked, updatedAt }
POST   /v1/admin/shamcash/balance   -> ShamCashReadResult
```

`POST .../balance` replays the session in a headless browser and reads the rendered home page.
`ShamCashReadResult` is a discriminated union on `status`: `ok` carries `balances[]` (currency,
available, locked) and `transactions[]`; `not_linked`, `expired` and `unavailable` (with a `detail`)
carry no balance — an expired session or an outage is **never** returned as a wallet of zeros. POST,
not GET: it launches a browser and hits a third party, so it is an action with a cost.

**Roles: `SUPER_ADMIN` and `FINANCE_ADMIN`** — managing an external cashier account is a money
action.

- The cookies are **sealed** (AES-256-GCM, its own key) the instant they arrive and are **never
  returned** by any endpoint. `GET` answers only whether a session is linked and when — a leak of the
  console exposes the status, not the session.
- `accessToken` and `authToken` are required (they are what say "signed in"); `forge` is the optional
  anti-forgery cookie. Nothing else is collected — the reader forces the locale itself.
- A lapsed session reads as "expired, re-link", never as a zero balance. The reader (headless browser
  + `@core/shamcash` parser) is validated on first run in the deployment, against the live account.
- **`expired` is decided by Sham Cash, not by us reading the page.** The reader records what the
  site's own API answered while the page booted; a 401/403 on an `Account/…` call is a lapsed
  session, stated by them. Rendered text is only the fallback, because the page can sit at the home
  URL showing an Arabic "unauthorized" toast, or bounce to the marketing landing page, without ever
  saying "sign in".
- **A slow page is reported as slow, not as a changed site.** shamcash.sy has been measured taking
  ~55s to render anything, so the read waits up to `SHAM_CASH_SETTLE_MS` (90s by default) and ends
  as soon as the balance call answers. A page still blank at the end returns `unavailable` naming
  the wait — never `expired`, which would send an operator to re-link a session that is fine.
  Budget accordingly: this call can legitimately take a minute or more.

### Platform defaults — `/v1/admin/platform-defaults` (PLATFORM_ADMIN only)

What every **new** operator inherits. One row; there is no collection and no id.

```
GET   /v1/admin/platform-defaults   -> PlatformDefaultsView
PATCH /v1/admin/platform-defaults   { ichancyBaseUrl?, ichancyAgentId?, currencyCode?,
                                      dualApprovalThresholdMinor?, agentFloatLowWatermarkMinor?,
                                      depositExpiryMinutes? }  -> PlatformDefaultsView
```

`PlatformDefaultsView`: `{ ichancyBaseUrl, ichancyAgentId, currencyCode,
dualApprovalThresholdMinor, agentFloatLowWatermarkMinor, depositExpiryMinutes, updatedAt,
appliesToNewOperatorsOnly }`. Minor units are strings; `ichancyAgentId` is the only nullable field.

- **Editing a default is not retroactive**, and the response says so in
  `appliesToNewOperatorsOnly: true` rather than leaving it to this paragraph. A value is copied onto
  an operator's own row when that operator is created and belongs to it from then on — raising a
  dual-approval threshold here does not raise it for a tenant taking deposits this minute. That is
  correct (a platform must not silently re-tune a live operator's money rules) and it is also the
  most likely wrong assumption about the endpoint.
- **An absent key leaves the stored value alone.** It is a PATCH. This matters most for
  `ichancyAgentId`: it is nullable, and it is the one value tenant creation cannot derive from
  anything else, so clearing it by omission would break the next creation with a 400 naming a field
  nobody touched.
- `currencyCode` is validated against the `Currency` table on write, and an inactive currency is
  refused distinctly from an unknown one. It is a foreign key on `tenants`, so an unchecked value
  would not fail here — it would fail later, on somebody else's tenant creation.
- Seeded from this deployment's `.env` the first time anything reads it, so an existing deployment
  keeps exactly the values it already had without anybody running a script.

### Operator finances — `/v1/admin/finance` (PLATFORM_ADMIN only)

Every operator's finance balances, on one platform screen: its Ichancy agent float, its USDT payout
wallets, and its external Sham Cash account. `platformFinance.read` — PLATFORM_ADMIN only, like every
route on the tenants surface.

```
GET  /v1/admin/finance/balances                        -> { tenants: TenantFinanceRow[] }
POST /v1/admin/finance/tenants/:tenantId/refresh       -> TenantFinanceRow   (404 for an unknown id)
```

```ts
TenantFinanceRow = { tenantId, slug, agentFloat: AgentFloatCell, usdt: UsdtCell, shamCash: ShamCashCell }

// discriminated on `status`
AgentFloatCell  = { status: 'ok', currencyCode, balanceMinor, balance, lowWatermarkMinor, isLow, checkedAt }
                | { status: 'unavailable', detail }
UsdtCell        = { status: 'not_loaded' }
                | { status: 'loaded', checkedAt, wallets: UsdtWalletCell[] }
UsdtWalletCell  = { status: 'ok', label, network: string|null, balanceMinor, balance, checkedAt }
                | { status: 'unavailable', label, network: string|null, problem: string|null, detail: string|null, checkedAt }
ShamCashCell    = { status: 'not_loaded' } | ShamCashReadResult   // ok | not_linked | expired | unavailable
```

- **`GET /balances` is the CHEAP overview.** The agent float is a ledger read and is always present;
  the USDT wallets and Sham Cash cost a chain call and a headless-browser session replay, so they are
  NOT fetched up front — they arrive `not_loaded` and are filled in per operator by the refresh.
- **`POST /tenants/:tenantId/refresh` is the EXPENSIVE read for ONE operator.** It loads that
  operator's USDT wallets and Sham Cash and answers the freshened row. It is per operator on purpose:
  a "refresh all" is a CLIENT fan-out through the console's limiter, never one call that asks the
  server to read every chain and every session at once.
- **Every cell carries a status because a failed read must never render as `0`.** The `ok`/`loaded`
  arm carries a figure; every other arm — `unavailable`, `not_loaded`, and Sham Cash's `not_linked` /
  `expired` — carries no figure at all. Zero is a real answer (an empty wallet); an outage shown as
  zero says an operator's money is gone. The same rule the wallet-balance and Sham Cash reads follow.
- `AgentFloatCell.ok` IS the `agent-float` shape with a `status` added, so its `isLow` is the server's
  own verdict; USDT figures are USDT (six decimals), and Sham Cash's loaded arm is the existing
  `ShamCashReadResult` union verbatim.

### What creation actually does — the `provisioning` block

`POST /v1/admin/tenants` answers `{ ...TenantView, provisioning }`. Creating an operator is no
longer one write: `TenantService.create` calls `provision()`, which registers the Telegram webhook,
pushes the command menus, provisions the default payment rails and attempts activation.

```
provisioning = { webhookRegistered, webhookUrl, webhookError,
                 menusPushed, menuScopes[], menuError,
                 activated, activationError,
                 paymentMethodsCreated, paymentMethodsError, paymentMethodsNeedAccounts }
```

Each step reports a boolean **and** a nullable error, never one tri-state: "did not run" and "ran
and failed" send an operator to two different places.

> **`paymentMethodsNeedAccounts` is the field to act on.** A freshly provisioned operator's rails
> point at placeholder destinations (`SEED-PLACEHOLDER-…`, account holder `REPLACE ME`). That
> operator can be activated, shown to a player, and take a deposit — and the player will have sent
> their money to a string that is not an account. Nothing is recoverable from there. The console
> must say so, and keep saying so until real accounts replace them.

Note what this makes stale elsewhere: `docs/TENANT-OPERATIONS.md` §5 and §7 still describe
register-webhook, push-menus and activate as manual steps a human performs after creation. They are
not, and rewriting those two sections is tracked as CC-017.

### Telegram destinations — `/v1/admin/telegram/destinations`

Where an operator's bot publishes. **No tenant is ever named** — not in a path, not in a body: the
operator comes from the session (and, for a platform admin, the `X-Tenant-Id` override), and the
Prisma tenant-scope extension turns another operator's id into a 404 rather than a leak.

**No bot token, in either direction.** The operator's bot is already registered against their tenant
(`tenants.bot_token_enc`); the server loads it. Nothing here accepts a token, so a caller cannot
publish through somebody else's bot, and nothing here returns one.

```
GET    /v1/admin/telegram/destinations            -> TelegramDestinationView[]
POST   /v1/admin/telegram/destinations            { url, displayName?, categories[], isActive? }
PATCH  /v1/admin/telegram/destinations/:id        { displayName?, categories?, isActive? }
DELETE /v1/admin/telegram/destinations/:id        -> deactivates; never deletes
POST   /v1/admin/telegram/destinations/:id/check  -> TelegramDestinationCheckView (sends nothing)
POST   /v1/admin/telegram/destinations/:id/test   -> TelegramDestinationCheckView (posts a message)
```

`TelegramDestinationView`: `id, chatId, chatType, telegramUrl, title, username, displayName,
categories, isActive, lastVerifiedAt, lastError, lastPublishedAt, createdAt, updatedAt`.

`chatId` is a **string**: a Telegram chat id is signed 64-bit and a channel id such as
`-1001234567890` is past what a JS number holds exactly. Same rule as money, same reason.

`chatType`: `GROUP | SUPERGROUP | CHANNEL`. There is no `PRIVATE` — a DM is not somewhere an
operator publishes reports, and allowing one would let somebody redirect a deposit feed into their
own inbox. The database refuses it too (no enum member, plus a `chat_id < 0` CHECK).

`categories` is the `NotificationCategory` enum: `NEW_PLAYER, DEPOSIT, WITHDRAWAL, PROFIT,
SHAM_CASH_DEPOSIT, SHAM_CASH_WITHDRAWAL, USDT_DEPOSIT, USDT_WITHDRAWAL, PLAYER_STATUS_CHANGE,
REPORT, SYSTEM_ALERT`. It may never be empty — enforced in the DTO, in the service, and by a CHECK
constraint, because a destination subscribed to nothing is a row that silently does nothing.

> **Only five categories have a producer today**: `DEPOSIT`, `WITHDRAWAL`, `NEW_PLAYER`, `REPORT`
> and `SYSTEM_ALERT`. `PROFIT` has no source of truth (nothing computes GGR or revenue),
> `SHAM_CASH_*` has none (Sham Cash is a read-only balance scraper with no transaction feed),
> `USDT_*` has none (the chain layer verifies one deposit at a time, it does not tail transfers),
> and `PLAYER_STATUS_CHANGE` writes transitions but emits no event. Subscribing to one of these is
> allowed and receives nothing — the console says so beside the checkbox rather than hiding it.

**`POST` never saves a claim.** The server resolves the pasted `url` through the operator's own bot
(`getChat`), then checks membership, administrator status and the post right (`getChatMember`) as
three separate facts, and writes the row only if all three pass. A row existing therefore means the
bot has proved it can post there. A refusal is a 400 whose `details.reason` is one of:

| `reason`         | What it means, and who fixes it                                        |
| ---------------- | ---------------------------------------------------------------------- |
| `INVALID_URL`    | Not a Telegram group/channel reference. A `t.me/+…` invite link cannot be resolved by a bot at all — pick the group from `GET /v1/admin/telegram/chats` instead. |
| `NOT_FOUND`      | Telegram does not know the chat, or the bot cannot see it              |
| `PRIVATE_CHAT`   | It resolved, but it is a one-to-one chat                               |
| `BOT_NOT_MEMBER` | Someone must add the bot to the group                                  |
| `BOT_NOT_ADMIN`  | A group administrator must promote it                                  |
| `BOT_CANNOT_POST`| Channel admin with "Post messages" off — turn the permission on        |
| `DUPLICATE`      | That chat is already an active destination for this operator           |

They are separate values because they fail separately and are fixed by different people. Collapsing
them into one error is the failure this endpoint exists to remove.

`PATCH` deliberately **cannot change the chat**. The row's meaning is "the bot proved it can post
_here_", and repointing would either carry that proof to a chat it was never made about or re-verify
silently behind an update. Remove and add instead — and because `DELETE` only deactivates, re-adding
the same chat **revives the existing row** rather than colliding with the `(tenant_id, chat_id)`
unique index.

`TelegramDestinationCheckView`: `ok, isMember, isAdministrator, canPost, reason, detail, title,
messageSent`. Three separate booleans, not one — see above. `detail` is Telegram's own words when it
gave any, never a paraphrase. `check` writes freshness to the row and sends nothing; `test` posts a
real message, which is the only thing that actually proves delivery (a permission can change between
the two calls).

### Chats the bot is in — `/v1/admin/telegram/chats`

```
GET /v1/admin/telegram/chats -> DiscoveredChatView[]
```

**Why this exists: without it a private group cannot be bound at all.** `POST
/v1/admin/telegram/destinations` resolves what the operator sends through `getChat`, which needs an
`@username` or a chat id. A public group has a username. A private group has neither — its only
shareable handle is an invite link, and the Bot API has no method that resolves one (a bot can
neither follow nor look up a `t.me/+…`). There is also no "list my chats" call. So the operator was
in a loop with no exit: add the bot, paste the only link the group has, get `INVALID_URL`.

Telegram does volunteer the chat id **once**, by pushing a `my_chat_member` update the moment the
bot is added, promoted, demoted or removed. That update type was already subscribed
(`TELEGRAM_ALLOWED_UPDATES`), already persisted and already deduped — and nothing consumed it, so
the one obtainable copy of that fact was discarded. It is now recorded in `telegram_discovered_chats`
and read back here.

`DiscoveredChatView`: `chatId, chatType, title, username, status, isAdministrator, isPresent,
canPost, alreadyBound, firstSeenAt, lastSeenAt`.

`status` is the bot's own membership in Telegram's vocabulary: `CREATOR | ADMINISTRATOR | MEMBER |
RESTRICTED | LEFT | KICKED`. Kept whole rather than collapsed into a boolean because each is fixed
by a different action, and the console prints a different sentence for each.

**A row here is an observation, never a permission.** Nothing is ever published to a chat because it
appears in this list. Binding still goes through the resolver and still re-asks Telegram at that
moment, so "a destination row means the bot PROVED it can post there" is unchanged. The `chatId`
from a row here is simply a valid value for `POST /v1/admin/telegram/destinations`'s `url` field —
which has always accepted a numeric chat id, and which verifies it like any other reference.

`isAdministrator`, `isPresent` and `canPost` are a **snapshot** of the last sighting and may be
stale; the console annotates rows with them and never disables a row because of them, since an
operator who promoted the bot a minute ago would otherwise be locked out of a group that now works.
`alreadyBound` is the exception: it is computed from the operator's own active destinations, so it
is current, and the console marks those rows instead of offering them.

Rows for chats the bot has **left or been removed from are kept and returned**, flagged by `status`
and `isPresent`. "The bot was kicked from this group" is the answer to the question the operator is
about to ask, and a row that quietly disappears says nothing.

`GET` is readable by the same roles as the destination list (`SUPER_ADMIN`, `FINANCE_ADMIN`,
`REVIEWER`, `PLATFORM_ADMIN`). There is no write route: rows are created by the worker while
handling a Telegram update, never by a client.

### Reports to Telegram — `/v1/admin/reports`

```
POST /v1/admin/reports/activity/publish   { period?: 'day' | 'week' | 'month' }  (default 'month')
     -> { title, considered, delivered, failed }
```

Builds the activity report with the **existing** `ActivityReportService` — the same code the
`/report` bot command and the scheduled cron use — and publishes it to every active destination
subscribed to `REPORT`. Nothing is recomputed here; the body travels as the rendered Telegram HTML
that service already produces.

`considered: 0` is a legitimate answer, not a failure: no destination subscribes to `REPORT` yet.
The console says exactly that rather than reporting a successful send of nothing.

There is deliberately **no GET** for the report: it is rendered Telegram HTML on the server, so a GET
would hand the console markup it cannot lay out. Splitting the service into data and rendering is
the prerequisite for that, and it is not part of this change.

### Health (public)
### Health (public)

```
GET /health/live   -> { status, role, uptimeSeconds, timestamp }
GET /health/ready  -> terminus { status: 'ok'|'error', info, error, details }
```

---

## 5. The tenant claim — closed 2026-08-25

This section used to be called "the tenant gap" and used to list what the backend still needed. It
needs none of it: the claim is carried end to end, and what follows is the verification.

### How a request finds its operator

| Stage         | What carries the operator                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in       | Both login routes sign `tid` -- the caller HOME operator, the one their `admin_users` row lives in -- into the access token. It is authority, so it is signed rather than sent by the client. |
| Every request | `tenant-context.middleware.ts` reads `tid` off the verified token and runs the whole request inside `runWithTenant(tid)`, before any guard.                                                   |
| Identity      | `AdminIdentityService` resolves `(tenantId, telegramUserId)` in that tenant, so authority is measured where the row actually is.                                                              |
| Data          | `TenantOverrideInterceptor` runs after the guard and lets a `PLATFORM_ADMIN` whose row is in tenant zero point THIS request at another operator with `X-Tenant-Id`.                           |

HOME and EFFECTIVE are deliberately two different things. Home is who you are and no header can
move it; effective is whose data you are reading. Collapsing them would either blind a platform
admin (their own operator holds no players) or resolve identity in a tenant the client picked,
which is an authentication bypass wearing a header.

### The rules the header follows

- **Honoured only for a `PLATFORM_ADMIN` whose row is in tenant zero.** The role alone is not
  enough: a platform row inside an operator is a tenant login holding platform authority, and it
  has existed before. A CHECK constraint stops it being written; this stops it being worth
  anything if it is.
- **Ignored, never refused, from everybody else.** A `SUPER_ADMIN` sending it gets exactly what
  they would have got without it. A 403 would turn the header into an oracle -- send one, read the
  error, learn which operator ids are real.
- **An unknown id is a 400, not a fallback.** Swallowing it would show a platform admin the wrong
  operator deposits with no way to tell.

### Measured, 2026-08-25

One `PLATFORM_ADMIN` token, `GET /v1/admin/players`, header varied:

| `X-Tenant-Id`                   | Answer                                             |
| ------------------------------- | -------------------------------------------------- |
| absent                          | 3 rows (home operator)                             |
| tenant zero                     | 3 rows                                             |
| another operator                | 1 row                                              |
| `11111111-...` (no such tenant) | `400 VALIDATION_FAILED` -- "No tenant with id ..." |

So `VITE_TENANT_HEADER_ENABLED=true` is the correct setting and the console `TenantNotice` is
silent. The compiled fallback in `src/config.ts` stays `false`: an absent variable must fail safe,
and pointing this console at a backend older than the claim is still a thing somebody can do.
