import type { ReconciliationSearch } from '@/app/search-schemas';
import type { BreakListQuery } from '@/types';
import type { BreakStatus } from '@/types/enums';

/**
 * The two things the breaks tab has to agree on in more than one place.
 *
 * The default status set mirrors the backend's own default for `GET /breaks`, and is sent
 * explicitly rather than left off the request: the filter bar shows those two boxes ticked, so the
 * query has to ask for exactly what the operator can see it asking for. A filter bar that says one
 * thing while the request says another is how somebody concludes there are no open breaks.
 *
 * Category labels are NOT here: they are a backend enum, so they go through `useEnumLabel()` at the
 * point they are rendered and come out in whichever language the screen is being read in.
 */

export const DEFAULT_BREAK_STATUSES: readonly BreakStatus[] = ['OPEN', 'INVESTIGATING'];

export function breakListQueryFrom(search: ReconciliationSearch): BreakListQuery {
  return {
    status: [...(search.status ?? DEFAULT_BREAK_STATUSES)],
    ...(search.category === undefined ? {} : { category: [...search.category] }),
    ...(search.minSeverity === undefined ? {} : { minSeverity: search.minSeverity }),
  };
}
