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

Admins do **not** log in with a password. They send `/console` to the tenant's Telegram bot, get a
one-time code, and exchange it:

```
POST /v1/admin/auth/bot-code        { code }  ->  { accessToken, expiresAt, admin }
     admin = { id, telegramUserId, role, displayName }
```

- Public route, rate limited to 10 attempts per window.
- The response is an **access token only — there is no admin refresh token**. When it expires the
  admin fetches a new code. The console therefore watches `expiresAt`, warns before expiry, and
  signs out cleanly on any 401.
- Every other call sends `Authorization: Bearer <accessToken>`.
- An invalid _and_ an expired code both answer `BOT_CODE_INVALID` on purpose. Do not tell them apart
  in the UI either.

---

## 3. Roles

`AdminRole`: `PLATFORM_ADMIN | SUPER_ADMIN | FINANCE_ADMIN | REVIEWER | SUPPORT | VIEWER`.

`PLATFORM_ADMIN` runs the _platform_ (tenants). It is deliberately **not** a superset of
`SUPER_ADMIN`, which runs _one tenant_. The console must not treat either as implying the other.

| Capability                                                          | Roles                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| Deposit queue: read                                                  | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, VIEWER |
| Deposit: claim / release / approve / reject                          | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                  |
| Deposit: retry credit, maintenance sweep                             | SUPER_ADMIN, FINANCE_ADMIN                            |
| Players: read                                                        | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT         |
| Players: create Ichancy account                                      | SUPER_ADMIN, FINANCE_ADMIN                            |
| Players: debit (take funds back out)                                 | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                  |
| Payment methods/destinations: read                                   | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT         |
| Payment methods/destinations: write                                  | SUPER_ADMIN, FINANCE_ADMIN                            |
| Admin directory + approval limits: read                              | SUPER_ADMIN, FINANCE_ADMIN                            |
| Admin directory + approval limits: write                             | SUPER_ADMIN                                           |
| Reconciliation: read                                                 | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, VIEWER          |
| Reconciliation: act (resolve, assign, float sync, correct, invariants) | SUPER_ADMIN, FINANCE_ADMIN                            |
| Tenants: everything                                                  | PLATFORM_ADMIN                                        |

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

### Players — `/v1/admin/players` (offset paginated)

```
GET  /v1/admin/players?status=&telegramUserId=&linked=true|false&search=&limit=&offset=
GET  /v1/admin/players/:id
POST /v1/admin/players/:id/ichancy-account
     -> { playerId, ichancyPlayerId, ichancyLogin, created, agentId }
POST /v1/admin/players/:id/debit
     { amountMinor, reason }
     -> { debitId, playerId, amountMinor, status, playerBalanceBeforeMinor,
          playerBalanceAfterMinor, verifiedBy, reason, decidedBy, createdAt }
```

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
```

Create method: `{ code (SCREAMING_SNAKE), displayName, rail, currencyCode, verificationMode,
minAmount, maxAmount, feeFixed?, feeBps?, requiresReference?, referencePattern?, instructions?,
isActive?, sortOrder? }`. Update takes the same fields minus `code`, `rail`, `currencyCode`, which
are immutable.

Destination: `{ label, accountIdentifier, accountHolder?, isActive?, priority?, dailyCap?, notes? }`.
Update cannot change `accountIdentifier`.

`PaymentRail`: `BANK_TRANSFER MOBILE_WALLET CASH_OFFICE CRYPTO INTERNAL`.
`VerificationMode`: `MANUAL_PROOF REFERENCE_MATCH AUTO_STATEMENT NONE`.

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

### Reconciliation — `/v1/admin/reconciliation`

```
GET  /breaks?status=&category=&minSeverity=1..5&cursor=&limit=
     (cursor paginated; defaults to OPEN + INVESTIGATING)
GET  /breaks/:id
POST /breaks/:id/assign                     -> BreakView
POST /breaks/:id/resolve  { status: RESOLVED|WRITTEN_OFF|FALSE_POSITIVE, note }
POST /breaks/:id/correct-float { note }     -> { ledgerTransactionId, deltaMinor }
POST /agent-float/sync                      -> { currencyCode, ledgerMinor, ichancyMinor,
                                                 deltaMinor, breakId, belowWatermark }
GET  /rail-ageing                           -> { generatedAt, rows[], staleAccountCodes[] }
POST /invariants/run                        -> { ok, checkedAt, violations[], truncated }
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
```

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

### Health (public)

```
GET /health/live   -> { status, role, uptimeSeconds, timestamp }
GET /health/ready  -> terminus { status: 'ok'|'error', info, error, details }
```

---

## 5. The tenant gap — read this before wiring a tenant switcher

The backend's multi-tenancy is real for **bot traffic, queues and crons**: the Telegram webhook path
token selects the tenant, and a Prisma extension scopes every query to it.

**HTTP admin requests carry no tenant claim.** The access token holds `sub, tgid, role, sid` and
nothing else, and no middleware enters a tenant context for API routes, so every `/v1/admin/*` call
outside `/tenants` resolves to _tenant zero_. The backend's own `plan-multitenant.md` lists "HTTP
tenant claim" as still open.

Concretely:

- `/v1/admin/tenants` is genuinely cross-tenant and is safe to build against today.
- Deposits, players, payment methods, admins and reconciliation always answer for tenant zero,
  whatever a switcher says.

So the console ships the switcher **behind `VITE_TENANT_HEADER_ENABLED` (default off)**. With the
flag on, `X-Tenant-Id` rides on every admin request and the UI shows which tenant is selected. Until
the backend reads that header, off is the only honest setting: a switcher that looks like it works
but silently shows tenant zero's money is worse than no switcher at all.

### What the backend needs for the switcher to become real

1. Put the tenant on the admin access token (or accept `X-Tenant-Id` and validate it against the
   admin's own tenant).
2. Enter `runWithTenant(...)` in a middleware/guard for `/v1/admin/*`, as the webhook controller
   already does for bot traffic.
3. Let `PLATFORM_ADMIN` name a tenant explicitly, since that role has no tenant of its own.

Once that lands, flipping `VITE_TENANT_HEADER_ENABLED=true` is the only change needed here.
