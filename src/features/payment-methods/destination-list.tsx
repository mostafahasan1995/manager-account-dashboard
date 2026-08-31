import { useNavigate, useSearch } from '@tanstack/react-router';
import { Landmark, Pencil, Plus, PowerOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  paymentMethodSearchSchema,
  pruneSearch,
  type PaymentMethodSearch,
} from '@/app/search-schemas';
import {
  ActiveBadge,
  Can,
  ConfirmDialog,
  CopyableValue,
  EmptyState,
  ErrorState,
  MoneyAmount,
  TableSkeleton,
} from '@/components/common';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useDeactivateDestination, usePaymentDestinations } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { PaymentDestination, PaymentMethod } from '@/types';

import { DestinationFormDialog } from './destination-form-dialog';
import { railMessages } from './messages';
import { optionalRailMoney } from './rail-money';

/**
 * Where the money actually lands for the selected method.
 *
 * Inactive destinations are hidden by default and revealed by a URL flag rather than a local
 * toggle, because "why is the old account still receiving deposits" is a question answered by
 * sending somebody a link to this exact view. The account identifier is monospace with a copy
 * button next to it: it gets read out to players, and typing it back by hand is where the
 * expensive mistakes come from.
 */

export function DestinationList({ method }: { method: PaymentMethod | null }) {
  const t = useT(railMessages);
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => paymentMethodSearchSchema.parse(rawSearch), [rawSearch]);
  const includeInactive = search.includeInactiveDestinations ?? false;

  const destinations = usePaymentDestinations(method?.id, includeInactive);
  const deactivate = useDeactivateDestination();

  const [form, setForm] = useState<{ open: boolean; destination: PaymentDestination | null }>({
    open: false,
    destination: null,
  });
  const [pendingDeactivation, setPendingDeactivation] = useState<PaymentDestination | null>(null);

  const updateSearch = (patch: Partial<PaymentMethodSearch>) => {
    void navigate({ to: '/payment-methods', search: pruneSearch({ ...search, ...patch }) });
  };

  const confirmDeactivation = async () => {
    if (pendingDeactivation === null) return;
    const { id, label } = pendingDeactivation;
    try {
      await deactivate.mutateAsync(id);
      toast.success(t('rails.destination.deactivated', { name: label }), {
        description: t('rails.destination.deactivatedBody'),
      });
      setPendingDeactivation(null);
    } catch (caught) {
      toast.error(t('rails.destination.deactivateFailed', { name: label }), {
        description: errorMessage(caught),
      });
    }
  };

  const rows = destinations.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>
            {method === null
              ? t('rails.destination.title')
              : t('rails.destination.titleFor', { name: method.displayName })}
          </CardTitle>
          <CardDescription>{t('rails.destination.description')}</CardDescription>
          {rows.length === 0 ? null : (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('rails.destination.count', { count: rows.length })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive-destinations"
              checked={includeInactive}
              onCheckedChange={(checked) => {
                updateSearch({ includeInactiveDestinations: checked ? true : undefined });
              }}
            />
            <Label htmlFor="include-inactive-destinations">
              {t('rails.destination.includeInactive')}
            </Label>
          </div>

          {method === null ? null : (
            <Can capability="paymentMethods.write">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setForm({ open: true, destination: null });
                }}
              >
                <Plus className="size-4" />
                {t('rails.destination.add')}
              </Button>
            </Can>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {method === null ? (
          <EmptyState
            icon={<Landmark className="size-5" />}
            title={t('rails.destination.noMethodTitle')}
            description={t('rails.destination.noMethodBody')}
          />
        ) : destinations.isPending ? (
          <TableSkeleton rows={3} columns={5} />
        ) : destinations.error != null ? (
          <ErrorState
            error={destinations.error}
            onRetry={() => {
              void destinations.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Landmark className="size-5" />}
            title={
              includeInactive
                ? t('rails.destination.emptyTitle')
                : t('rails.destination.emptyActiveTitle')
            }
            description={
              includeInactive
                ? t('rails.destination.emptyBody')
                : t('rails.destination.emptyActiveBody')
            }
            action={
              <Can capability="paymentMethods.write">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setForm({ open: true, destination: null });
                  }}
                >
                  <Plus className="size-4" />
                  {t('rails.destination.addFirst')}
                </Button>
              </Can>
            }
          />
        ) : (
          <Table>
            <TableCaption className="sr-only">
              {t('rails.destination.tableCaption', { name: method.displayName })}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="text-end">{t('rails.field.priority')}</TableHead>
                <TableHead>{t('rails.field.label')}</TableHead>
                <TableHead>{t('rails.field.account')}</TableHead>
                <TableHead>{t('rails.field.accountHolder')}</TableHead>
                <TableHead>{t('rails.field.dailyCap')}</TableHead>
                <TableHead>{t('rails.field.notes')}</TableHead>
                <TableHead>{t('rails.field.state')}</TableHead>
                {/* `relative` for the reason spelled out on the method table's actions column: an
                    unpositioned `sr-only` at the far end of a wide table escapes the scroller and
                    sizes the whole page to reach it. */}
                <TableHead className="relative text-end">
                  <span className="sr-only">{t('rails.field.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((destination) => (
                <TableRow key={destination.id}>
                  <TableCell className="tabular text-end">{destination.priority}</TableCell>
                  <TableCell className="font-medium">{destination.label}</TableCell>
                  <TableCell>
                    <CopyableValue value={destination.accountIdentifier} />
                  </TableCell>
                  <TableCell>
                    {destination.accountHolder ?? (
                      <span className="text-[var(--muted-foreground)]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <MoneyAmount
                      money={optionalRailMoney(destination.dailyCap, method.currencyCode)}
                      withCurrency={false}
                    />
                  </TableCell>
                  <TableCell className="max-w-64 text-[var(--muted-foreground)]">
                    {destination.notes ?? '—'}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={destination.isActive} />
                  </TableCell>
                  <TableCell>
                    <Can capability="paymentMethods.write">
                      <div className="flex justify-end gap-1">
                        <Tooltip content={t('common.edit')}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('rails.destination.editTitle', {
                              name: destination.label,
                            })}
                            onClick={() => {
                              setForm({ open: true, destination });
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </Tooltip>
                        {destination.isActive ? (
                          <Tooltip content={t('common.deactivate')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('rails.destination.deactivateAria', {
                                name: destination.label,
                              })}
                              onClick={() => {
                                setPendingDeactivation(destination);
                              }}
                            >
                              <PowerOff className="size-3.5" />
                            </Button>
                          </Tooltip>
                        ) : null}
                      </div>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {method === null ? null : (
        <DestinationFormDialog
          open={form.open}
          onOpenChange={(open) => {
            setForm((previous) => ({ ...previous, open }));
          }}
          method={method}
          destination={form.destination}
        />
      )}

      <ConfirmDialog
        open={pendingDeactivation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivation(null);
        }}
        title={t('rails.destination.confirmTitle', {
          name: pendingDeactivation?.label ?? t('rails.destination.thisDestination'),
        })}
        description={
          <>
            {t('rails.destination.confirmLead')}{' '}
            {/* `dir` isolates the identifier so an Arabic sentence cannot pull the full stop into
                the middle of an account number. */}
            <code dir="ltr" className="font-mono">
              {pendingDeactivation?.accountIdentifier ?? ''}
            </code>
            {'. '}
            {t('rails.destination.confirmRest')}
          </>
        }
        confirmLabel={t('common.deactivate')}
        destructive
        loading={deactivate.isPending}
        onConfirm={confirmDeactivation}
      />
    </Card>
  );
}
