# Adding and running an operator (tenant)

What actually happens under the hood, what the console has to offer, and the three things in the
backend that have to change for a second operator to work at all.

---

## 1. Creating one does NOT create a Telegram bot

`POST /v1/admin/tenants` does five things, in this order:

1. Refuses a `slug` that is taken (globally unique).
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
{ url: string; registered: boolean; pendingUpdateCount: number;
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

---

## 7. The loop this gives you, with one Telegram account

1. **@BotFather** → `/newbot` → copy the token.
2. Console → Operators → **New operator**: slug, name, that bot token, your own chat id as the admin
   chat, the Ichancy base URL / username / password / agent id, currency, thresholds. It lands
   **suspended**.
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
