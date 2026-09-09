import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { configureApiClient } from '@/lib/api/client';
import { AuthContext, type AuthState, type SignOutReason } from '@/lib/auth/auth-context';
import { can } from '@/lib/auth/permissions';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/i18n-context';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import type { Locale } from '@/lib/i18n/locales';
import { ThemeProvider } from '@/lib/theme/theme-provider';
import type { AdminSession } from '@/types/admin';
import type { AdminRole } from '@/types/enums';

/**
 * Test rendering helpers.
 *
 * Everything here mirrors the real provider tree rather than stubbing it, so a test that passes
 * proves the component works inside the app — not inside a simplified imitation of it. The one
 * thing that IS faked is auth, because signing in through the bot-code exchange in every test would
 * make each case slower and none of them clearer.
 */

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // No retries and no gc: a test must fail on the first error, immediately, with the real one.
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function createTestSession(role: AdminRole = 'SUPER_ADMIN'): AdminSession {
  return {
    accessToken: 'test-token',
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    admin: {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      telegramUserId: '700000001',
      role,
      displayName: 'Test Admin',
    },
  };
}

export interface AuthOverrides {
  role?: AdminRole;
  isAuthenticated?: boolean;
  isRestoring?: boolean;
  /** Why the last session ended, so the login screen can be tested saying so. */
  signOutReason?: SignOutReason | null;
  signIn?: AuthState['signIn'];
  signOut?: AuthState['signOut'];
  tenantId?: string | null;
}

export function createTestAuth(overrides: AuthOverrides = {}): AuthState {
  const role = overrides.role ?? 'SUPER_ADMIN';
  const isAuthenticated = overrides.isAuthenticated ?? true;
  const session = isAuthenticated ? createTestSession(role) : null;
  const tenantId = overrides.tenantId ?? null;

  return {
    session,
    admin: session?.admin ?? null,
    role: isAuthenticated ? role : null,
    isAuthenticated,
    isRestoring: overrides.isRestoring ?? false,
    signOutReason: overrides.signOutReason ?? null,
    expiresInMs: isAuthenticated ? 60 * 60_000 : 0,
    expiringSoon: false,
    signIn: overrides.signIn ?? (() => Promise.resolve(createTestSession(role))),
    signOut: overrides.signOut ?? (() => undefined),
    can: (capability) => (isAuthenticated ? can(role, capability) : false),
    tenantId,
    setTenantId: () => undefined,
  };
}

export interface RenderOptions {
  auth?: AuthOverrides;
  queryClient?: QueryClient;
  /** Initial URL. Anything the component reads out of the route search lands here. */
  route?: string;
  /** The route path pattern, when the component calls `useSearch({ from })` or `useParams`. */
  routePath?: string;
  /**
   * The same `validateSearch` the real route uses — pass the zod schema straight from
   * '@/app/search-schemas'. Without it the test router hands over raw URL strings and an array
   * filter arrives as `"A,B"`, which is a difference between the test and the app rather than a
   * simplification of it.
   */
  validateSearch?: SearchValidator;
  /** Renders in this language. Arabic also flips the document to `dir="rtl"`. */
  locale?: Locale;
}

/** Either shape a route accepts: a plain function, or a schema (which is what every route uses). */
export type SearchValidator =
  | ((search: Record<string, unknown>) => Record<string, unknown>)
  | { parse: (search: Record<string, unknown>) => unknown };

const toValidator = (
  validator: SearchValidator,
): ((search: Record<string, unknown>) => Record<string, unknown>) =>
  typeof validator === 'function'
    ? validator
    : (search) => validator.parse(search) as Record<string, unknown>;

/** The provider picks its starting language up from storage, exactly as a returning operator does. */
function applyLocale(locale: Locale | undefined): void {
  if (locale === undefined) return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
  auth: AuthState;
  user: ReturnType<typeof userEvent.setup>;
  /** The current location, for asserting that an action navigated somewhere. */
  location: () => string;
}

function Providers({
  children,
  auth,
  queryClient,
}: {
  children: ReactNode;
  auth: AuthState;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthContext value={auth}>
            <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
          </AuthContext>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Renders inside a real memory router, so `Link`, `useSearch` and `useNavigate` behave exactly as
 * they do in the app. Components that read typed search params should pass `routePath`.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderWithProvidersResult {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const auth = createTestAuth(options.auth);
  applyLocale(options.locale);
  const initialEntry = options.route ?? '/';
  const path = options.routePath ?? '/';

  // The token has to reach the API client, or every request in the test goes out unauthenticated.
  configureApiClient({
    getToken: () => auth.session?.accessToken ?? null,
    getTenantId: () => auth.tenantId,
    onUnauthorized: () => undefined,
  });

  const validateSearch =
    options.validateSearch === undefined
      ? (search: Record<string, unknown>) => search
      : toValidator(options.validateSearch);

  const rootRoute = createRootRoute();
  const componentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => ui,
    validateSearch,
  });
  // A catch-all so a navigation away from the tested screen resolves instead of 404-ing the test.
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <div data-testid="navigated-away" />,
    validateSearch: (search: Record<string, unknown>) => search,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([componentRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    defaultPendingMinMs: 0,
  });

  const result = render(
    <Providers auth={auth} queryClient={queryClient}>
      <RouterProvider router={router as never} />
    </Providers>,
  );

  return {
    ...result,
    queryClient,
    auth,
    user: userEvent.setup(),
    location: () => router.state.location.href,
  };
}

/** For components that need no router at all — badges, formatters, forms. */
export function renderPlain(ui: ReactElement, options: RenderOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const auth = createTestAuth(options.auth);
  applyLocale(options.locale);

  configureApiClient({
    getToken: () => auth.session?.accessToken ?? null,
    getTenantId: () => auth.tenantId,
    onUnauthorized: () => undefined,
  });

  return {
    ...render(
      <Providers auth={auth} queryClient={queryClient}>
        {ui}
      </Providers>,
    ),
    queryClient,
    auth,
    user: userEvent.setup(),
  };
}

/** Vitest's fake timers and user-event need to be told about each other. */
export const advancedUser = () =>
  userEvent.setup({
    advanceTimers: (ms) => {
      vi.advanceTimersByTime(ms);
    },
  });
