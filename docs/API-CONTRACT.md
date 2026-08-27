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

`PLATFORM_ADMIN` runs the _platform_ (tenants). It is deliberately **not** a superset of
`SUPER_ADMIN`, which runs _one tenant_. The console must not treat either as implying the other.

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

**`PLATFORM_ADMIN` reads across the platform and writes almost nothing**, and that shape is the
point rather than an accident. It has to be able to answer "is this operator working?", which is
reading; it must not decide money, because approving is bounded by an `admin_approval_limits` row
that a platform admin has none of, and a role that could approve without a limit is the hole those
limits exist to close. It is a reader on players, deposits, rails and reconciliation, and a writer
only on tenants and on staff.

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
```

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

`PLATFORM_ADMIN` is a **reader here and nothing more**, and the backend argues why: the platform
console has to be able to show a tenant's state to answer "is this operator working?", and reading
is the whole of that. It is absent from the Ichancy-account list on purpose — that call writes to a
third party under the tenant's own agent and cannot be undone from here.

`GET /:id/balance` is ONE upstream Ichancy call, through Cloudflare, per player. There is no bulk
form. The console gates these at four concurrently across the whole app (`src/lib/concurrency.ts`);
a page of them fired at once earns challenges instead of numbers.

> **There is no manual credit, on either side, and that is deliberate.**
>
> `POST /v1/admin/players/:id/credit` does not exist. Checked against the backend on 2026-08-25:
> `player-admin.controller.ts` serves list, get, balance, ichancy-account and debit, and nothing
> else. `IchancyPort.creditPlayer` exists but is reached only by the deposit crediting path
> (`deposit-credit.service.ts`), never by an admin route.
>
> The console used to ship a client for it anyway — `playersApi.credit`, `useCreditPlayer`,
> `playerCreditSchema`, `CreditPlayerBody` and a `PlayerCreditStatus` enum — complete, carefully
> commented, called by nothing and mocked by nothing. It was removed on 2026-08-25 rather than
> completed (CC-002). Money moves INTO a player's account by one route only: a deposit somebody
> reviewed and approved.
>
> Note which direction survived. `POST /:id/debit` takes money back OUT and is built; crediting is
> the direction where a mistake spends the operator's float rather than the player's, and it is the
> direction with no reviewer, no queue and no second approver in front of it. If it is ever built,
> it needs an answer to whether `admin_approval_limits` bounds it — the deposit path is bounded, and
> a manual credit that is not would be a way around that bound.

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
DELETE /v1/admin/payment-destinations/:id
GET    /v1/admin/payment-destinations/:id/balance       (chain wallets only — see below)
```

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

### The agent float — `/v1/admin/agent-float` (NOT BUILT YET)

**This one endpoint does not exist on the backend.** Everything else in this document was read out
of the controllers; this is a shape the console was written against ahead of the server, and it is
recorded here because `endpoints.contract.test.ts` requires every path the client calls to be
written down. The top-bar pill degrades to nothing until it ships, so the console is correct either
way — see `src/components/layout/agent-float-pill.tsx`.

```
GET /v1/admin/agent-float  -> { currencyCode, balanceMinor, balance,
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
