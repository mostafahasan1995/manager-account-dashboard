import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';

import { AppShell } from '@/components/layout/app-shell';
import { homeRouteFor } from '@/components/layout/nav-items';
import { BotConfigPage } from '@/features/bot-config/bot-config-page';
import { LoginPage } from '@/features/auth/login-page';
import { DepositsPage } from '@/features/deposits/deposits-page';
import { NotFoundPage } from '@/features/misc/not-found-page';
import { RouteErrorPage } from '@/features/misc/route-error-page';
import { OverviewPage } from '@/features/overview/overview-page';
import { FinancialPage } from '@/features/payment-methods/financial-page';
import { PlatformFinancePage } from '@/features/platform-finance/platform-finance-page';
import { TelegramPage } from '@/features/telegram/telegram-page';
import { PaymentMethodsPage } from '@/features/payment-methods/payment-methods-page';
import { PlayerDetailPage } from '@/features/players/player-detail-page';
import { PlayersPage } from '@/features/players/players-page';
import { ReconciliationPage } from '@/features/reconciliation/reconciliation-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { ShamCashAccountPage } from '@/features/shamcash-dev/shamcash-account-page';
import { StatsPage } from '@/features/stats/stats-page';
import { StaffDetailPage } from '@/features/staff/staff-detail-page';
import { StaffPage } from '@/features/staff/staff-page';
import { TenantsPage } from '@/features/tenants/tenants-page';
import { WithdrawalsPage } from '@/features/withdrawals/withdrawals-page';
import { config } from '@/config';
import type { AuthState } from '@/lib/auth/auth-context';
import type { Capability } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';

import {
  depositSearchSchema,
  loginSearchSchema,
  paymentMethodSearchSchema,
  playerSearchSchema,
  reconciliationSearchSchema,
  staffSearchSchema,
  statsSearchSchema,
  tenantSearchSchema,
  withdrawalSearchSchema,
} from './search-schemas';

/**
 * Routing, defined in code rather than by file convention.
 *
 * ── WHY EVERY ROUTE IS A DIRECT CHILD OF THE ROOT ─────────────────────────────────────────────
 * The obvious shape is a pathless layout route holding the shell, with every screen nested inside
 * it. TanStack prefixes the ids of a pathless parent's children, so `/deposits` would be addressed
 * as `/protected/deposits` in `useSearch({ from })` while `<Link to>` still said `/deposits`. Two
 * names for one screen is a papercut every single feature file pays, and gets wrong.
 *
 * Flat routes mean the id and the path are the same string everywhere. The chrome is chosen by the
 * root component instead, and the guard is a shared `beforeLoad` each route names.
 *
 * ── WHAT THE GUARDS DO ────────────────────────────────────────────────────────────────────────
 *   authentication  no session -> /login, carrying `redirect=<href>` so signing back in returns
 *                   the operator to the deposit they were reading
 *   authorisation   each route names the capability it needs; a role that lacks it is sent to a
 *                   screen it can actually use rather than shown a wall of 403s
 */

export interface RouterContext {
  auth: AuthState;
}

/**
 * The shell is the chrome for a signed-in operator. The login screen is the one page that must not
 * have it, and a signed-out visitor has nothing to put in it.
 */
function RootLayout() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!isAuthenticated || pathname === '/login') return <Outlet />;
  return <AppShell />;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});

/**
 * Authentication, plus an optional capability. Named by every route that needs a session.
 *
 * `redirect()` is thrown rather than returned — that is TanStack Router's control flow for leaving
 * a route before it loads, and the object it throws is a signal, not an Error.
 */
/* eslint-disable @typescript-eslint/only-throw-error */
function guard(capability?: Capability) {
  return ({ context, location }: { context: RouterContext; location: { href: string } }) => {
    // The stored session has not been read yet; deciding now would bounce a returning operator.
    if (context.auth.isRestoring) return;

    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }

    if (capability !== undefined && !context.auth.can(capability)) {
      throw redirect({ to: homeRouteFor(context.auth.can) });
    }
  };
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    // Already signed in: go straight through rather than flashing the form.
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect ?? homeRouteFor(context.auth.can) });
    }
  },
  component: LoginPage,
});
/* eslint-enable @typescript-eslint/only-throw-error */

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: guard('deposits.read'),
  component: OverviewPage,
});

const depositsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deposits',
  validateSearch: depositSearchSchema,
  beforeLoad: guard('deposits.read'),
  component: DepositsPage,
});

/**
 * The numbers behind the queue: every deposit, not just the ones needing a decision.
 *
 * Guarded on `deposits.read`, the same capability as the queue itself, because that is exactly
 * what it reports on: everyone who can already page through every row one at a time may read their
 * totals. The cross-operator table inside asks for `platformFinance.read` separately and simply
 * does not mount without it, so no request goes out that the backend would answer with a 403.
 */
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  validateSearch: statsSearchSchema,
  beforeLoad: guard('deposits.read'),
  component: StatsPage,
});

/**
 * The withdrawal queue: money going OUT. Guarded on READ, exactly as the deposit queue is — support
 * answers "where is my money" off this screen without being able to move any; the decide controls
 * inside ask for `withdrawals.decide` one by one.
 */
const withdrawalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/withdrawals',
  validateSearch: withdrawalSearchSchema,
  beforeLoad: guard('withdrawals.read'),
  component: WithdrawalsPage,
});

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  validateSearch: playerSearchSchema,
  beforeLoad: guard('players.read'),
  component: PlayersPage,
});

const playerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players/$playerId',
  beforeLoad: guard('players.read'),
  component: PlayerDetailPage,
});

const paymentMethodsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payment-methods',
  validateSearch: paymentMethodSearchSchema,
  beforeLoad: guard('paymentMethods.read'),
  component: PaymentMethodsPage,
});

/**
 * The wallet addresses and the USDT rate, on their own route because that is what an operator goes
 * looking for. READ, not write: a REVIEWER reads the rate off this page while deciding a crypto
 * deposit, and each write control inside asks for the write capability separately.
 */
const financialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/financial',
  beforeLoad: guard('paymentMethods.read'),
  component: FinancialPage,
});

const reconciliationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reconciliation',
  validateSearch: reconciliationSearchSchema,
  beforeLoad: guard('reconciliation.read'),
  component: ReconciliationPage,
});

const staffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/staff',
  validateSearch: staffSearchSchema,
  beforeLoad: guard('admins.read'),
  component: StaffPage,
});

const staffDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/staff/$adminId',
  beforeLoad: guard('admins.read'),
  component: StaffDetailPage,
});

const tenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tenants',
  validateSearch: tenantSearchSchema,
  beforeLoad: guard('tenants.manage'),
  component: TenantsPage,
});

/** Every operator's finance balances, on one platform screen. PLATFORM_ADMIN only. */
const platformFinanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/platform-finance',
  beforeLoad: guard('platformFinance.read'),
  component: PlatformFinancePage,
});

/**
 * Where the operator's bot publishes.
 *
 * Guarded on READ, not write: support and finance need to be able to answer "which group did that
 * card go to?" without being able to repoint anything. The write controls inside are gated one by
 * one, the same arrangement the rails screen uses.
 */
const telegramRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/telegram',
  beforeLoad: guard('telegramDestinations.read'),
  component: TelegramPage,
});

/**
 * How the operator's own bot looks to a player.
 *
 * Guarded on WRITE, unlike the destinations screen next door, and the difference is the audience
 * rather than the danger: this screen answers "what does my bot say", which is a question the
 * person who owns the bot asks. It reuses `telegramDestinations.write` because that capability
 * already means exactly that — SUPER_ADMIN and PLATFORM_ADMIN — and inventing a second one would be
 * four coupled edits (the capability tuple, the per-role grants, the labels and their translations)
 * to describe the same set of people.
 */
const botConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bot-config',
  beforeLoad: guard('telegramDestinations.write'),
  component: BotConfigPage,
});

/**
 * THE SHAM CASH DEVELOPER BENCH. Registered only when `VITE_ENABLE_SHAMCASH_DEV` is on.
 *
 * ── WHY THE FLAG REMOVES THE ROUTE RATHER THAN HIDING THE LINK ────────────────────────────────
 * A hidden link is still a reachable URL. This screen takes a live Sham Cash cashier session in a
 * form, so on a console where the feature is off it must not exist at all — an operator who types
 * /dev/shamcash gets the not-found page, exactly as they would for any other address.
 *
 * ── WHY IT IS GUARDED ON `tenants.manage` ────────────────────────────────────────────────────
 * The API takes SUPER_ADMIN or PLATFORM_ADMIN. There is no console capability that names exactly
 * that pair, and inventing one would be four coupled edits to describe a set that already exists.
 * `tenants.manage` is the closest capability the console holds and it errs the safe way — it is
 * PLATFORM_ADMIN only, so the route is narrower than the endpoint rather than wider. A SUPER_ADMIN
 * who needs the bench turns the flag on and calls the endpoint directly, which is the sort of thing
 * somebody debugging the browser reader is already doing.
 */
const shamCashDevRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/shamcash',
  beforeLoad: guard('tenants.manage'),
  component: ShamCashAccountPage,
});

/** Every role can open its own settings, so this one needs a session and nothing more. */
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: guard(),
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  overviewRoute,
  depositsRoute,
  statsRoute,
  withdrawalsRoute,
  playersRoute,
  playerDetailRoute,
  paymentMethodsRoute,
  financialRoute,
  reconciliationRoute,
  staffRoute,
  staffDetailRoute,
  tenantsRoute,
  platformFinanceRoute,
  telegramRoute,
  botConfigRoute,
  settingsRoute,
  // Spread, not appended: with the flag off there is no route, so the URL 404s like any other.
  ...(config.shamCashDevEnabled ? [shamCashDevRoute] : []),
]);

export function createAppRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: RouteErrorPage,
    // The console is opened when something is wrong; a stale filter beats a blank screen.
    defaultPendingMinMs: 0,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
