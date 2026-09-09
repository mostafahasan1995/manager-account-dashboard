import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { pruneSearch, withdrawalSearchSchema, type WithdrawalSearch } from '@/app/search-schemas';

/**
 * The queue's filters, its page and the open withdrawal, read from and written to the URL.
 *
 * Read loosely and re-validated with the route's own schema rather than through
 * `useSearch({ from })`, for the reason `deposit-url.ts` gives: the route hangs off a pathless
 * layout, and pinning every component to the id the router generates for it would couple the
 * feature to how the layout happens to be nested today.
 */
export function useWithdrawalSearch(): WithdrawalSearch {
  const raw = useSearch({ strict: false });
  return useMemo(() => withdrawalSearchSchema.parse(raw), [raw]);
}

/** The keys that narrow the list. Changing any of them sends the reader back to the first page. */
const FILTER_KEYS: readonly (keyof WithdrawalSearch)[] = [
  'status',
  'playerId',
  'shortId',
  'createdFrom',
  'createdTo',
  'sort',
  'limit',
];

export interface WithdrawalNavigation {
  /**
   * Merges a patch into the URL. Keys set to `undefined` leave the URL rather than becoming "".
   * A patch that touches a filter also drops `offset`: page three of the old filter is nowhere in
   * particular under the new one.
   */
  setSearch: (patch: Partial<WithdrawalSearch>) => void;
  /** Page N. Zero leaves the URL clean rather than writing `offset=0`. */
  goToOffset: (offset: number) => void;
  clearFilters: () => void;
}

export function useWithdrawalNavigation(search: WithdrawalSearch): WithdrawalNavigation {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      setSearch: (patch: Partial<WithdrawalSearch>) => {
        const touchesFilter = FILTER_KEYS.some((key) => key in patch);
        void navigate({
          to: '/withdrawals',
          search: pruneSearch({
            ...search,
            ...patch,
            ...(touchesFilter ? { offset: undefined } : {}),
          }),
        });
      },
      goToOffset: (offset: number) => {
        void navigate({
          to: '/withdrawals',
          search: pruneSearch({ ...search, offset: offset === 0 ? undefined : offset }),
        });
      },
      clearFilters: () => {
        // The open panel survives a filter reset: it is what the reader is looking at.
        void navigate({ to: '/withdrawals', search: pruneSearch({ selected: search.selected }) });
      },
    }),
    [navigate, search],
  );
}
