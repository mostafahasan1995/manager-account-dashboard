# Cashier Console

The operations dashboard for the Ichancy cashier backend — the Telegram mini-app that takes player
deposits and credits them on the Ichancy agent API.

It is the screen a cashier opens at the start of a shift. It answers one question first: **what needs
me right now.** Everything else — players, payment rails, staff authority, reconciliation, tenants —
hangs off that.

```
npm install
cp .env.example .env.local      # already done for you; edit if you have a real backend
npm run dev                     # http://localhost:5173
```

Out of the box `.env.local` runs the console against a **built-in mock API** (MSW), so it works with
no backend, no database and no Telegram bot. Sign in with the code `123456`.

---

## What it does

| Screen             | For                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------- |
| **Overview**       | What is waiting, what is unclaimed, what is stuck, what the books disagree about        |
| **Deposits**       | The review queue: claim, read the proof, approve or reject, retry a failed credit       |
| **Players**        | Find an account while the player is on the phone; create their Ichancy account          |
| **Payment rails**  | Methods and the destination accounts players actually send money to                     |
| **Reconciliation** | Breaks, agent-float sync, rail ageing, ledger invariant checks                          |
| **Staff**          | Who may decide money, and the versioned approval limits that bound them                 |
| **Tenants**        | Platform administration: create, configure, activate and suspend operators              |
| **Settings**       | Your access, appearance, the API it is pointed at, and its live health                  |

---

## How it is built

| Concern       | Choice                          | Why this one                                                              |
| ------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Build         | Vite 8 + React 19 + TypeScript 6 | Strictest settings the toolchain offers; see `tsconfig.json`               |
| Routing       | TanStack Router                 | Typed search params — every filter lives in the URL, not in component state |
| Server state  | TanStack Query                  | Cursor/offset pagination, polling on the live queues, prefix invalidation  |
| Tables        | TanStack Table                  | Real `<table>` semantics with column logic that stays out of the markup    |
| Styling       | Tailwind v4 + CSS variables     | One token set, light and dark, no palette colours in components            |
| Components    | Radix primitives                | Accessible dialogs, menus and selects without reimplementing focus traps   |
| Forms         | react-hook-form + zod           | The same validation rules the backend enforces, stated once                |
| Tests         | Vitest + Testing Library + MSW  | The mock API is the same one demo mode runs on                             |
| E2E           | Playwright                      | The real bundle, driven end to end, still with no backend required         |

### The rules the code follows

1. **Money is never a number.** Amounts are decimal strings and `bigint` minor units, start to
   finish. `src/lib/money.ts` is the only place that parses them, and it round-trips exactly with the
   backend's own helper.
2. **One API client.** `src/lib/api/client.ts` owns the response envelope, the bearer token, the
   correlation id, and turning every failure into one `ApiError`. No screen calls `fetch`.
3. **Roles are mirrored, not invented.** `src/lib/auth/permissions.ts` transcribes the backend's role
   constants. The console hides what a role cannot do; the server still enforces it. Both, not either.
4. **Filters live in the URL.** A reviewer can send a colleague the exact queue they are looking at.
5. **Four states, always.** Every data surface renders loading, error, empty and data explicitly.
6. **Status is a word plus a colour**, never a colour alone.

---

## Layout

```
src/
├── app/           router, providers, query client, URL search schemas
├── components/
│   ├── ui/        Radix-based primitives (button, dialog, table, sheet, …)
│   ├── common/    console vocabulary (MoneyAmount, TimeAgo, StatusBadge, Can, …)
│   └── layout/    the shell: sidebar, topbar, health pill
├── features/      one folder per screen, each with its own tests
├── lib/
│   ├── api/       client, endpoints, query keys, query hooks
│   ├── auth/      session storage, provider, the role table
│   ├── theme/     light / dark / system
│   ├── money.ts   the money rules
│   └── format.ts  the date rules
├── mocks/         the MSW mock API: fixtures, an in-memory db, handlers
├── types/         zod schemas + inferred types mirroring the backend DTOs
└── test/          setup, MSW server, render helpers
```

---

## Commands

```
npm run dev          Vite dev server
npm run build        typecheck, then the production bundle
npm run preview      serve the built bundle
npm run typecheck    tsc --noEmit
npm run lint         eslint (type-aware, strict)
npm run test         vitest, once
npm run test:watch   vitest, watching
npm run test:cov     vitest with coverage (gated at 85% lines / 80% branches)
npm run e2e          Playwright against the built bundle with the mock API
npm run verify       typecheck + lint + coverage — what CI runs
```

---

## Configuration

`.env.local` (copy from `.env.example`):

| Variable                     | Default                 | Meaning                                            |
| ---------------------------- | ----------------------- | -------------------------------------------------- |
| `VITE_API_BASE_URL`          | `http://localhost:3000` | The cashier backend. No trailing slash.            |
| `VITE_APP_NAME`              | `Cashier Console`       | Shown in the sidebar and the browser title.        |
| `VITE_ENABLE_MOCKS`          | `false`                 | Boots the in-browser mock API instead of the backend. |
| `VITE_TENANT_HEADER_ENABLED` | `false`                 | Sends `X-Tenant-Id`. Leave off — see below.        |

### Pointing it at a real backend

1. Start the backend (`npm run dev:api` and `npm run dev:worker` in the cashier repo).
2. Set `VITE_ENABLE_MOCKS=false` and `VITE_API_BASE_URL` to its address.
3. **Add this origin to the backend's CORS allow-list.** The API only answers browsers whose `Origin`
   is in `MINI_APP_ORIGIN`; without it every request fails before it reaches a route. Add
   `http://localhost:5173` for local work.
4. Send `/console` to the tenant's Telegram bot and sign in with the code it replies with.

---

## The tenant gap — please read before enabling the switcher

The backend's multi-tenancy is real for bot traffic, queues and crons: the webhook path token selects
the tenant and a Prisma extension scopes every query.

**HTTP admin requests carry no tenant claim yet.** The access token holds `sub, tgid, role, sid` and
nothing else, and no middleware enters a tenant context for `/v1/admin/*`, so every screen except
Tenants answers for tenant zero. The backend's own `plan-multitenant.md` lists "HTTP tenant claim" as
still open.

So the console says so, in a banner, and ships the switcher behind `VITE_TENANT_HEADER_ENABLED`
(default off). Turning it on before the backend reads the header would produce a console that looks
multi-tenant while quietly showing one tenant's money under another's name.

`docs/API-CONTRACT.md` section 5 lists exactly what the backend needs for this to become real. When
it lands, flipping the flag is the only change needed here.

---

## Testing

- **Unit and component tests** run against the same MSW handlers demo mode uses, so a test that
  passes exercises the contract the demo runs on.
- `src/test/utils.tsx` renders inside the real provider tree and a real memory router — `Link`,
  `useSearch` and `useNavigate` behave exactly as they do in the app. Only auth is faked.
- The router resolves routes asynchronously, so the first query in a test is a `findBy*`.
- Coverage is gated in `vitest.config.ts`. Raise it, do not lower it.

```
npm run test:cov
npm run e2e            # builds, serves, and drives the real bundle
```

---

## Further reading

- `docs/API-CONTRACT.md` — every endpoint, role and payload, read out of the backend's controllers
- `../Telegram-mini-app/README.md` — the backend itself
- `../Telegram-mini-app/plan-multitenant.md` — where multi-tenancy actually stands
