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
no backend, no database and no Telegram bot. Sign in either way:

- as an **operator**, with the Ichancy agent account `agent_main` / `agent-demo`;
- as the **platform**, with the bot code `111111` — or `123456` for a super admin, and one code per
  role besides, all listed on the sign-in screen.

---

## What it does

| Screen             | For                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Overview**       | What is waiting, what is unclaimed, what is stuck, what the books disagree about    |
| **Deposits**       | The review queue: claim, read the proof, approve or reject, retry a failed credit   |
| **Withdrawals**    | Money going out: approve or reject a cash-out, then record the payout that was sent |
| **Players**        | Find an account while the player is on the phone; register, block or debit it       |
| **Payment rails**  | Methods and the destination accounts players actually send money to                 |
| **Reconciliation** | Breaks, agent-float sync, rail ageing, ledger invariant checks                      |
| **Staff**          | Who may decide money, and the versioned approval limits that bound them             |
| **Tenants**        | Platform administration: create, configure, activate and suspend operators          |
| **Settings**       | Your access, appearance, the API it is pointed at, and its live health              |

---

## How it is built

| Concern      | Choice                           | Why this one                                                                |
| ------------ | -------------------------------- | --------------------------------------------------------------------------- |
| Build        | Vite 8 + React 19 + TypeScript 6 | Strictest settings the toolchain offers; see `tsconfig.json`                |
| Routing      | TanStack Router                  | Typed search params — every filter lives in the URL, not in component state |
| Server state | TanStack Query                   | Cursor/offset pagination, polling on the live queues, prefix invalidation   |
| Tables       | TanStack Table                   | Real `<table>` semantics with column logic that stays out of the markup     |
| Styling      | Tailwind v4 + CSS variables      | One token set, light and dark, no palette colours in components             |
| Components   | Radix primitives                 | Accessible dialogs, menus and selects without reimplementing focus traps    |
| Forms        | react-hook-form + zod            | The same validation rules the backend enforces, stated once                 |
| Tests        | Vitest + Testing Library + MSW   | The mock API is the same one demo mode runs on                              |
| E2E          | Playwright                       | The real bundle, driven end to end, still with no backend required          |

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
npm run test:cov     vitest with coverage (gated at 91% lines / 90% statements / 89% functions / 84% branches)
npm run e2e          Playwright against the built bundle with the mock API
npm run verify       typecheck + lint + coverage — what CI runs
```

---

## Configuration

`.env.local` (copy from `.env.example`):

| Variable                     | Default                       | Meaning                                                                    |
| ---------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`          | `http://localhost:3000`       | The cashier backend. No trailing slash.                                    |
| `VITE_APP_NAME`              | `Cashier Console`             | Shown in the sidebar and the browser title.                                |
| `VITE_ENABLE_MOCKS`          | `false`                       | Boots the in-browser mock API instead of the backend.                      |
| `VITE_TENANT_HEADER_ENABLED` | `false` (`.env` ships `true`) | Sends `X-Tenant-Id`, so one platform login runs every operator. See below. |

The compiled fallback for the last row is `false` and the shipped `.env` files set `true`, and the
difference is deliberate: the backend does carry the tenant claim, so `true` is right — but an
absent variable must fail safe rather than assume it.

### Pointing it at a real backend

1. Start the backend (`npm run dev:api` and `npm run dev:worker` in the cashier repo).
2. Set `VITE_ENABLE_MOCKS=false` and `VITE_API_BASE_URL` to its address.
3. **Add this origin to the backend's CORS allow-list.** The API only answers browsers whose `Origin`
   is in `MINI_APP_ORIGIN`; without it every request fails before it reaches a route.

   > **`http://localhost` and `http://127.0.0.1` are different origins to a browser**, and so are two
   > different ports. Listing one while the address bar holds the other blocks every request, and
   > `fetch` reports it as an unhelpful "could not reach the API" — indistinguishable from a backend
   > that is simply down. List every address you actually open the console from:
   >
   > ```
   > MINI_APP_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
   > ```
   >
   > (5173 is `npm run dev`, 4173 is `npm run preview`.) The console's own error message names the
   > origin your browser is using, so you can paste it straight in.

4. Sign in with a username (or email) and a password — one form, one door. Staff use the console
   credential their super admin set for them; an **operator** may instead use its own Ichancy agent
   username and password — the account its players are registered under — and lands as that
   operator's super admin. See docs/API-CONTRACT.md section 2a.

---

## The operator switcher — closed 2026-08-25

This section used to describe a gap. It is closed, and what follows is the verification rather than
the plan, because the flag it concerns is the one whose whole purpose is to stop the console showing
one operator's money under another's name.

The backend carries the tenant claim end to end:

- the admin access token holds `tid`, the caller's **home** operator, signed at sign-in;
- `tenant-context.middleware.ts` enters that tenant for every request, before any guard;
- `TenantOverrideInterceptor` then lets a `PLATFORM_ADMIN` whose row is in tenant zero point one
  request at a different operator with `X-Tenant-Id` — and **silently ignores the header from
  everybody else**, because answering 403 would turn it into an oracle for which operator ids exist.

Measured against the running API on 2026-08-25, one token, header varied:

| `X-Tenant-Id`             | `GET /v1/admin/players` |
| ------------------------- | ----------------------- |
| absent                    | 3 rows (home operator)  |
| tenant zero               | 3 rows                  |
| another operator          | 1 row                   |
| an id that does not exist | `400 VALIDATION_FAILED` |

That last row matters as much as the others: an unknown operator is refused rather than quietly
served as tenant zero, so a mistyped id costs a confused click instead of a conversation about
numbers that were never real.

So `VITE_TENANT_HEADER_ENABLED=true` is correct, `TenantNotice` is silent, and the switcher is real.
Turn the flag **off** only when pointing this console at a backend older than that claim — there the
header is ignored, every screen answers for tenant zero, and a switcher would be a lie.

The switcher stays hidden from `SUPER_ADMIN` whatever the flag says, because the backend discards
the header from non-platform roles and a choice the server throws away is worse than no choice.

---

## Testing

- **Unit and component tests** run against the same MSW handlers demo mode uses, so a test that
  passes exercises the contract the demo runs on.
- `src/test/utils.tsx` renders inside the real provider tree and a real memory router — `Link`,
  `useSearch` and `useNavigate` behave exactly as they do in the app. Only auth is faked.
- The router resolves routes asynchronously, so the first query in a test is a `findBy*`.
- Coverage is gated in `vitest.config.ts`. Raise it, do not lower it.
- Three files carry their own **per-file** gate — `money.ts`, `concurrency.ts`, `permissions.ts` —
  because the global one cannot do that job. Deleting `money.test.ts` outright, 49 tests, moves the
  global statement number by two tenths of a point; no survivable global threshold notices a single
  file's tests going away, and one tuned tightly enough to try would turn red on every added `if`.

```
npm run test:cov
npm run e2e            # builds, serves, and drives the real bundle
```

---

## Further reading

- `docs/API-CONTRACT.md` — every endpoint, role and payload, read out of the backend's controllers
- `../Telegram-mini-app/README.md` — the backend itself
- `../Telegram-mini-app/plan-multitenant.md` — where multi-tenancy actually stands
