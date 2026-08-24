# Adding and running an operator (tenant)

What actually happens under the hood, what the console offers, and the state of the backend work.

> **Status, 2026-08-22.** Sections 3, 4 (rows 1–2) and 5 described things that were broken; all of
> them are now fixed and covered by tests. The Ichancy session is keyed by agent identity, proof
> downloads use the operator's own bot token, the adapter reads the operator's currency, and the six
> endpoints in section 6 exist. What is still open is listed in section 8.

---

## 1. Creating one does NOT create a Telegram bot

`POST /v1/admin/tenants` does five things, in this order:

1. Resolves the optional half of the request. Only four fields are required — `displayName`,
   `botToken`, `ichancyUsername`, `ichancyPassword` — and everything else comes from the
   **PlatformDefaults** settings row, from the caller (`adminChatId`), or from the display name
   (`slug`, slugified and de-duplicated with `-2`, `-3`, …). A slug the caller *chose* is still
   refused when it is taken; a derived one cannot collide. `ichancyAgentId` falls back
   PlatformDefaults → tenant zero → **400 naming the field**: Ichancy `signin()` returns only a
   token pair, so it cannot be looked up from the credentials.
2. **Verifies the bot token you supplied** with a real `getMe()`, and records the `@username`. A bad
   token never reaches the database.
3. Seals the bot token and the Ichancy password (`sealBotToken` / `sealIchancyPassword`, keyed off
   `JWT_SECRET`). Neither is ever returned by the API again.
4. Generates a **webhook path token** (32 CSPRNG bytes) and a **webhook secret** (24). Never
   supplied by the caller — that path segment is the only thing separating one operator's Telegram
   updates from another's.
5. Writes the row **SUSPENDED**.

You create the bot yourself in **@BotFather**. Ledger accounts are not seeded; they are created on
first use by `AccountRegistryService`.

`POST /v1/admin/tenants/:id/activate` is the second, deliberate step: it performs a **real Ichancy
`signin`** with that operator's credentials and refuses to activate if the agent does not answer.

---

## 2. One Telegram account is enough

Two different things get conflated here.

**Bots** — each operator needs its **own bot**, because Telegram permits exactly **one webhook URL
per bot**. One Telegram account can create roughly 20 bots in BotFather, so one account is not a
limit on how many operators you can run.

**People** — the same Telegram account can be an admin *and* a player in **every** operator. The
schema says so deliberately:

```prisma
/// Staff are per-tenant: the same person may be an admin for two tenants under one Telegram
/// account, and must never see the other tenant through either row.
@@unique([tenantId, telegramUserId])
```

`Player` carries the same constraint for the same reason. So one phone number can be `SUPER_ADMIN`
of operator A and of operator B, with separate rows, separate approval limits and separate sessions:
`/console` to bot A returns a token scoped to A, `/console` to bot B one scoped to B.

**Not unique across operators**, which is useful for testing and wrong in production:
`ichancyAgentId`, `adminChatId`, `feedChatId`. Nothing stops two operators pointing at the same
Ichancy agent or the same Telegram group.

---

## 3. Sharing one Ichancy account across operators — the part that bites

Ichancy issues **one token pair per agent account**, and the README states the consequence plainly:

> Signing in again **kills the previous tokens**. So if two processes sign in, they knock each other
> out, and deposits start failing.

The session is currently keyed by **tenant**:

```ts
export const ichancyTokensKey = (tenantId: string) => `ichancy:session:v1:${tenantId}:tokens`;
export const ichancySessionLockKey = (tenantId: string) => `lock:ichancy:session:${tenantId}`;
```

So two operators configured with the **same Ichancy username** each keep their own token pair and
their own lock — while Ichancy only has one. Operator A signs in; operator B signs in and kills A's
tokens; A gets a 401, refreshes, and kills B's. The two thrash indefinitely and deposits fail
intermittently on both, with nothing in the logs naming the cause.

**The fix, which is also what makes sharing work:** key the session by the AGENT IDENTITY rather
than by the tenant.

```ts
const agentKey = sha256(`${ichancyBaseUrl}|${ichancyUsername}`).slice(0, 32);
ichancy:session:v2:<agentKey>:tokens
lock:ichancy:session:<agentKey>
```

Two operators sharing an agent then share one session and one lock, which is exactly right — Ichancy
has one session for that agent. Operators with distinct credentials stay as isolated as they are
now. The password never appears in a key.

The in-process single-flight memo has to be keyed the same way, for the same reason.

---

## 4. Three more places still assume one operator

Verified by reading the code, not inferred:

| Where | What it does today | Why it breaks operator #2 |
| --- | --- | --- |
| `core/file/telegram-file.service.ts` | Downloads a deposit proof with the **global** `config.telegram.botToken` | Telegram `file_id`s are **bot-scoped**. A receipt uploaded to operator B's bot cannot be fetched with operator A's token — every proof on B fails to ingest. This is on the money path. |
| `core/ichancy/http-ichancy.adapter.ts` | Reads `config.ichancy.currency` for wallet lookup and amounts | An operator running a currency other than the env's reads the wrong wallet. Harmless while everything is NSP; wrong the moment it is not. |
| `core/auth/services/init-data.service.ts` | Validates mini-app `initData` against the **global** bot token | Operator B's mini-app players cannot authenticate. Known and documented; needs a tenant hint on an unauthenticated request, so it is its own design. |

Everything else that reads `config.ichancy.*` is a **deployment** concern, not an operator one —
transport mode, timeouts, headless browser, harvested cookie, user agent. Those belong in `.env` and
should stay there.

---

## 5. The gap that stops you today

**There is no per-operator webhook registration.**

`npm run webhook:set` reads `TELEGRAM_*` from `.env` and points **tenant zero's** bot at this
deployment. `tenant:bootstrap` likewise only fills tenant zero. Nothing tells Telegram about the
path token generated for a new operator.

So an operator created through the API has a webhook path in the database that Telegram has never
heard of. Its bot receives nothing, `/console` to it does nothing, and nobody can sign into it.

`POST /v1/admin/tenants/:id/webhook` and `/bot-setup` are both listed in `plan-multitenant.md` §5 and
neither was built — §13's "as built" list quietly drops them.

---

## 6. The endpoints this needs

```
POST   /v1/admin/tenants/:id/webhook     register this operator's webhook with Telegram
DELETE /v1/admin/tenants/:id/webhook     unregister it (stops delivery without suspending)
POST   /v1/admin/tenants/:id/bot-setup   push the command menus to its bot
GET    /v1/admin/tenants/:id/health      bot, webhook, Ichancy agent, float — one call
PATCH  /v1/admin/tenants/:id/ichancy     change base URL / username / password / agent id
PATCH  /v1/admin/tenants/:id/bot         replace the bot token
```

All `PLATFORM_ADMIN`. Shapes:

```ts
// POST/DELETE /webhook
// `url` is NULLABLE: DELETE has no URL to report, and rendering an empty string would read as
// "delivery is still configured", which is the one thing this screen exists to say clearly.
{ url: string | null; registered: boolean; pendingUpdateCount: number;
  lastErrorMessage: string | null; lastErrorDate: string | null }

// POST /bot-setup
{ commandsSet: number; scopes: string[] }

// GET /health
{
  bot: { ok: boolean; username: string | null; webhookUrl: string | null;
         webhookMatches: boolean; pendingUpdateCount: number;
         lastErrorMessage: string | null; lastErrorDate: string | null },
  ichancy: { ok: boolean; baseUrl: string; username: string; agentId: string;
             checkedAt: string; error: string | null;
             floatMinor: string | null; belowWatermark: boolean;
             // Operators sharing this agent — they share one Ichancy session. See section 3.
             sharesAgentWith: string[] },
  counts: { players: number; deposits: number },
}
```

`PATCH /ichancy` re-verifies with a real `signin` before saving, and **refuses to change
`ichancyAgentId` once the operator has linked players** — repointing an agent under existing players
orphans them from the tree their balances live in. `PATCH /bot` verifies with `getMe` and, because
the bot changed, invalidates the cached bot and asks for the webhook to be registered again.

**Both PATCHes answer the full `TenantView`**, the same as `PATCH /v1/admin/tenants/:id`, so a screen
can refresh its row straight from the response.

### Six details settled while building the console half

These were ambiguous above and are now decided. The console is built against them.

1. **`sharesAgentWith` holds SLUGS**, of the other operators only (never the operator itself), matched
   on `ichancyBaseUrl + '|' + ichancyUsername` — **not** on `ichancyAgentId`. That is the trap: two
   operators signing in with one login but carrying different agent ids still share one Ichancy
   session, because the session belongs to the login.
2. **`bot.ok`** means the bot username is known **and** `webhookMatches` **and** there is no last
   delivery error. A webhook that is registered but points at another deployment is `ok: false` —
   which is the entire reason `webhookMatches` exists rather than a bare `registered` boolean.
3. **`floatMinor` is `null` when the sign-in failed**, and `belowWatermark` is then `false`. A `false`
   there means "no comparison was possible", never "healthy". Do not let a screen read it as the
   latter.
4. **The agent-id refusal is `TENANT_AGENT_HAS_PLAYERS`, 422**, with `details: { players: number }`
   so the dialog can say how many players would be orphaned.
5. **A bad bot token is `VALIDATION_FAILED`, 400**, with the message in `details.fields[]`, matching
   every other validation failure in the API.
6. **`hasWebhookPath` on `TenantView` is not delivery status.** It only says a path token exists,
   which is true for a brand-new operator Telegram has never heard of. Delivery is
   `health.bot.webhookMatches`, always.

---

## 7. The loop this gives you, with one Telegram account

### First: you need a PLATFORM_ADMIN, and the seed does not make one

Everything below is on the Operators screen, and that screen is `PLATFORM_ADMIN` only. Nothing in
the normal setup path produces one: `prisma/seed/admin.seed.ts` seeds a `SUPER_ADMIN`, and
`POST /v1/admin/admins` refuses to grant `PLATFORM_ADMIN` unless the caller already holds it. A
fresh install therefore has no platform admin and no way to reach one from inside the product — the
console correctly hides Operators from every role that exists, which reads as a missing feature.

```
npm run admin:platform                        # list tenant zero's staff
npm run admin:platform -- <telegram-id>        # make that account a PLATFORM_ADMIN
```

**One Telegram account cannot hold both roles in tenant zero.** `admin_users` is keyed on
`(tenant_id, telegram_user_id)`, so promoting REPLACES `SUPER_ADMIN` rather than adding to it, and
`prisma/sql/006` forbids a `PLATFORM_ADMIN` row anywhere but tenant zero. With one Telegram account
the shape is:

| Tenant | Role | What you do there |
| --- | --- | --- |
| tenant zero | `PLATFORM_ADMIN` | create, configure, activate and suspend operators |
| each operator | `SUPER_ADMIN` | everything about that operator's money |

which is the intended shape of a platform, not a workaround. `npm run seed` puts the role back.

When the account is tenant zero's last active `SUPER_ADMIN` the script refuses and asks for the
promotion to be spelled out, because it leaves nobody there able to decide a deposit:

```
npm run admin:platform -- <telegram-id> --replace-super-admin
```

> **In PowerShell, quote the separator: `'--'`.** PowerShell 5.1 consumes a bare `--` itself, so npm
> never receives it and keeps everything after it as its own configuration. Measured on npm 10.9.0:
>
> ```
> npm run admin:platform -- 912911246 --replace-super-admin    ->  argv ["912911246"]
> npm run admin:platform '--' 912911246 --replace-super-admin  ->  argv ["912911246","--replace-super-admin"]
> ```
>
> The flag's NAME is irrelevant — `--force`, `--yes` and a bespoke name are all lost identically,
> and Git Bash and cmd.exe pass all of them through. The first version of this guard used `--force`,
> which made the failure look like npm claiming its own config (npm warns loudly about that one) and
> sent the diagnosis in the wrong direction.
>
> `admin:platform` therefore also accepts the confirmation from `npm_config_replace_super_admin`,
> which npm sets from the stripped flag. That key exists only because the flag was typed on that
> invocation, so it is still an act of consent — unlike `npm_config_force`, which any `~/.npmrc` may
> carry and which is deliberately **not** accepted.

### Then, per operator

1. **@BotFather** → `/newbot` → copy the token.
2. Console → Operators → **New operator**: a name, that bot token, the Ichancy username and
   password. That is the whole form — the slug comes from the name, the admin chat from your own
   Telegram id, and the base URL, agent id, currency, thresholds and expiry from the platform
   defaults. "Advanced" holds all of those for the operator that has to differ, each labelled with
   what it gets when left blank. It lands **suspended**.
3. **Register webhook** — Telegram now delivers that bot's updates to this deployment.
4. **Push command menus** so `/console` and `/start` appear in the bot.
5. **Add me as an admin here** — creates a `SUPER_ADMIN` row for your own Telegram id inside the new
   operator. Possible because staff are unique per tenant, not globally.
6. **Activate** — verifies the Ichancy agent with a real signin, then the operator is serving.
7. `/console` to the **new** bot → a code scoped to that operator → sign in and you are its
   `SUPER_ADMIN`, with its own queue, its own staff and its own books.

For testing you may point several operators at the same Ichancy agent. Once section 3's change is
in, they will share one session correctly; the console shows which operators share an agent so the
coupling is never a surprise.

---

## 8. What is still open

Everything above is done. These are not, and each is named rather than left to be rediscovered.

**The Cloudflare and cookie layer is still process-global while the URL is per operator.**
`IchancyCookieStore` uses a single key `ichancy:cookies:v1`; `FetchIchancyTransport` keeps a
process-wide in-memory cookie jar seeded once from `ICHANCY_COOKIE` and derives `Origin`/`Referer`
from `config.ichancy.baseUrl` — the env value, not the operator's row; `BrowserIchancyTransport`
parks one Chromium on the env origin behind an unkeyed memo; `CookieHarvesterService.inFlight` is
likewise unkeyed.

Harmless **while every operator shares one Ichancy host**, which is the case today. But
`TenantIchancyConfigService` deliberately reads `baseUrl` per operator, on the stated grounds that
"a tenant on a different Ichancy deployment must not be sent to this one's" — so the design
contradicts itself. Point one operator at a second Ichancy host and its calls carry the first
operator's `PHPSESSID`/`__cf_bm` and announce the wrong origin. The fix is the same shape as the
session fix: key the cookie state by ORIGIN, because a cookie belongs to a host.

**`loginWithInitData` is still tenant zero.** The mini-app's `initData` is HMAC'd with the
operator's bot token, so choosing an operator for an *unauthenticated* request is a separate design
with its own threat model. A second operator's mini-app players cannot sign in until it is done;
its Telegram bot players can.

**`POST /v1/auth/refresh` is still tenant zero.** It carries no bearer token, so the middleware
cannot know the operator, and `playerSession.findUnique` is scoped by the Prisma extension. A second
operator's player who signs in with a bot code gets a session that path cannot rotate. Nothing
regressed — such a player could not sign in at all before — but it is a gap, and it is the same
unauthenticated-request problem as `initData`.

**RLS.** Postgres row-level security is the backstop that would make all of the above correct even
when the code is wrong, including raw SQL. Stage 5 of `plan-multitenant.md`, still unstarted. The
Prisma extension plus the raw-SQL guard spec are what stand in for it today.
