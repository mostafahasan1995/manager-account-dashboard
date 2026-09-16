import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { paymentMethodSearchSchema } from '@/app/search-schemas';
import { PageHeader } from '@/components/common';
import { Alert } from '@/components/ui';
import { usePaymentMethods } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { PaymentMethodListQuery } from '@/types';

import { DestinationList } from './destination-list';
import { railMessages } from './messages';
import { MethodList } from './method-list';

/**
 * Payment rails.
 *
 * These rows decide where players send real money, so the screen is deliberately slower than it is
 * convenient: nothing is deleted, the two fields that would redirect a payment — a method's code and
 * a destination's account identifier — cannot be edited at all, and every deactivation asks first.
 *
 * The method list and the destination list each own their own actions; this page owns only the one
 * query both need, so a method selected in the top table is the same object the bottom one renders.
 */
export function PaymentMethodsPage() {
  const t = useT(railMessages);
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => paymentMethodSearchSchema.parse(rawSearch), [rawSearch]);

  const query = useMemo<PaymentMethodListQuery>(
    () => ({
      ...(search.rail === undefined ? {} : { rail: search.rail }),
      // No `state` in the URL means the DEFAULT view, and the default is active-only — see
      // paymentMethodStateFilter in search-schemas.ts for why a retired rail must not be the thing
      // an operator sees first. 'all' is the one choice that asks for it anyway; only that value
      // omits the filter.
      ...(search.state === 'all' ? {} : { isActive: search.state !== 'inactive' }),
    }),
    [search.rail, search.state],
  );

  const methods = usePaymentMethods(query);
  const selected = methods.data?.find((method) => method.id === search.selected) ?? null;
  const selectionHidden =
    search.selected !== undefined && methods.data !== undefined && selected === null;

  return (
    <div className="space-y-6">
      {/* The heading is the nav label: an operator who clicked "Payment rails" must land on a page
          that calls itself the same thing, in either language. */}
      <PageHeader title={t('nav.paymentMethods')} description={t('rails.page.description')} />

      <MethodList
        methods={methods.data}
        isLoading={methods.isPending}
        error={methods.error}
        onRetry={() => {
          void methods.refetch();
        }}
      />

      {selectionHidden ? (
        <Alert tone="info" title={t('rails.page.hiddenSelectionTitle')}>
          {t('rails.page.hiddenSelectionBody')}
        </Alert>
      ) : null}

      <DestinationList method={selected} />
    </div>
  );
}
