import { HandCoins } from 'lucide-react';

import { EmptyState, ErrorState, PageHeader } from '@/components/common';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { usePaymentMethods } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { railMessages } from './messages';
import { MethodAccountCard } from './method-account-card';
import { UsdtRatePanel } from './usdt-rate-panel';

/**
 * Financial settings — the top-level answer to "where does the money I take actually land?".
 *
 * ── WHY EVERY METHOD IS ON IT ─────────────────────────────────────────────────────────────────
 * This page used to show the two rails whose method CODE was one of the pair this system seeds,
 * which meant it showed nothing at all to the operators it was built for: theirs are called `USDT`
 * and `SHAM`, because a code is a name somebody types. They reported the screen as empty and then
 * asked for the thing it should have been all along — every method, the accounts each one pays
 * into, and an edit control on each. So the list is the methods, unfiltered; the CARD decides what
 * it can truthfully say about each one, from the rail and from the address.
 *
 * Inactive methods are listed too. A method that is off is exactly the one somebody is looking for
 * when they ask why a rail is not on the menu, and hiding it here is how they conclude it was
 * deleted.
 *
 * ── WHY A ROUTE AND NOT A TAB ON THE RAILS SCREEN ─────────────────────────────────────────────
 * Setting the wallet address was reachable, and reachable is not the same as findable: it meant
 * Payment rails, then picking the right one of six methods, then the destinations table, then Add.
 * Four clicks, none of them named after the thing the operator was looking for. They concluded the
 * setting did not exist and asked where it was. A rail is a thing the CONSOLE has; a wallet address
 * is a thing the OPERATOR has, so it gets its own entry in the navigation, under the words they
 * used.
 *
 * ── WHY IT LIVES IN features/payment-methods ──────────────────────────────────────────────────
 * There are no cross-feature imports in this console. Everything this page shows — the methods, the
 * destination form, the rate — is owned here already, so the folder stays the domain and the route
 * is just another surface onto it. A `features/financial/` folder would have to reach across.
 *
 * ── WHY IT IS READ-GATED, NOT WRITE-GATED ─────────────────────────────────────────────────────
 * The route needs `paymentMethods.read`; every control that changes something asks for
 * `paymentMethods.write` on its own. REVIEWER and SUPPORT hold read and not write, and they are
 * exactly who reads the USDT rate off this page while deciding a crypto deposit — a write-gated
 * route would take that away from them.
 */
export function FinancialPage() {
  const t = useT(railMessages);
  const methods = usePaymentMethods();

  const rows = methods.data ?? [];

  return (
    <div className="space-y-6">
      {/* The heading is the nav label, in either language: an operator who clicked "Financial
          settings" has to land somewhere that calls itself that. */}
      <PageHeader title={t('nav.financial')} description={t('financial.page.description')} />

      {methods.isPending ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : methods.error != null ? (
        <ErrorState
          error={methods.error}
          onRetry={() => {
            void methods.refetch();
          }}
        />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="px-0 pb-0">
            <EmptyState
              icon={<HandCoins className="size-5" />}
              title={t('financial.methods.emptyTitle')}
              description={t('financial.methods.emptyBody')}
            />
          </CardContent>
        </Card>
      ) : (
        rows.map((method) => <MethodAccountCard key={method.id} method={method} />)
      )}

      {/* Last, and only here. The rate is one stored value with one write form, and a second copy
          of that form on the rails screen would be a second place to be looking at a stale
          number — see the note on the panel itself. It stays on a page that is no longer only about
          crypto because it prices EVERY crypto rail, whatever its method is called. */}
      <UsdtRatePanel currency={methods.data?.[0]?.currencyCode ?? null} />
    </div>
  );
}
