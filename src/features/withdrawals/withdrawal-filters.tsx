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
import { WITHDRAWAL_SORTS, WITHDRAWAL_STATUSES, type WithdrawalStatus } from '@/types/enums';

import { withdrawalMessages } from './messages';
import {
  ALL_STATUSES,
  ATTENTION_STATUSES,
  DEFAULT_STATUSES,
  READY_TO_PAY_STATUSES,
  hasActiveFilters,
  hasAdvancedFilters,
  sameStatusSet,
  toDayInput,
} from './withdrawal-model';
import { useWithdrawalNavigation, useWithdrawalSearch } from './withdrawal-url';

/**
 * The queue's filters, which live in the URL and nowhere else.
 *
 * Same two rules as the deposit filters. Text and date inputs are UNCONTROLLED, seeded from the
 * URL and committed on Apply, so typing a short id does not rewrite the URL and refetch the queue
 * per keystroke. The discrete controls — the preset chips, the status boxes, the sort — commit at
 * once, because each of those clicks is already a whole decision. Every change of filter also
 * drops the page offset (see `withdrawal-url.ts`).
 */
export function WithdrawalFilters() {
  const search = useWithdrawalSearch();
  const { setSearch, clearFilters } = useWithdrawalNavigation(search);
  const t = useT(withdrawalMessages);
  const enumLabel = useEnumLabel();

  // The URL decides whether the extra filters are showing, until the reader says otherwise: a
  // link that carries a date range has to arrive with that range visible.
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);
  const showAdvanced = manuallyToggled ?? hasAdvancedFilters(search);

  const selectedStatuses: readonly WithdrawalStatus[] = search.status ?? DEFAULT_STATUSES;
  const openView = search.status === undefined || sameStatusSet(search.status, DEFAULT_STATUSES);
  const readyToPay = sameStatusSet(search.status, READY_TO_PAY_STATUSES);
  const attention = sameStatusSet(search.status, ATTENTION_STATUSES);
  const everything = sameStatusSet(search.status, ALL_STATUSES);

  const toggleStatus = (status: WithdrawalStatus, checked: boolean) => {
    const next = checked
      ? [...selectedStatuses, status]
      : selectedStatuses.filter((entry) => entry !== status);
    // An empty pick is not a filter that hides everything, it is no filter — the open queue. The
    // boxes then show that default ticked, which is the truth.
    const isDefault = next.length === 0 || sameStatusSet(next, DEFAULT_STATUSES);
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

    setSearch({
      shortId: field('shortId'),
      playerId: field('playerId'),
      createdFrom: field('createdFrom'),
      createdTo: field('createdTo'),
    });
  };

  // Re-seeds the uncontrolled inputs whenever the URL changes under them: clearing the filters, or
  // opening a colleague's link, has to be visible in the fields themselves.
  const formKey = [search.shortId, search.playerId, search.createdFrom, search.createdTo].join('|');

  return (
    <Card className="p-4">
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            pressed={openView}
            onClick={() => {
              setSearch({ status: undefined });
            }}
          >
            {t('withdrawals.filters.open')}
          </FilterChip>
          <FilterChip
            pressed={readyToPay}
            onClick={() => {
              setSearch({ status: readyToPay ? undefined : [...READY_TO_PAY_STATUSES] });
            }}
          >
            {t('withdrawals.filters.readyToPay')}
          </FilterChip>
          <FilterChip
            pressed={attention}
            onClick={() => {
              setSearch({ status: attention ? undefined : [...ATTENTION_STATUSES] });
            }}
          >
            {t('withdrawals.filters.attention')}
          </FilterChip>
          <FilterChip
            pressed={everything}
            onClick={() => {
              setSearch({ status: everything ? undefined : [...ALL_STATUSES] });
            }}
          >
            {t('withdrawals.filters.all')}
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
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" />
                {t('common.clearFilters')}
              </Button>
            ) : null}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="withdrawal-short-id">{t('withdrawals.field.shortId')}</Label>
            <Input
              id="withdrawal-short-id"
              name="shortId"
              defaultValue={search.shortId ?? ''}
              // A sample id, not prose: it is the same in both languages.
              placeholder="WD7Q42"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdrawal-sort">{t('withdrawals.filters.sort')}</Label>
            <Select
              value={search.sort ?? 'newest'}
              onValueChange={(value) => {
                const sort = WITHDRAWAL_SORTS.find((entry) => entry === value);
                setSearch({ sort: sort === 'newest' ? undefined : sort });
              }}
            >
              <SelectTrigger id="withdrawal-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WITHDRAWAL_SORTS.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {enumLabel('withdrawalSort', sort)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:col-start-4">
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
                {WITHDRAWAL_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      aria-label={enumLabel('withdrawalStatus', status)}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={(checked) => {
                        toggleStatus(status, checked === true);
                      }}
                    />
                    <span>{enumLabel('withdrawalStatus', status)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                {t('withdrawals.filters.statusHint')}
              </p>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="withdrawal-player-id">{t('withdrawals.field.playerId')}</Label>
                <Input
                  id="withdrawal-player-id"
                  name="playerId"
                  defaultValue={search.playerId ?? ''}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="withdrawal-created-from">
                  {t('withdrawals.filters.createdFrom')}
                </Label>
                <Input
                  id="withdrawal-created-from"
                  name="createdFrom"
                  type="date"
                  defaultValue={toDayInput(search.createdFrom)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="withdrawal-created-to">{t('withdrawals.filters.createdTo')}</Label>
                <Input
                  id="withdrawal-created-to"
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
