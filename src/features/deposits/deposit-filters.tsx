import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode, type SyntheticEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import {
  ATTENTION_DEPOSIT_STATUSES,
  DEPOSIT_SORTS,
  DEPOSIT_STATUSES,
  REVIEWABLE_DEPOSIT_STATUSES,
  type DepositStatus,
} from '@/types/enums';

import { hasActiveFilters, hasAdvancedFilters, isPlainAmount, sameStatusSet, toDayInput } from './deposit-model';
import { useDepositNavigation, useDepositSearch } from './deposit-url';
import { depositMessages } from './messages';

/**
 * The queue's filters, which live in the URL and nowhere else.
 *
 * Two things worth knowing before editing this. The text and range inputs are UNCONTROLLED, seeded
 * from the URL and committed on submit: a filter that rewrote the URL on every keystroke would bury
 * the back button and refetch the queue eight times while somebody typed a reference. The discrete
 * controls — the chips, the status boxes, the sort — commit immediately, because each of those
 * clicks is already a whole decision.
 */
export function DepositFilters() {
  const search = useDepositSearch();
  const { setSearch, clearFilters } = useDepositNavigation(search);
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();

  // The URL decides whether the extra filters are showing, until the reviewer says otherwise: a
  // link that carries an amount range has to arrive with that range visible.
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);
  const showAdvanced = manuallyToggled ?? hasAdvancedFilters(search);

  const [amountErrors, setAmountErrors] = useState<{ min: string | null; max: string | null }>({
    min: null,
    max: null,
  });

  const selectedStatuses: readonly DepositStatus[] = search.status ?? REVIEWABLE_DEPOSIT_STATUSES;
  const needsReview =
    search.status === undefined || sameStatusSet(search.status, REVIEWABLE_DEPOSIT_STATUSES);
  const stuck = sameStatusSet(search.status, ATTENTION_DEPOSIT_STATUSES);

  const toggleStatus = (status: DepositStatus, checked: boolean) => {
    const next = checked
      ? [...selectedStatuses, status]
      : selectedStatuses.filter((entry) => entry !== status);
    // An empty pick is not a filter that hides everything, it is no filter — which the backend
    // reads as the review queue. The boxes then show that default checked, which is the truth.
    const isDefault = next.length === 0 || sameStatusSet(next, REVIEWABLE_DEPOSIT_STATUSES);
    setSearch({ status: isDefault ? undefined : next });
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string): string | undefined => {
      const raw = form.get(name);
      const value = typeof raw === 'string' ? raw.trim() : '';
      return value.length === 0 ? undefined : value;
    };

    const minAmount = field('minAmount');
    const maxAmount = field('maxAmount');
    // Built here rather than in the model: the sentence is different in Arabic, and only a
    // component knows which language is on screen.
    const amountError = (value: string | undefined): string | null =>
      value === undefined || isPlainAmount(value) ? null : t('deposits.amountFormat');
    const errors = { min: amountError(minAmount), max: amountError(maxAmount) };
    setAmountErrors(errors);
    if (errors.min !== null || errors.max !== null) return;

    setSearch({
      shortId: field('shortId'),
      externalReference: field('externalReference'),
      minAmount,
      maxAmount,
      createdFrom: field('createdFrom'),
      createdTo: field('createdTo'),
    });
  };

  // Re-seeds the uncontrolled inputs whenever the URL changes under them: clearing the filters, or
  // opening a colleague's link, has to be visible in the fields themselves.
  const formKey = [
    search.shortId,
    search.externalReference,
    search.minAmount,
    search.maxAmount,
    search.createdFrom,
    search.createdTo,
  ].join('|');

  return (
    <Card className="p-4">
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            pressed={needsReview}
            onClick={() => {
              setSearch({ status: undefined, unclaimedOnly: undefined });
            }}
          >
            {t('deposits.filters.needsReview')}
          </FilterChip>
          <FilterChip
            pressed={search.unclaimedOnly === true}
            onClick={() => {
              setSearch({ unclaimedOnly: search.unclaimedOnly === true ? undefined : true });
            }}
          >
            {t('deposits.filters.unclaimedOnly')}
          </FilterChip>
          <FilterChip
            pressed={stuck}
            onClick={() => {
              setSearch({ status: stuck ? undefined : [...ATTENTION_DEPOSIT_STATUSES] });
            }}
          >
            {t('deposits.filters.stuck')}
          </FilterChip>

          {/* `ms-auto`: the disclosure sits at the end of the row, which is the left in Arabic. */}
          <span className="ms-auto flex items-center gap-2">
            <Button
              type="button"
              variant={showAdvanced ? 'secondary' : 'ghost'}
              size="sm"
              aria-expanded={showAdvanced}
              onClick={() => {
                setManuallyToggled(!showAdvanced);
              }}
            >
              <SlidersHorizontal className="size-3.5" />
              {t('common.moreFilters')}
            </Button>
            {hasActiveFilters(search) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAmountErrors({ min: null, max: null });
                  clearFilters();
                }}
              >
                <X className="size-3.5" />
                {t('common.clearFilters')}
              </Button>
            ) : null}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="deposit-short-id">{t('deposits.field.shortId')}</Label>
            <Input
              id="deposit-short-id"
              name="shortId"
              defaultValue={search.shortId ?? ''}
              // A sample id and a sample reference, not prose: they are the same in both languages.
              placeholder="K7QP42"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deposit-reference">{t('deposits.field.reference')}</Label>
            <Input
              id="deposit-reference"
              name="externalReference"
              defaultValue={search.externalReference ?? ''}
              placeholder="884512309"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deposit-sort">{t('deposits.filters.sort')}</Label>
            <Select
              value={search.sort ?? 'newest'}
              onValueChange={(value) => {
                const sort = DEPOSIT_SORTS.find((entry) => entry === value);
                setSearch({ sort: sort === 'newest' ? undefined : sort });
              }}
            >
              <SelectTrigger id="deposit-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPOSIT_SORTS.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {enumLabel('depositSort', sort)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full">
              <Search className="size-4" />
              {t('common.apply')}
            </Button>
          </div>
        </div>

        {showAdvanced ? (
          <div className="space-y-4 border-t border-[var(--border)] pt-4">
            <fieldset>
              <legend className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                {t('field.status')}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DEPOSIT_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      aria-label={enumLabel('depositStatus', status)}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={(checked) => {
                        toggleStatus(status, checked === true);
                      }}
                    />
                    <span>{enumLabel('depositStatus', status)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                {t('deposits.filters.statusHint')}
              </p>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="deposit-min-amount">{t('deposits.filters.amountFrom')}</Label>
                <Input
                  id="deposit-min-amount"
                  name="minAmount"
                  inputMode="decimal"
                  defaultValue={search.minAmount ?? ''}
                  placeholder="1500.00"
                  autoComplete="off"
                  aria-invalid={amountErrors.min !== null}
                  {...(amountErrors.min === null
                    ? {}
                    : { 'aria-describedby': 'deposit-min-error' })}
                  className="tabular"
                />
                {amountErrors.min === null ? null : (
                  <p id="deposit-min-error" role="alert" className="text-xs text-[var(--danger)]">
                    {amountErrors.min}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-max-amount">{t('deposits.filters.amountTo')}</Label>
                <Input
                  id="deposit-max-amount"
                  name="maxAmount"
                  inputMode="decimal"
                  defaultValue={search.maxAmount ?? ''}
                  placeholder="500000.00"
                  autoComplete="off"
                  aria-invalid={amountErrors.max !== null}
                  {...(amountErrors.max === null
                    ? {}
                    : { 'aria-describedby': 'deposit-max-error' })}
                  className="tabular"
                />
                {amountErrors.max === null ? null : (
                  <p id="deposit-max-error" role="alert" className="text-xs text-[var(--danger)]">
                    {amountErrors.max}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-created-from">{t('deposits.filters.createdFrom')}</Label>
                <Input
                  id="deposit-created-from"
                  name="createdFrom"
                  type="date"
                  defaultValue={toDayInput(search.createdFrom)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-created-to">{t('deposits.filters.createdTo')}</Label>
                <Input
                  id="deposit-created-to"
                  name="createdTo"
                  type="date"
                  defaultValue={toDayInput(search.createdTo)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

/** A one-click preset. Pressed state is a word plus a fill, never a fill alone. */
function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        pressed
          ? 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]'
          : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
      )}
    >
      {children}
    </button>
  );
}
