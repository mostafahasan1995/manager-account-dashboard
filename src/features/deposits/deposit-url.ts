import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { depositSearchSchema, pruneSearch, type DepositSearch } from '@/app/search-schemas';

/**
 * The queue's filters and the open deposit, read from and written to the URL.
 *
 * The search params are read loosely and re-validated with the route's own schema rather than
 * through `useSearch({ from })`. The deposits route hangs off a pathless layout route, so the id
 * the router generates for it ("/protected/deposits") is not its path — pinning every component in
 * this feature to that id would couple them to how the layout happens to be nested today. The
 * schema is the real contract, and running it costs one parse per navigation.
 */
export function useDepositSearch(): DepositSearch {
  const raw = useSearch({ strict: false });
  return useMemo(() => depositSearchSchema.parse(raw), [raw]);
}

export interface DepositNavigation {
  /** Merges a patch into the URL. Keys set to `undefined` leave the URL rather than becoming "". */
  setSearch: (patch: Partial<DepositSearch>) => void;
  clearFilters: () => void;
}

export function useDepositNavigation(search: DepositSearch): DepositNavigation {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      setSearch: (patch: Partial<DepositSearch>) => {
        void navigate({ to: '/deposits', search: pruneSearch({ ...search, ...patch }) });
      },
      clearFilters: () => {
        // The open panel survives a filter reset: it is what the reviewer is reading.
        void navigate({ to: '/deposits', search: pruneSearch({ selected: search.selected }) });
      },
    }),
    [navigate, search],
  );
}
