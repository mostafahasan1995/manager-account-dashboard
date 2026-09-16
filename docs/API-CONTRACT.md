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

### 2a. Username and password — the console's only sign-in

```
POST /v1/admin/auth/credentials   { username, password, operatorSlug? }  ->  AdminSessionView
```

- `username` is the console login on the caller's own `admin_users` row. It may be a plain name or
  an **email** — both are ordinary values of one column, so there is no separate `email` field.
  Lower-cased on write, matched case-insensitively.
- Rate limited to 10 attempts per minute, blocked for **15** after that: this credential does not
  expire on its own, so a patient guessing loop has to be made hopeless rather than slow.
- **Two credentials live behind these two fields.** The server tries the caller's own console
  password first, and the operator's Ichancy agent account (2b) second. Which one answered is not
  reported and must not be inferred — the response is the same `AdminSessionView` either way.
- A miss on both is `ADMIN_CREDENTIALS_INVALID` (401), one sentence for every cause. Everything
  said _after_ a credential is proved keeps its own code, because only those are actionable:
  `ADMIN_OPERATOR_AMBIGUOUS` / `AGENT_OPERATOR_AMBIGUOUS` (409, `details.operators`, retry with
  `operatorSlug`), `AGENT_OPERATOR_NOT_ACTIVE` (403), `AGENT_OPERATOR_HAS_NO_OWNER` (403).

> **`POST /v1/admin/auth/bot-code` was removed on 2026-09-05**, with the bot's `/console` command
> that fed it. Staff are username+password accounts now; most have no Telegram account for a code
> to be tied to, and a bot that hands out console credentials leaves them in a chat log.
> `BOT_CODE_INVALID` and `BOT_CODE_EXPIRED` are retired and must not be reused.

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
  staff with their own console usernames and passwords, and has them sign in with those.
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
| `players.write`               | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `players.block`               | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `players.import`              | SUPER_ADMIN, FINANCE_ADMIN                                            |
| `withdrawals.read`            | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, PLATFORM_ADMIN         |
| `withdrawals.decide`          | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                                  |
| `botSettings.write`           | SUPER_ADMIN, FINANCE_ADMIN                                            |
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
GET  /v1/admin/players?status=&telegramUserId=&linked=true|false&search=
                      &source=TELEGRAM|ICHANCY_IMPORT|ADMIN&blocked=true|false&limit=&offset=
GET  /v1/admin/players/:id
GET  /v1/admin/players/:id/balance
     -> { playerId, balanceMinor, currencyCode, readAt }
POST /v1/admin/players
     { telegramUserId?, firstName?, lastName?, phone?, createIchancyAccount? }
     -> 201 { player: AdminPlayerView,
              ichancy: { playerId, ichancyPlayerId, ichancyLogin, created, agentId } | null,
              ichancyError: string | null }
POST /v1/admin/players/:id/ichancy-account
     -> { playerId, ichancyPlayerId, ichancyLogin, created, agentId }
POST /v1/admin/players/:id/block          { reason: string (1..280) }  -> AdminPlayerView
POST /v1/admin/players/:id/unblock                                     -> AdminPlayerView
PATCH /v1/admin/players/:id/telegram      { telegramUserId: string }   -> AdminPlayerView
POST /v1/admin/players/import             { limit?: number }           -> PlayerImportSummary
POST /v1/admin/players/:id/debit
     { amountMinor, reason }
     -> { debitId, playerId, amountMinor, status, playerBalanceBeforeMinor,
          playerBalanceAfterMinor, verifiedBy, reason, decidedBy, createdAt }
```

`PlayerImportSummary`: `{ scanned, created, existing, error: string | null, startedAt, finishedAt }`.

Roles, read out of `src/modules/player/player.constants.ts` on 2026-08-25 and matching
`permissions.ts` exactly:

| Route                             | Backend constant               | Roles                                                         |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| list, get, **balance**            | `PLAYER_READER_ROLES`          | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER, SUPPORT, PLATFORM_ADMIN |
| `POST /ichancy-account`           | `PLAYER_ICHANCY_MANAGER_ROLES` | SUPER_ADMIN, FINANCE_ADMIN                                    |
| `POST /debit`                     | `PLAYER_DEBIT_DECIDE_ROLES`    | SUPER_ADMIN, FINANCE_ADMIN, REVIEWER                          |
| `POST /`, `PATCH /:id/telegram`   | `PLAYER_CREATE_ROLES`          | SUPER_ADMIN, FINANCE_ADMIN                                    |
| `POST /:id/block`, `/:id/unblock` | `PLAYER_BLOCK_ROLES`           | SUPER_ADMIN, FINANCE_ADMIN                                    |
| `POST /import`                    | `PLAYER_IMPORT_ROLES`          | SUPER_ADMIN, FINANCE_ADMIN                                    |

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

`AdminPlayerView`: `id, telegramUserId: string | null, telegramUsername, firstName, lastName,
languageCode, status, source, currencyCode, ichancyLinked, createdAt, lastSeenAt, ichancyPlayerId,
ichancyLogin, ichancyRegisteredAt, phone, blockedAt, blockedReason, blockedByAdminId`.

`PlayerStatus`: `PENDING_ICHANCY ACTIVE SUSPENDED SELF_EXCLUDED CLOSED BLOCKED`.
`PlayerSource`: `TELEGRAM ICHANCY_IMPORT ADMIN`.

#### Players that were never a Telegram account

**`telegramUserId` is nullable now**, and the reason is `source`. A player used to BE a Telegram
account that pressed Start (`TELEGRAM`). Two other doors exist since 2026-09-04:

- `ICHANCY_IMPORT` — the "old players": accounts that already existed under the operator's Ichancy
  agent before the bot did. `POST /v1/admin/tenants` pulls them in after activation (see the
  `provisioning` block), and `POST /v1/admin/players/import` re-runs that for an operator whose
  first run met an outage. Both are idempotent: a row already known by Ichancy id or login counts
  as `existing`. An Ichancy failure is REPORTED in `error`, never thrown — the rows written before it
  stay written, and the summary says how far it got.
- `ADMIN` — a row registered from this console with `POST /v1/admin/players`. Every body field is
  optional in the strict sense (absent, never `""`). With `createIchancyAccount: true` the server
  links the row AFTER the transaction (an outside call is never made inside one) and reports that
  link separately: a failed link is `ichancy: null` plus an `ichancyError`, and the player still
  exists. Known refusals: `PLAYER_TELEGRAM_ID_TAKEN` (409) for an id another player holds.

Either kind gets a Telegram id later with `PATCH /v1/admin/players/:id/telegram`, which is
refused for a row that already has one (`PLAYER_HAS_TELEGRAM`) — repointing an account is a
different act — and for an id somebody else holds (`PLAYER_TELEGRAM_ID_TAKEN`). Once attached, the
next `/start` from that account lands on this row.

#### Blocking — the operator's own lock

`BLOCKED` is not an Ichancy state. A blocked player can do nothing in this tenant's bot — no menu,
no deposit, no withdrawal — and is refused by the player API with `403 PLAYER_BLOCKED`, while their
casino account is untouched. `POST /:id/block` takes a reason (1..280), sets `blockedAt`,
`blockedReason` and `blockedByAdminId` together, revokes the player's sessions and publishes a
`PLAYER_STATUS_CHANGE`; `POST /:id/unblock` clears the three and returns the row to `ACTIVE` when
it is linked, `PENDING_ICHANCY` when it is not. A `CLOSED` row cannot be blocked (409
`PLAYER_NOT_ACTIVE`); blocking twice is 409 `PLAYER_ALREADY_BLOCKED`.

`POST .../ichancy-account` is safe to repeat: `created:false` means the player was already linked.

`PlayerDebitStatus`: `DEBITED REJECTED NEEDS_RECONCILIATION`. `verifiedBy` is the `CreditVerifiedBy`
enum, and is null until something proves the debit.

`POST .../debit` is the opposite of the account call in every way that matters. It takes money OUT
of a player's Ichancy account and back into the agent float, it is admin-initiated (no player
request, no queue, no second approver), and it is **not idempotent and not safe to repeat** —
Ichancy has no idempotency key, so a second call is a second debit. The server verifies by reading
the balance before and after; when it still cannot tell, it answers `NEEDS_RECONCILIATION`, which
means a human checks Ichancy. The console must never turn that into a retry.

### The bot's menu — `/v1/admin/bot-menu`

The player's Telegram menu, as a graph the operator edits. **Nodes are screens, buttons are the
edges between them.**

```
GET    /v1/admin/bot-menu                       (the whole tree, the action catalogue, the gate)
POST   /v1/admin/bot-menu/nodes
PATCH  /v1/admin/bot-menu/nodes/:id
DELETE /v1/admin/bot-menu/nodes/:id             (refused for root, and for a screen still linked to)
PATCH  /v1/admin/bot-menu/nodes/:id/reorder
POST   /v1/admin/bot-menu/buttons
PATCH  /v1/admin/bot-menu/buttons/:id
DELETE /v1/admin/bot-menu/buttons/:id           (a real delete — no history references a button)
PATCH  /v1/admin/bot-menu/gate
GET    /v1/admin/bot-menu/settings              -> { miniAppUrl, withdrawalMode, chatMenuButtonSet }
PATCH  /v1/admin/bot-menu/settings              { miniAppUrl?: string | null, withdrawalMode?: 'AUTO'|'MANUAL' }
```

**The whole tree is one GET, and that is deliberate.** The editor draws a graph: a `NAVIGATE`
button names its destination, so a client holding one screen without the others cannot render its
own edges. Paginating this would mean assembling a graph from pages and guessing at the links
between them. A menu is a few dozen rows.

**A button's `label` is the routing key, not a caption.** The menu is a Telegram
`ReplyKeyboardMarkup`, which carries no hidden payload — a tap arrives at the bot as a plain text
message whose body IS the label. Hence the unique index on `(node, label)`: two buttons sharing a
label on one screen would be indistinguishable to the bot. Renaming one changes behaviour.

`kind` decides which payload column a button carries, and exactly one:

| `kind`     | carries         | does                                             |
| ---------- | --------------- | ------------------------------------------------ |
| `BUILTIN`  | `builtinAction` | runs a handler the bot already has               |
| `NAVIGATE` | `targetNodeId`  | opens another screen                             |
| `TEXT`     | `bodyText`      | replies with the operator's message, staying put |
| `BACK`     | nothing         | returns to whichever screen the player came from |

The server nulls the other columns on every write, and a CHECK constraint refuses any row that
carries the wrong one. `builtinAction` is validated against the bot's own action list — an operator
may move, rename, hide or delete the deposit button, but cannot invent a ninth action, because an
action is a method. `GET` returns that list as `builtinActions: [{ action, description }]`.

`BACK` carries no target because where it returns to is the **player's own path**, held server-side
as a stack. A screen reachable from two places has no single parent.

Reorder takes the screen's whole layout in one request — `{ positions: [{ id, rowIndex, sortOrder
}] }` — applied in a transaction. A drag moves several buttons, and applying it as a sequence of
PATCHes would serve players the half-moved arrangements in between.

`PATCH /gate` sets the channel a player must join before `/start` opens the menu: `{ channelId,
channelUsername }` to set, both null to clear. **Both or neither** — a username with no id cannot be
queried, an id with no username is not tappable. `channelId` crosses the wire as a **string**, since
a Telegram channel id is a signed 64-bit number. Checked only at `/start`.

> **The bot must be an administrator of that channel.** `getChatMember` only answers for an admin
> bot. Without it the check fails, and the gate lets everyone through rather than locking out
> players who are already members — a fail-open the API cannot detect for you.

Manager roles write; reader roles may `GET`.

#### The bot's two runtime settings — `/v1/admin/bot-menu/settings`

The two operator settings the bot reads at runtime that are not buttons, and the tree carries a
copy of them as `settings` so the flow editor needs no second read:

```
{ miniAppUrl: string | null, withdrawalMode: 'AUTO' | 'MANUAL', chatMenuButtonSet: boolean }
```

- `miniAppUrl` is what the "🚀 فتح التطبيق" button and the `/app` command open. `null` is "not set
  yet" — the bot answers "coming soon" — and the server insists on **https**. After a change it
  calls `setChatMenuButton` best-effort; `chatMenuButtonSet` reports whether that landed, because
  it can fail on its own while the URL still saved.
- `withdrawalMode` decides how a cash-out is answered — see Withdrawals below. `MANUAL`: a human
  approves first. `AUTO`: the platform approves, debits and checks the wallet by itself, and a human
  still performs the transfer.
- PATCH semantics: an absent key leaves the value alone; `miniAppUrl: null` clears it. Both fields
  also live on the tenant row (`TenantView.withdrawalMode` / `miniAppUrl`), which is the same
  setting seen from the platform side. Roles: `BOT_MENU_MANAGER_ROLES` write (`botSettings.write`
  on the console), readers `GET`.
- Two more built-in actions exist: `withdraw` and `miniapp`. `REQUIRED_BUILTIN_ACTIONS` =
  `deposit`, `withdraw`, `profile`: deleting or hiding the LAST active button carrying one of these
  is refused with `409 BUTTON_REQUIRED`, and so is deleting a screen that would take one with it.

### Withdrawals — `/v1/admin/withdrawals` (offset paginated)

A player's cash-out. Money going OUT, in two separate movements this API keeps apart on purpose:
the **debit** (the player's casino balance is taken so it cannot be spent twice) and the **payout**
(a person sends the money and records that they did). **No payout rail here can send money over an
API** — Sham Cash is read-only — so even in `AUTO` mode a human performs the transfer and marks
the row paid.

```
GET  /v1/admin/withdrawals
     ?status=REQUESTED,DEBITED        (comma separated; absent = every status)
     &playerId= &shortId= &createdFrom= &createdTo=   (ISO-8601)
     &sort=newest|oldest &limit= &offset=
GET  /v1/admin/withdrawals/:id
POST /v1/admin/withdrawals/:id/approve                                   -> AdminWithdrawalView
POST /v1/admin/withdrawals/:id/reject      { reason: string (1..280) }   -> AdminWithdrawalView
POST /v1/admin/withdrawals/:id/mark-paid   { payoutReference: string (1..128) } -> AdminWithdrawalView
```

`AdminWithdrawalView`:

```ts
{ id, shortId, status: WithdrawalStatus, mode: 'AUTO'|'MANUAL', source: string|null,
  playerId, playerTelegramUserId: string|null, playerTelegramUsername: string|null, playerIchancyLogin: string|null,
  paymentMethodId, methodCode, methodName, payoutAddress, payoutNetwork: string|null,
  amount: MoneyView, fee: MoneyView, balanceAtRequest: MoneyView | null,
  walletCheck: { status: 'ok'|'insufficient'|'unknown'|'not_configured',
                 availableMinor: string|null, currency: string|null, checkedAt } | null,
  playerDebitId: string|null, payoutReference: string|null, ledgerPayoutTxId: string|null,
  decidedByAdminId: string|null, paidByAdminId: string|null, rejectionReason: string|null,
  failureCode: string|null, failureMessage: string|null,
  requestedAt, decidedAt: string|null, debitedAt: string|null, paidAt: string|null, closedAt: string|null }
```

`WithdrawalStatus`: `REQUESTED APPROVED DEBITING DEBITED PAID DEBIT_FAILED NEEDS_RECONCILIATION
REJECTED CANCELLED`.

The life of a row, and which action acts where:

- `REQUESTED` — the player asked. Under `MANUAL` it waits here for `approve` or `reject`; under
  `AUTO` the server moves it to `APPROVED` in the same transaction, with `decidedByAdminId: null`.
- `APPROVED` → `DEBITING` → `DEBITED` — the worker debits the player through the same debit
  service a manual debit uses (mutex, two attempts, balance-delta verify), records `playerDebitId`,
  then asks the payout wallet what it holds and stores `walletCheck`. Ichancy refusing (the player
  spent the money meanwhile) is `DEBIT_FAILED` with `failureCode`; Ichancy neither confirming nor
  denying is `NEEDS_RECONCILIATION` — the same word, and the same rule, as the debit route: **a
  human checks Ichancy, nothing retries.**
- **`DEBITED` is not paid.** The player has been charged and nobody has been paid. This is the
  state the queue exists for and the only one `mark-paid` accepts: a person sends the money to
  `payoutAddress`, types the transfer reference, and the server posts the payout to the ledger
  (`ledgerPayoutTxId`), stamps `paidAt` / `paidByAdminId`, and closes the row as `PAID`.
- `REJECTED` (a human, with a reason; nothing was taken) and `CANCELLED` (the player, while still
  `REQUESTED`) are the two closed-without-money endings.

`walletCheck` carries the never-0 rule every balance on this console follows: `availableMinor` is
null for `unknown` (the chain or Sham Cash did not answer) and `not_configured` (a placeholder
address, a cash office) — neither is `insufficient`, and neither may render as an empty wallet.

Each action answers `409 WITHDRAWAL_INVALID_STATE` when the row is not in the one state it acts
on — a colleague may have decided first, and the console renders that as "already handled", not
as a failure of the click. `404 WITHDRAWAL_NOT_FOUND` for an id that does not exist.

Roles: `WITHDRAWAL_READER_ROLES` = the player reader set (`withdrawals.read`), and
`WITHDRAWAL_DECIDE_ROLES` = SUPER_ADMIN, FINANCE_ADMIN, REVIEWER (`withdrawals.decide`) — pinned to
the debit decide set on the backend by a spec, because a cash-out is a money decision.

### Payment methods and destinations — `/v1/admin`

```
GET    /v1/admin/payment-methods?isActive=&rail=
GET    /v1/admin/payment-methods/:id
POST   /v1/admin/payment-methods
PATCH  /v1/admin/payment-methods/:id
DELETE /v1/admin/payment-methods/:id                    (deactivates — a rail that took money is never deleted)
DELETE /v1/admin/payment-methods/:id/permanent          (really deletes; refused unless the rail has no history)
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
POST   /v1/admin/admins        { displayName, role, username, password }
PATCH  /v1/admin/admins/:id    { displayName?, role?, isActive?, username?, password? }
DELETE /v1/admin/admins/:id    (deactivates)

POST   /v1/admin/admins/:id/telegram-link-code  -> StaffTelegramLinkCodeView   (200, no-store)
DELETE /v1/admin/admins/:id/telegram-link       -> AdminUserView
```

`AdminUserView`: `id, telegramUserId, telegramLinked, username, hasPassword, displayName, role,
isActive, lastLoginAt, createdAt`.
Known errors: `ADMIN_SELF_MODIFICATION`, `ADMIN_LAST_SUPER_ADMIN`, `ADMIN_ALREADY_EXISTS`,
`ADMIN_TELEGRAM_LINK_FORBIDDEN`, `ADMIN_TELEGRAM_ALREADY_LINKED`, `ADMIN_TELEGRAM_LINK_NOT_ALLOWED`.

`telegramLinked` (2026-09-15) is whether a PERSON's Telegram account is linked to this staff account,
which is what makes their Approve and Reject taps in the staff group count. It is `false` for a null
`telegramUserId` and also for the agent principal's reserved `"0"`, which is not a person. The
console reads this field, never `telegramUserId !== null`.

- A staff account **is** a username and a password (2026-09-05). Both are required on create, and
  `telegramUserId` is **refused outright** — the pipe runs `forbidNonWhitelisted`, so a client
  still sending it gets a 400 rather than having it ignored.
- `username`: 3–64 characters, `[A-Za-z0-9._@+-]`, unique per tenant, lower-cased on write. An
  email is a perfectly ordinary one.
- `password`: 8–72 characters, never trimmed, stored as a scrypt hash. On PATCH it is
  **blank-means-unchanged** — omit the field to leave the existing password alone. It is never
  readable back; `hasPassword` is the only thing the view says about it.
- `telegramUserId` on the view is `null` for every account created since the change, and non-null
  only for admins made before it, each operator's agent principal, and accounts linked with a code
  (below). It is what lets those rows work the Telegram bot (`/queue`, `/float`, the approve
  buttons); it is not a login.

#### Linking a staff account to Telegram — one-time code (owner decision 4, 2026-09-15)

A staff member who approves in the staff group needs their Telegram id on their staff account,
because every tap is checked against the TAPPER's id, never the chat. A typed id proves nothing, so
`telegramUserId` stays refused on create and update, and this is the only way it is set:

1. The console asks `POST /v1/admin/admins/:id/telegram-link-code` and shows the code once.
2. The staff member opens the operator's bot in a PRIVATE chat, from the Telegram account that will
   approve, and sends exactly `/link <code>` as a new message.
3. The backend stores that update's `from.id` on the staff account. The console sees
   `telegramLinked: true` on the next read.

`StaffTelegramLinkCodeView`: `adminUserId, code, command, expiresAt, ttlSeconds, botUsername,
botUrl`.

- `code` is 8 characters grouped for reading, `ABCD-EFGH`; `/link` accepts it with or without the
  hyphen, in any case. `command` is exactly what to send: `/link ABCD-EFGH`.
- One use, `ttlSeconds` = 600 (10 minutes, until `expiresAt`). Asking again revokes the previous
  code. The answer carries `Cache-Control: no-store`; the code is in this body and nowhere else.
- `botUsername` (without `@`) and `botUrl` (`https://t.me/<botUsername>`, which opens the private
  chat) are null until Telegram has confirmed the operator's bot once.
- Who may ask: the staff member for their own account, or platform staff (a `PLATFORM_ADMIN` working
  in tenant zero, reaching the operator through `X-Tenant-Id`). Nobody else, a `SUPER_ADMIN`
  included: whoever sees a code can send it from their own Telegram and act as that person. 403
  `ADMIN_TELEGRAM_LINK_FORBIDDEN`. Throttled per admin (10 a minute).
- 409 `ADMIN_TELEGRAM_ALREADY_LINKED`: remove the link first; a code never replaces one silently.
- 422 `ADMIN_TELEGRAM_LINK_NOT_ALLOWED` with `details.reason`: `PLATFORM` (tenant zero has no bot),
  `OPERATOR_CLOSED`, `AGENT_PRINCIPAL`, `INACTIVE`. 404 `ADMIN_NOT_FOUND` for another operator's id.

What the bot does with `/link` (no HTTP, but staff will ask): a code posted in a GROUP is revoked and
the group is told never to post one there; an EDITED `/link` is never redeemed (the bot answers
"send it as a new message"); 5 attempts per sender per operator per 15 minutes.

`DELETE /v1/admin/admins/:id/telegram-link` removes the link and revokes any live code. Idempotent:
an unlinked account comes back unchanged. Who may: the staff member, a `SUPER_ADMIN` of the operator,
or platform staff; a `PLATFORM_ADMIN` row only by someone who could grant that role. 403
`ADMIN_TELEGRAM_LINK_FORBIDDEN`, 422 `ADMIN_TELEGRAM_LINK_NOT_ALLOWED` (`AGENT_PRINCIPAL`). A tap in
the group is refused from the moment it returns.

The console mirrors these rules: it offers neither "Link Telegram" nor "Unlink" on the agent principal
(`telegramUserId` `"0"`), and "Unlink" on a `PLATFORM_ADMIN` row only to a `PLATFORM_ADMIN` with no
tenant override. It keeps a code only while its dialog is open (`gcTime: 0`, reset on close and
unmount).

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
                                                              deltaMinor, breakId, belowWatermark,
                                                              ichancyFake }
GET  /v1/admin/reconciliation/rail-ageing                -> { generatedAt, rows[], staleAccountCodes[] }
POST /v1/admin/reconciliation/invariants/run             -> { ok, checkedAt, violations[], truncated }
```

`ichancyFake` (always present) is true when the deployment runs with `ICHANCY_FAKE=true`. Then the
wallet was NOT read: `ichancyMinor`, `deltaMinor` and `breakId` are null, `belowWatermark` comes from
the ledger alone, and no break is opened. The console shows a fake-mode notice there instead of its
"Ichancy could not be read" alert, which a null `ichancyMinor` means in real mode.

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
POST  /v1/admin/tenants          -> 201, lands SUSPENDED until its staff group is bound
PATCH /v1/admin/tenants/:id      { displayName?, adminChatId?, feedChatId?,
                                   dualApprovalThresholdMinor?, agentFloatLowWatermarkMinor?,
                                   depositExpiryMinutes? }
POST  /v1/admin/tenants/:id/activate     (refused without a staff group; then a real Ichancy signin)
POST  /v1/admin/tenants/:id/suspend

POST   /v1/admin/tenants/:id/webhook     -> TenantWebhookView   (tells Telegram where to deliver)
DELETE /v1/admin/tenants/:id/webhook     -> TenantWebhookView   (stops delivery; keeps serving)
POST   /v1/admin/tenants/:id/bot-setup   -> { commandsSet, scopes[] }
GET    /v1/admin/tenants/:id/health      -> { bot, ichancy, chats, counts }
PATCH  /v1/admin/tenants/:id/ichancy     { ichancyBaseUrl?, ichancyUsername?, ichancyPassword?,
                                           ichancyAgentId? }  -> TenantView
PATCH  /v1/admin/tenants/:id/bot         { botToken }          -> TenantView
POST  /v1/admin/tenants/:id/import-players -> PlayerImportSummary   (the "old players", again)

POST   /v1/admin/tenants/:id/telegram/bind-links      { purpose }  -> TelegramBindLinkView (200)
GET    /v1/admin/tenants/:id/telegram/chats                         -> TenantDiscoveredChatView[]
PUT    /v1/admin/tenants/:id/telegram/chats/:purpose  { chatId }   -> TenantView
DELETE /v1/admin/tenants/:id/telegram/chats/:purpose               -> TenantView
```

`POST /:id/import-players` runs the same Ichancy import creation runs — for an operator created
before it existed, or one whose first run met an outage. `{ scanned, created, existing, error,
startedAt, finishedAt, ichancyFake }`; idempotent, and an Ichancy failure is reported in `error`
rather than thrown. `PLATFORM_ADMIN`, like every route on this surface. `ichancyFake` is always
present on this route and true under `ICHANCY_FAKE`: every count is then of made-up players. (The
operator-side `POST /v1/admin/players/import` answers the same shape without `ichancyFake`, so the
console reads the field as optional.)

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
`adminChatId` ← NOTHING (changed 2026-09-15): the operator is created with no staff group, answers
`adminChatId: null`, and stays SUSPENDED until one is bound (see "Staff and feed groups" below). It is
no longer the creating admin's Telegram id: that is a person's private chat, never a staff group. A
chat named in the request is verified with Telegram before the row is written (400
`TELEGRAM_CHAT_REJECTED`), and an explicit `"0"` is 400 `VALIDATION_FAILED`. `feedChatId` ← nothing,
it stays optional with no default and is verified the same way when sent; everything else ← the
single **PlatformDefaults** settings row (DB-backed, seeded from the deployment's env values on first
run, read through one service).

`ichancyAgentId` is the exception: supplied → PlatformDefaults → tenant zero's `ichancyAgentId` →
**400 naming the field**. Ichancy `signin()` returns only a token pair, so an agent id can never be
derived from the credentials — there is no lookup. Two tenants sharing an agent id is allowed and is
how a second operator gets tested.

The response is the same `TenantView` as before, with every defaulted field resolved server-side
and visible in it, which is what the console's detail panel reads after create. `adminChatId` and
`feedChatId` are the two that may be null: nothing defaults them.

`TenantView`: `id, slug, displayName, status, hasWebhookPath, adminChatId: string | null,
feedChatId: string | null, botUsername, ichancyBaseUrl, ichancyUsername, ichancyAgentId,
currencyCode, dualApprovalThresholdMinor, agentFloatLowWatermarkMinor, depositExpiryMinutes,
withdrawalMode: 'AUTO'|'MANUAL', miniAppUrl: string | null, ichancyFake: boolean, createdAt,
updatedAt, counts?: {players, deposits}`.

`adminChatId` is the STAFF GROUP (review cards and operational alerts), `feedChatId` the FEED GROUP.
Null is "not bound" (stored as 0). While `adminChatId` is null nothing the operator sends to staff
reaches Telegram, activation is refused, and the console says so in red.

`ichancyFake` (always present, 2026-09-15) is deployment-wide — `ICHANCY_FAKE=true` — and repeated on
every operator, because the console reads operators, not deployments. When true, an ACTIVE status was
"verified" by the fake adapter, and the console must say that no real Ichancy connection was made.

`withdrawalMode` and `miniAppUrl` are the same two settings `/v1/admin/bot-menu/settings` serves
from inside the operator, seen from the platform side. Both are accepted on create and on update
(`withdrawalMode?: 'AUTO'|'MANUAL'`, `miniAppUrl?: string | null` — https, or null to clear). The
console parses them as optional, because a backend older than the withdrawal module answers
neither, and reads an absent mode as `MANUAL`.

`slug` and `currencyCode` are immutable after creation. Secrets are never returned; the webhook path
is reported only as `hasWebhookPath`. A new tenant lands SUSPENDED, and provisioning's activation step
(below) is refused while no staff group is bound — which, since create no longer defaults one, is
every create that names no `adminChatId`. It stays SUSPENDED until the platform admin binds its staff
group and activates it.

`TenantStatus`: `ACTIVE SUSPENDED CLOSED`.

`PATCH /:id` with a CHANGED `adminChatId` or `feedChatId` is a bind, not a column edit: it is verified
with Telegram first (same checks and same 400 `TELEGRAM_CHAT_REJECTED` as the chat routes below), only
when the value really differs from what is stored, and nothing is written if a check refuses. An
unchanged value sent back by the edit form verifies nothing. `"0"` is 400 `VALIDATION_FAILED`: a group
is removed with `DELETE /v1/admin/tenants/:id/telegram/chats/:purpose`, never by PATCH.

`POST /:id/activate` refusals, in the order they are checked: 422 `TENANT_CLOSED`, 422
`TENANT_STAFF_GROUP_REQUIRED` (no staff group; checked before any sign-in, the operator stays
SUSPENDED), 422 `TENANT_ICHANCY_UNCONFIGURED`, 422 `ICHANCY_SIGNIN_FAILED`, 503
`TENANT_ICHANCY_UNAVAILABLE`. The console shows the message verbatim and titles the first by its
code.

#### GET /:id/health — `chats`, and Ichancy in fake mode

```
health = { bot, ichancy, chats: { staff: BoundChatHealth, feed: BoundChatHealth }, counts }
BoundChatHealth = { chatId: string|null, title, status, isPresent, isAdministrator, canPost,
                    lastSeenAt }   // every field but chatId: the bot's last sighting, null if none
```

`chats.staff.chatId` is the bound staff group (null = not bound). `isPresent: false` means **the bot
was removed from that group**: the binding is kept, nothing reaches the group, and a human acts (add
the bot back as an administrator, or bind another group). No Telegram call is made for this block;
it is the chat directory, kept current by Telegram's own `my_chat_member` updates.

`ichancy.fake: boolean` is always present. When true (`ICHANCY_FAKE=true`): `ok` is **false**,
`error` is exactly `Ichancy is in fake mode (ICHANCY_FAKE=true): no real connection was made.`,
`floatMinor` null, `belowWatermark` false, `checkedAt` the time of the request; `baseUrl`,
`username`, `agentId` and `sharesAgentWith` stay real. No Ichancy call is made and nothing is cached.
Tenant zero in fake mode keeps its own error ("Tenant zero is the platform, not an operator…") with
`fake: true`, so the console keys on `fake`, never on the error text. In real mode nothing changed.

#### Staff and feed groups — `/v1/admin/tenants/:id/telegram` (owner decisions 1, 2, 3, 5 — 2026-09-15)

`PLATFORM_ADMIN` only, like the rest of this surface, and the operator is named in the path: only the
platform binds or changes an operator's groups. `:purpose` and `purpose` are `STAFF` (the staff
group, `adminChatId`) or `FEED` (the feed group, `feedChatId`).

Tenant zero (`00000000-0000-0000-0000-000000000000`) is the platform itself, not an operator: it is
ACTIVE with `adminChatId` and `feedChatId` null. Issuing a link, binding (`PUT`, or `PATCH /:id` with a
changed chat) and removing a group are all refused for it with 422 `TENANT_PLATFORM_LOCKED`, "Tenant
zero is the platform itself, not an operator, and has no staff or feed group.", checked after 404 and
before `TENANT_CLOSED`. `GET /:id/telegram/chats` is not refused.

**Everything else tenant zero refuses, and the little it does not.** Four more routes answer 422
`TENANT_PLATFORM_LOCKED`, each with its own sentence: `POST /:id/suspend` (suspending it "would lock
every platform admin out of sign-in"), `PATCH /:id/bot` (no bot to replace), `PATCH /:id/ichancy` and
`POST /:id/import-players` (both: "Tenant zero is the platform, not an operator: it has no Ichancy
agent."). `POST` and `DELETE /:id/webhook` and `POST /:id/bot-setup` are refused as well, but with
422 `TENANT_BOT_UNAVAILABLE` and not by an id check at all: they go through the operator's bot, and
tenant zero's stored token is a placeholder. NOT refused, and so never hidden by the console:
`POST /:id/activate` (an operator already serving is answered as it is, 200), `GET /:id/health` (its
`ichancy` comes back not checked, carrying the no-agent sentence), `GET /:id/telegram/chats`,
`PATCH /:id` itself, and every route that manages platform staff.

The console keys on the id. Tenant zero gets no missing-staff-group warning and no group steps, and
also no bot-token, webhook, command-menu or agent step, no Telegram, Ichancy or import panel, and no
Suspend button — one neutral sentence in place of the panels, and one line saying it has no groups.
Its checklist is the two steps that are real for it: an admin who can sign in, and "activated". The
counts, the health re-read and Edit settings stay, because the backend answers those.

Staff Telegram links follow the same rule from the other side: while the console is working in tenant
zero, `POST /v1/admin/admins/:id/telegram-link-code` is refused for **every** row with 422
`ADMIN_TELEGRAM_LINK_NOT_ALLOWED` and `details.reason: PLATFORM` — decided before the account is read
— so "Link Telegram" is not offered there and the row says the platform has no bot instead.
`DELETE /v1/admin/admins/:id/telegram-link` is NOT refused for it, so "Unlink" stays.

**The primary path — "Add bot to staff group".** `POST /:id/telegram/bind-links { purpose }` answers

`TelegramBindLinkView`: `purpose, url, botUsername, expiresAt, adminRights[]`

`url` is `https://t.me/<botUsername>?startgroup=<nonce>&admin=post_messages+delete_messages+pin_messages+manage_chat`
(`adminRights` lists the same rights). The console opens it in a new tab; Telegram asks which group to
add the bot to, as an administrator with those rights, and then sends `/start@<bot> <nonce>` in that
group. The backend matches the nonce to this operator and purpose, verifies the chat with Telegram
(group or supergroup, bot present, administrator, able to post), binds it, posts a short confirmation
in the group, and — for the staff group — queues review cards for deposits already waiting.

- One use, for 15 minutes (`expiresAt`). Issuing a new link for the same purpose revokes the previous
  one. The nonce is in `url` only: never logged, never in an audit row; treat the URL as a credential.
- Opening a fresh link in the group that is ALREADY bound writes nothing, does not use the link up,
  and the bot replies "This group is already the staff group of <name>. Nothing changed."
- A bind that fails verification leaves nothing bound and the bot explains in the group.
- Refusals: 404 `TENANT_NOT_FOUND`, 422 `TENANT_PLATFORM_LOCKED` (tenant zero), 422 `TENANT_CLOSED`,
  422 `TENANT_BOT_UNAVAILABLE` (the bot has no known @username yet: replace its token).
- The result is not pushed to the console. While a link is out the console polls `GET /:id` every few
  seconds and sees `adminChatId` change; `GET /:id/telegram/chats` is polled only while the list is
  open. Polling stops when the bind lands, when the admin dismisses the link, or at `expiresAt`: a
  link nobody uses, or one opened in the group already bound, never changes the row. At `expiresAt`
  the console reads `GET /:id` once more, then says the link expired and offers a new one.
- The console keeps the URL only while it is on screen (component state and the mutation result,
  `gcTime: 0`, reset on dismiss and unmount). Dismissing does not revoke the link.
- Telegram only reaches the webhook over public https, so on a laptop without a tunnel neither the
  link nor discovery can complete; a typed id through `PUT` (below) still works, as that call is
  outgoing.

**The fallback — groups the bot was seen in.** `GET /:id/telegram/chats` answers this operator's
chat directory, most recent first, removals included. Groups the bot joins any other way (not through
a link) are recorded here, for a SUSPENDED operator too.

`TenantDiscoveredChatView`: the `DiscoveredChatView` of `/v1/admin/telegram/chats` (`chatId, chatType,
title, username, status, isAdministrator, isPresent, canPost, alreadyBound, firstSeenAt, lastSeenAt`)
plus `boundAs: ('STAFF'|'FEED')[], migratedToChatId: string|null, lastChangedByTelegramUserId:
string|null, lastChangedByUsername: string|null`.

- Here `alreadyBound` means "bound as this operator's staff or feed group" (`boundAs` non-empty), NOT
  "an active destination".
- `lastChangedBy…` is who last added, promoted or removed the bot, so a stranger's group is
  recognisable before anybody picks it. Anyone can add a public bot to their own group, and picking
  the wrong row would leak player names and amounts into it.
- `migratedToChatId` non-null: the group became a supergroup; this row is the dead id and should not
  be picked (binding it binds the new id). Stored ids move automatically on migration.

`PUT /:id/telegram/chats/:purpose { chatId }` binds a picked row's `chatId` (or an id typed on a
laptop) and answers the `TenantView`. Being in the list is never permission: the chat is verified with
Telegram at that moment, outside any transaction, and a refusal is audited and answered

**400 `TELEGRAM_CHAT_REJECTED`**, `details: { reason, purpose, field, chatId, detail }`, message ending
"Nothing was saved.":

| `reason`              | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `NOT_FOUND`           | Telegram does not know the chat or will not show it to this bot                 |
| `PRIVATE_CHAT`        | A one-to-one chat; a staff or feed group must be a group                        |
| `CHANNEL_NOT_ALLOWED` | A channel; staff must be able to tap the review buttons, so it must be a group  |
| `BOT_NOT_MEMBER`      | Add the bot to the group                                                        |
| `BOT_NOT_ADMIN`       | Make the bot an administrator                                                   |
| `BOT_CANNOT_POST`     | The bot is restricted from sending messages                                     |

`field` names the request field that carried the chat (`chatId`, `adminChatId`, `feedChatId`), `chatId`
the id finally checked (a supergroup's when the group had moved), `detail` Telegram's own words or
null. Telegram being unreachable is 503 `TENANT_TELEGRAM_UNREACHABLE`; `"0"` is 400
`VALIDATION_FAILED`. Also 404 `TENANT_NOT_FOUND`, 422 `TENANT_PLATFORM_LOCKED`, 422 `TENANT_CLOSED`.

`DELETE /:id/telegram/chats/:purpose` removes a group and answers the `TenantView`. The STAFF group of
an ACTIVE operator is refused with 422 `TENANT_STAFF_GROUP_REQUIRED` ("an active operator must always
have a staff group"): bind another group instead, or suspend first. Also 404 `TENANT_NOT_FOUND`, 422
`TENANT_PLATFORM_LOCKED` (tenant zero), 422 `TENANT_CLOSED`.

**`TENANT_STAFF_GROUP_REQUIRED` (422)** is answered in three places: `POST /:id/activate` (and so
provisioning's `activationError`) while no staff group is bound; `DELETE /:id/telegram/chats/STAFF` on
an ACTIVE operator; and starting a deposit (`POST /v1/deposits`, the bot's deposit buttons) for an
operator that is ACTIVE with no staff group — a row that predates the rule. The player-facing message
there is the same "Deposits are paused for this cashier right now…" as `TENANT_NOT_ACTIVE`, with
`details: { status: 'ACTIVE' }`; the code tells the console and the logs the real cause. No data
migration suspended such rows.

A fresh dev install (`npm run seed`) creates its bootstrap operator SUSPENDED with `adminChatId: null`;
it becomes ACTIVE only once a staff group is bound and it is activated.

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

### Sham Cash — `/v1/admin/shamcash`

The operator's external Sham Cash cashier account, read through **its HTTP API** with a per-tenant
key. One credential, on the tenant row: `shamcash_wallet_id` plus a sealed `shamcash_api_key_enc`.

```
GET    /v1/admin/shamcash/status    -> ShamCashStatus
POST   /v1/admin/shamcash/balance   -> ShamCashReadResult
POST   /v1/admin/shamcash/test      -> ShamCashTestResult
POST   /v1/admin/shamcash/api       { walletId, apiKey }  -> ShamCashStatus
DELETE /v1/admin/shamcash/api       -> ShamCashStatus
```

`ShamCashStatus` = `{ apiLinked, walletId }`. **The key is never returned**, by this or any endpoint
— a console that echoes a secret back turns every screenshot and browser cache into a place it leaks
from. The wallet id **is** returned in full: it is the path segment in the vendor's URL, not a
credential, and an operator has to be able to check what was saved.

`POST .../balance` calls `GET https://api-shamcash.com/api/v1/wallets/shamcash/{walletId}/balance`
with an `x-api-key` header. `ShamCashReadResult` is a discriminated union on `status`: `ok` carries
`balances[]` (currency, available, locked) and `checkedAt`; `not_linked`, `unauthorized` and
`unavailable` (with a `detail`) carry no balance — **a failure is never a wallet of zeros**, which is
the most alarming false statement this screen could make. POST, not GET: it hits a third party, so
it is an action with a cost rather than a read a link-prefetcher should fire.

`POST .../test` is the live proof that a saved key WORKS, as opposed to merely being saved: it reads
the balance AND lists the first page of transactions, and reports the two SEPARATELY. They are
different endpoints and can fail apart — a wallet id right for one path, a permission scoped to one,
an outage on one — so "the key is fine but lookups are down" and "the key is wrong" stay
distinguishable, which one combined verdict would hide.

`POST .../api` takes the wallet id and key TOGETHER; a database CHECK refuses a half-set pair,
because a key with no wallet id has no URL to call and a wallet id with no key is a request that will
be rejected. The key is sealed (AES-256-GCM) under its own derived key, so rotating another tenant
secret does not widen to it.

It also SYNCS the rail: the wallet id is written onto the active destinations of the `SHAM_CASH`
method, so the account whose statement is read and the account a player is told to pay into are
always the same one. Left unlinked, an operator could read wallet A while collecting into wallet B —
every deposit landing somewhere verification would never see.

**Roles: `SUPER_ADMIN`, `FINANCE_ADMIN` and `PLATFORM_ADMIN`** — managing an external cashier
account is a money action; the platform role is there so it can configure a tenant on its behalf.

> **Removed 2026-09-03: the browser session.** Sham Cash used to encrypt every API call with a key
> its own front-end minted per request, so the only way in was to replay an operator's signed-in
> browser in headless Chromium and parse the rendered page — `POST/DELETE /session`, sealed cookies,
> a Syrian egress tunnel, and a page that took up to 54 seconds to paint. The vendor issues API keys
> now, and the LIVE path is entirely the routes above: the session routes and the columns they wrote
> to are gone for good, and the cookies they held were destroyed with them.
>
> **The reader itself came back on 2026-09-07 as a developer bench**, described below. It is not a
> way to read Sham Cash — it is a way to ask the two questions the API cannot answer when the site
> changes underneath us.

### Sham Cash developer bench — `/v1/admin/shamcash/dev` (flagged OFF)

```
POST /v1/admin/shamcash/dev/browser-check   { accessToken, authToken, forge?, pinCodeHash?, pin? }
                                            -> ShamCashDevResult
POST /v1/admin/shamcash/dev/parse           { text }  -> { balances[], transactions[] }
```

**Both answer 404 unless the API has `SHAM_CASH_DEV_CHECK` set**, which no real deployment does —
the same answer as a route that does not exist, deliberately. A 403 would tell an unauthenticated
scanner that an endpoint able to drive a browser at a third-party site is present here, which is
exactly what the move to the HTTP API removed. The console registers its own page only when
`VITE_ENABLE_SHAMCASH_DEV` is on; both flags are needed for the screen to be reachable AND useful.

**Roles: `SUPER_ADMIN` and `PLATFORM_ADMIN`.** The body carries a live cashier session, so it takes
the pair that already owns the operator's money surface — not the reviewer/support/viewer tier that
can read a deposit queue.

**Nothing is stored.** The five values live for the duration of one request. There is no column to
write them to and the console offers no "save": the storage that existed was dropped by
`20260903140000_drop_shamcash_session`.

`browser-check` launches Chromium, replays the session at shamcash.sy and answers with the reader's
own verdict. **Expect 55-90 seconds** — the site is slow to render and the ceiling is
`SHAM_CASH_SETTLE_MS`. From a server outside Syria it needs `SHAM_CASH_PROXY_SERVER`, because
shamcash.sy drops non-Syrian connections after the handshake with no error page.

```ts
ShamCashDevResult = { status: 'ok', balances[], transactions[], checkedAt }
                  | { status: 'expired' }
                  | { status: 'unavailable', detail, debug?: { url, textSnippet, htmlSnippet,
                                                               storageKeys[], errors[], api[] } }
```

`expired` is a **200, not a 4xx**: "your cookies are stale" is the answer to the question asked, not
a failure to answer it. `debug` appears only for the one failure that cannot be diagnosed from a
message — the page loaded, was not redirected to login, and still did not look like the account
home — and carries what tells "we were blocked", "it is still loading" and "they redesigned it"
apart.

`parse` takes page **text**, not HTML: the parser reads `innerText`, so markup would exercise a path
that does not exist and report nothing for a page that parses perfectly. No browser, no network and
no session — which is what separates a parsing regression from a credential problem, two things that
look identical from outside and have completely different fixes.

#### Linking by QR — the way the site's own web client does it

```
POST   /v1/admin/shamcash/dev/qr   { pin? }   -> { pairingId, qrImage, strategy, pageUrl,
                                                   expiresAt, pageHtml? }
GET    /v1/admin/shamcash/dev/qr/:pairingId   -> PairingPoll
DELETE /v1/admin/shamcash/dev/qr/:pairingId   -> 204
```

Copying five values out of developer tools is the most error-prone step on the bench: one wrong
character produces a ninety-second failure indistinguishable from an expired session. This asks
Sham Cash to do what it already does for its own web login — draw a QR, wait for the phone app to
approve it, and write the cookies itself.

**Nothing about the pairing protocol is reimplemented.** `POST /qr` opens a real browser on
shamcash.sy's login page, screenshots the code it drew, and **keeps that browser open**. The page's
own JavaScript does the polling; when you scan, it signs itself in exactly as it would on a desktop
and the cookies appear in that context, where they are read out.

```ts
PairingPoll = { status: 'pending', expiresAt }
            | { status: 'linked', session: { accessToken, authToken, forge?, pinCodeHash? },
                pinRequired }
            | { status: 'expired' }
            | { status: 'failed', detail }
```

**The session is handed over exactly once.** A `linked` poll closes the browser and drops the
pairing, so polling that id again answers `expired`. These are live credentials; an endpoint that
would replay them on demand is a worse thing to leave running than one that will not.

**The browser is a resource, and the limits are the design.** One pairing at a time — a second
`POST /qr` closes the first. Each carries a timer that force-closes it after three minutes whether
or not anybody polls, and `onModuleDestroy` closes whatever is live so `--watch` does not leak a
Chromium per reload. `DELETE` is the polite path, called when the console page unmounts; it is
idempotent, because by then the timer may already have done it.

**The `pin` goes in BEFORE the code comes out**, and that ordering is forced by the site. A newly
linked browser does not meet "enter your PIN" — it meets **Create PIN**, seconds after the scan,
and Sham Cash writes `shamcash-pin-code-hash` only once one is saved. The poll completes that
screen with these digits and then waits for the hash, so the session handed back is complete.
Omitting it still links and still returns the cookies; the answer then says the PIN is outstanding.

Observed on 2026-09-08 before this existed: a linked session with `storageKeys: []`, and the reader
replaying it met a page that rendered nothing — the hash it needed had never been created.
**`pinRequired` does not mean it failed.** The PIN screen appears *after* the cookies are written,
so the session is linked either way. Sham Cash never puts the PIN in a cookie — it is four digits in
the person's head — so the console fills the other four fields and leaves that one to them.

**`strategy` says which selector found the code**, and it is worth reading. The selector list was
written without access to shamcash.sy (the site answers Syrian addresses only), so `page` means the
QR element was not recognised and the image is a screenshot of the whole login page — still
scannable, and the signal that one selector wants correcting. On that fallback the response also
carries `pageHtml`, which is what makes the correction a one-line change rather than a hunt.

#### The linked account — read on demand, from a warm browser

```
GET    /v1/admin/shamcash/account           -> { linked, snapshot: { balances[], transactions[],
                                                                     checkedAt } | null }
POST   /v1/admin/shamcash/account/refresh   -> AccountSnapshot   (503 when nothing is linked)
DELETE /v1/admin/shamcash/account           -> 204
```

The QR link hands its signed-in browser to the account service **instead of closing it**, and that
handover is the whole design. A cold read costs 55-90 seconds, almost all of it shamcash.sy booting
its own single-page app — measured: first visible text at 54.7s. That is paid **once per browser**,
so a page that is already booted re-reads in seconds.

**The cost of each route is the point:**

| | |
| --- | --- |
| `GET /account` | Touches **no browser**. Answers the last snapshot from memory. This is the call every open console makes, and a hundred of them cost nothing. |
| `POST /refresh` | A real read through the warm page. Concurrent callers share **one** page load — fifty people pressing Refresh is one reload, and all fifty get its result. |
| `DELETE /account` | Closes the browser and forgets the numbers. |

**A stale answer is a feature.** `GET` returns the last snapshot with the `checkedAt` it was read at,
whether or not a session is still live — `linked: false` with a snapshot means "the browser closed,
and these were the numbers when it did". A figure that was true ten minutes ago, labelled as ten
minutes old, is worth more than an empty screen, and it is what lets the console paint instantly.

**A read that recognised nothing does not overwrite good numbers.** The page may have been
mid-render, and replacing real balances with an empty list would turn a slow refresh into an account
that looks emptied — the most alarming false statement this screen could make. An empty *first* read
is still reported, because that is a real answer.

**One session per tenant, bounded.** A signed-in Chromium is 300-500MB, so each carries an idle
timer that closes it after 20 minutes with nobody reading, and `onModuleDestroy` closes them all.
The cached snapshot survives the browser closing.

**`refresh` answers 503, not 404**, when nothing is linked or the session lapsed: the route exists
and the request was correct; what is unavailable is the thing behind it. The console turns that into
"link your account again" rather than an error nobody can act on. A lapsed session is closed at that
moment rather than left to be retried.

Gated by `SHAM_CASH_DEV_CHECK` like the routes above, for the same reason: every one of them can end
up driving a browser at a third party.

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

### Statistics — `/v1/admin/stats`

The aggregates behind the queue. `GET /v1/admin/deposits` is a WORK LIST — cursor paginated, no
total, and by default only the three statuses that need a human — so it cannot answer "how did this
month go", and the credited deposits (most of them) never appeared on any screen. These figures are
summed in the database and arrive as one object.

```
GET /v1/admin/stats?period=day|week|month|all           -> TenantStats     (every queue-reading role)
GET /v1/admin/stats/tenants?period=...                  -> PlatformStats   (PLATFORM_ADMIN only)
```

```ts
TenantStats = {
  tenantId, slug, displayName, currency,
  period:   { key, from, to },                       // ISO-8601, UTC, as the SERVER resolved it
  players:  { newInPeriod, total },
  deposits: { opened, credited, rejected, expired, waiting, attention, lifetimeCount },
  withdrawals: { paid, pending },
  profit:   { depositFees, withdrawalFees, total, chargingRails, activeRails },
  byMethod: StatsMethodRow[],                        // credited money per rail, biggest first
}
StatsBlock     = { count, total: MoneyView, basis }
StatsMethodRow = { paymentMethodId, displayName, count, total: MoneyView, fees: MoneyView }
PlatformStats  = { period, tenants: TenantStats[] }  // ACTIVE operators only
```

**`basis` is not decoration.** Three timestamps decide whether a deposit is inside the window, so
the blocks are NOT views of one set and `opened` and `credited` will not add up:

| basis | meaning |
| --- | --- |
| `createdAt` | started in the window, wherever it ended up (`opened`, `expired`) |
| `creditedAt` | money that LANDED in the window — a deposit opened last night and credited this morning belongs to this morning, which is how it reconciles against the Ichancy panel |
| `decidedAt` | the moment a human refused it (`rejected`) |
| `paidAt` | the moment a withdrawal was actually sent |
| `current` | RIGHT NOW, deliberately outside the window — money stuck since last week must not fall out of today's figures (`waiting`, `attention`, `pending`) |

Deposit money is `verifiedAmountMinor ?? claimedAmountMinor` in every block — the same precedence
the admin card, `/queue` and `/report` use. It is deliberately NOT `creditedAmountMinor`
(= verified − fee), so `credited.total` stays comparable with `opened.total`; the fee is reported
separately under `profit`.

**Windows are UTC** and are the same ones the Telegram `/report` message quotes, so the two agree.
`all` reaches back to the epoch. An absent `period` is `month`, the documented default of both.

**`profit` is fees, and a zero is usually a setting.** `feeFixedMinor + feeBps` on a rail is the
only revenue this system models, posted to HOUSE_CASH as a FEE transaction. A rail left at 0/0 —
every rail on a fresh install — collects nothing. `chargingRails` of `activeRails` is what lets a
screen say "none of your rails charges a fee" instead of showing a zero that reads as a loss.
`NotificationCategory.PROFIT` in the schema is a different, still-unbuilt idea (GGR) and must not
be confused with this.

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
                 paymentMethodsCreated, paymentMethodsError, paymentMethodsNeedAccounts,
                 playersImported, playersImportError, ichancyFake }
```

`ichancyFake` (always present) is true under `ICHANCY_FAKE`: `activated` and `playersImported` were
answered by the fake adapter, so the agent's credentials were never proven and any imported players
are made up. `activationError` keeps its meaning (null means activation succeeded) and never carries
the fake notice.

Activation is refused, and `activated: false` with `activationError` "This operator has no staff group
yet, so it cannot be activated…", for every create that names no `adminChatId` — which is the
console's default create. That is expected, not a failure to chase: bind the staff group, then
activate.

`playersImported` / `playersImportError` report the import of the operator's existing Ichancy
players (the "old players"), which runs only after activation succeeded — an operator that did not
activate reports `0` and says why. The console reads both with a fallback (`0` / `null`) so a
backend older than the import still parses.

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

| `reason`          | What it means, and who fixes it                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_URL`     | Not a Telegram group/channel reference. A `t.me/+…` invite link cannot be resolved by a bot at all — pick the group from `GET /v1/admin/telegram/chats` instead. |
| `NOT_FOUND`       | Telegram does not know the chat, or the bot cannot see it                                                                                                        |
| `PRIVATE_CHAT`    | It resolved, but it is a one-to-one chat                                                                                                                         |
| `BOT_NOT_MEMBER`  | Someone must add the bot to the group                                                                                                                            |
| `BOT_NOT_ADMIN`   | A group administrator must promote it                                                                                                                            |
| `BOT_CANNOT_POST` | Channel admin with "Post messages" off — turn the permission on                                                                                                  |
| `DUPLICATE`       | That chat is already an active destination for this operator                                                                                                     |

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

This route follows the console's operator switcher. The operator page's staff and feed group picker
does NOT use it: it reads `GET /v1/admin/tenants/:id/telegram/chats`, which names the operator in the
path, so a platform admin looking at operator X never sees operator Y's groups (see "Staff and feed
groups" under Tenants).

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
