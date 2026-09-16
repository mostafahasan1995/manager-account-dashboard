import { HandCoins } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, PageHeader } from '@/components/common';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import { usePaymentMethods } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { railMessages } from './messages';
import { MethodAccountCard } from './method-account-card';
import { ShamCashApiCard } from './shamcash-api-card';
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
 * A RETIRED method — inactive AND with deposit or ledger history behind it — is reachable, but not
 * shown by default; see the toggle below. Inactive is not enough on its own to hide a card, and
 * that distinction is the whole point: the two USDT rails arrive INACTIVE on every new tenant,
 * because a rail that cannot yet be priced must not be on the bot's menu, and THIS is the screen an
 * operator uses to finish setting one up — enter the wallet, then press Activate. A method still in
 * that state has no history yet; it is not stopped, it is not started, and hiding it here would hide
 * the only place that lets them finish. `deletable` already carries exactly that fact (see
 * PaymentMethodService.deletePermanently on the backend: it is true precisely when nothing has ever
 * moved through the method), so it is reused here rather than inventing a second notion of "new".
 *
 * What stays hidden by default is the other case: MANUAL_CREDIT switched off, or a seeded rail like
 * BANK_TRANSFER_MAIN that took real deposits and was later retired. Those have nothing left to
 * finish, and showing them by default is what made this screen open onto rails nobody can pay
 * through, indistinguishable from the ones that matter. One click away, not the first thing seen.
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
  const [showRetired, setShowRetired] = useState(false);

  const all = methods.data ?? [];
  // Retired, not merely off: no history means there is still a setup step to finish here, and
  // hiding it would hide the one screen that finishes it. See the header for the full argument.
  const isRetired = (method: (typeof all)[number]) => !method.isActive && !method.deletable;
  const retiredCount = all.filter(isRetired).length;
  const rows = showRetired ? all : all.filter((method) => !isRetired(method));

  return (
    <div className="space-y-6">
      {/* The heading is the nav label, in either language: an operator who clicked "Financial
          settings" has to land somewhere that calls itself that. */}
      <PageHeader title={t('nav.financial')} description={t('financial.page.description')} />

      {/* First, not last: an operator looking for "the Sham Cash account" must not have to scroll
          past every payment rail and the rate panel to find it. It is its own thing — the external
          cashier account they watch, not a rail players pay through — so it leads the page. */}
      <ShamCashApiCard />

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
      ) : all.length === 0 ? (
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
        <>
          {rows.map((method) => (
            <MethodAccountCard key={method.id} method={method} />
          ))}

          {/*
            Shown whenever a retired method exists, in BOTH states of the toggle — collapsed, it is
            how an operator finds the thing that is not on the screen; expanded, it is how they put
            it away again. Absent only when there is nothing to fold either way.
          */}
          {retiredCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRetired((current) => !current);
              }}
            >
              {showRetired
                ? t('financial.methods.hideRetired')
                : t('financial.methods.showRetired', { count: retiredCount })}
            </Button>
          ) : null}

          {rows.length === 0 ? (
            // Every method this operator has is retired, and the toggle is off — the state that
            // most needs the count spelled out rather than a blank card list underneath the button.
            <Card>
              <CardContent className="px-0 pb-0">
                <EmptyState
                  icon={<HandCoins className="size-5" />}
                  title={t('financial.methods.allRetiredTitle')}
                  description={t('financial.methods.allRetiredBody')}
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Last, and only here. The rate is one stored value with one write form, and a second copy
          of that form on the rails screen would be a second place to be looking at a stale
          number — see the note on the panel itself. It stays on a page that is no longer only about
          crypto because it prices EVERY crypto rail, whatever its method is called. */}
      <UsdtRatePanel currency={methods.data?.[0]?.currencyCode ?? null} />
    </div>
  );
}
