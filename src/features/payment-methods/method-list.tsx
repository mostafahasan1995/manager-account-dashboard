import { useNavigate, useSearch } from '@tanstack/react-router';
import { Pencil, Plus, PowerOff } from 'lucide-react';
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
  EmptyState,
  ErrorState,
  MoneyAmount,
  TableSkeleton,
} from '@/components/common';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { useDeactivatePaymentMethod } from '@/lib/api/queries';
import { formatBps } from '@/lib/format';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { isZeroDecimal } from '@/lib/money';
import type { PaymentMethod } from '@/types';
import { PAYMENT_RAILS } from '@/types/enums';

import { railMessages } from './messages';
import { MethodFormDialog } from './method-form-dialog';
import { railMoney } from './rail-money';

/**
 * The rails themselves: what a player is offered, and the numbers every deposit through them is
 * checked against.
 *
 * Selecting a row is a URL change rather than component state, so "look at the wallet rail's
 * accounts" is a link somebody can paste into a chat. Changing a filter clears that selection on
 * purpose: a method the new filter hides would otherwise leave the destination panel below
 * describing a rail that is no longer anywhere on the screen.
 */

const ALL = 'all';

function activeFilterOf(value: string): boolean | undefined {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return undefined;
}

export function MethodList({
  methods,
  isLoading,
  error,
  onRetry,
}: {
  methods: readonly PaymentMethod[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useT(railMessages);
  const enumLabel = useEnumLabel();
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => paymentMethodSearchSchema.parse(rawSearch), [rawSearch]);

  const [form, setForm] = useState<{ open: boolean; method: PaymentMethod | null }>({
    open: false,
    method: null,
  });
  const [pendingDeactivation, setPendingDeactivation] = useState<PaymentMethod | null>(null);
  const deactivate = useDeactivatePaymentMethod();

  const updateSearch = (patch: Partial<PaymentMethodSearch>) => {
    void navigate({ to: '/payment-methods', search: pruneSearch({ ...search, ...patch }) });
  };

  const hasFilters = search.rail !== undefined || search.isActive !== undefined;
  const rows = methods ?? [];

  const confirmDeactivation = async () => {
    if (pendingDeactivation === null) return;
    const { id, displayName } = pendingDeactivation;
    try {
      await deactivate.mutateAsync(id);
      toast.success(t('rails.method.deactivated', { name: displayName }), {
        description: t('rails.method.deactivatedBody'),
      });
      setPendingDeactivation(null);
    } catch (caught) {
      // The dialog stays open: the operator asked for this and it did not happen.
      toast.error(t('rails.method.deactivateFailed', { name: displayName }), {
        description: errorMessage(caught),
      });
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="method-rail-filter">{t('rails.field.rail')}</Label>
            <Select
              value={search.rail ?? ALL}
              onValueChange={(value) => {
                updateSearch({
                  rail: PAYMENT_RAILS.find((rail) => rail === value),
                  selected: undefined,
                });
              }}
            >
              <SelectTrigger
                id="method-rail-filter"
                aria-label={t('rails.field.rail')}
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('rails.filter.allRails')}</SelectItem>
                {PAYMENT_RAILS.map((rail) => (
                  <SelectItem key={rail} value={rail}>
                    {enumLabel('paymentRail', rail)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="method-active-filter">{t('rails.field.state')}</Label>
            <Select
              value={search.isActive === undefined ? ALL : search.isActive ? 'active' : 'inactive'}
              onValueChange={(value) => {
                updateSearch({ isActive: activeFilterOf(value), selected: undefined });
              }}
            >
              <SelectTrigger
                id="method-active-filter"
                aria-label={t('rails.field.state')}
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('rails.filter.anyState')}</SelectItem>
                <SelectItem value="active">{t('rails.filter.activeOnly')}</SelectItem>
                <SelectItem value="inactive">{t('rails.filter.inactiveOnly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                updateSearch({ rail: undefined, isActive: undefined, selected: undefined });
              }}
            >
              {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>

        <Can capability="paymentMethods.write">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setForm({ open: true, method: null });
            }}
          >
            <Plus className="size-4" />
            {t('rails.method.new')}
          </Button>
        </Can>
      </div>

      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : error != null ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? t('rails.method.emptyFilteredTitle') : t('rails.method.emptyTitle')}
            description={
              hasFilters ? t('rails.method.emptyFilteredBody') : t('rails.method.emptyBody')
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    updateSearch({ rail: undefined, isActive: undefined, selected: undefined });
                  }}
                >
                  {t('rails.method.showAll')}
                </Button>
              ) : (
                <Can capability="paymentMethods.write">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setForm({ open: true, method: null });
                    }}
                  >
                    <Plus className="size-4" />
                    {t('rails.method.addFirst')}
                  </Button>
                </Can>
              )
            }
          />
        ) : (
          <Table>
            <TableCaption className="sr-only">{t('rails.method.tableCaption')}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{t('rails.field.code')}</TableHead>
                <TableHead>{t('rails.field.method')}</TableHead>
                <TableHead>{t('rails.field.rail')}</TableHead>
                <TableHead>{t('field.currency')}</TableHead>
                <TableHead>{t('rails.field.verification')}</TableHead>
                <TableHead>{t('rails.field.limits')}</TableHead>
                <TableHead>{t('rails.field.fee')}</TableHead>
                <TableHead>{t('rails.field.reference')}</TableHead>
                <TableHead>{t('rails.field.state')}</TableHead>
                <TableHead className="text-end">{t('rails.field.order')}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t('rails.field.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((method) => {
                const selected = method.id === search.selected;
                const free = method.feeBps === 0 && isZeroDecimal(method.feeFixed);
                return (
                  <TableRow key={method.id} {...(selected ? { 'data-state': 'selected' } : {})}>
                    <TableCell>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          updateSearch({ selected: selected ? undefined : method.id });
                        }}
                        className="rounded font-mono text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      >
                        {method.code}
                        <span className="sr-only">{t('rails.method.showDestinations')}</span>
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{method.displayName}</TableCell>
                    <TableCell>{enumLabel('paymentRail', method.rail)}</TableCell>
                    <TableCell className="font-mono text-xs">{method.currencyCode}</TableCell>
                    <TableCell>
                      <Tooltip content={t(`rails.verification.${method.verificationMode}`)}>
                        <span className="cursor-help underline decoration-dotted underline-offset-4">
                          {enumLabel('verificationMode', method.verificationMode)}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <span className="tabular whitespace-nowrap">
                        <MoneyAmount
                          money={railMoney(method.minAmount, method.currencyCode)}
                          withCurrency={false}
                        />
                        {` ${t('rails.limits.to')} `}
                        <MoneyAmount
                          money={railMoney(method.maxAmount, method.currencyCode)}
                          withCurrency={false}
                        />
                      </span>
                    </TableCell>
                    <TableCell>
                      {free ? (
                        <span className="text-[var(--muted-foreground)]">
                          {t('rails.fee.none')}
                        </span>
                      ) : (
                        // No `dir` override: the bidi algorithm already puts the fixed fee first in
                        // reading order in both languages, and pinning it to LTR would reverse the
                        // two operands for an Arabic reader.
                        <span className="tabular whitespace-nowrap">
                          <MoneyAmount
                            money={railMoney(method.feeFixed, method.currencyCode)}
                            withCurrency={false}
                          />
                          {` + ${formatBps(method.feeBps)}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {method.requiresReference ? (
                        <Badge tone="info">{t('rails.reference.required')}</Badge>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">
                          {t('rails.reference.notRequired')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge isActive={method.isActive} />
                    </TableCell>
                    <TableCell className="tabular text-end">{method.sortOrder}</TableCell>
                    <TableCell>
                      <Can capability="paymentMethods.write">
                        <div className="flex justify-end gap-1">
                          <Tooltip content={t('common.edit')}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('rails.method.editTitle', {
                                name: method.displayName,
                              })}
                              onClick={() => {
                                setForm({ open: true, method });
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </Tooltip>
                          {method.isActive ? (
                            <Tooltip content={t('common.deactivate')}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={t('rails.method.deactivateAria', {
                                  name: method.displayName,
                                })}
                                onClick={() => {
                                  setPendingDeactivation(method);
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
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <MethodFormDialog
        open={form.open}
        onOpenChange={(open) => {
          setForm((previous) => ({ ...previous, open }));
        }}
        method={form.method}
        onSaved={(saved) => {
          updateSearch({ selected: saved.id });
        }}
      />

      <ConfirmDialog
        open={pendingDeactivation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivation(null);
        }}
        title={t('rails.method.confirmTitle', {
          name: pendingDeactivation?.displayName ?? t('rails.method.thisMethod'),
        })}
        description={t('rails.method.confirmBody')}
        confirmLabel={t('common.deactivate')}
        destructive
        loading={deactivate.isPending}
        onConfirm={confirmDeactivation}
      />
    </Card>
  );
}
