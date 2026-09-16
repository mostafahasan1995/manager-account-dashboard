import type { PlayerSearch } from '@/app/search-schemas';

/**
 * The four views of the directory. See PlayerSegments for why they are a URL and not a status.
 * Kept apart from the component so the URL rule can be tested without a router.
 */

export const PLAYER_SEGMENTS = ['all', 'telegram', 'imported', 'blocked'] as const;
export type PlayerSegment = (typeof PLAYER_SEGMENTS)[number];

/** Which segment the URL describes. `source=ADMIN` has no segment of its own and reads as "all". */
export function segmentOf(search: Pick<PlayerSearch, 'source' | 'blocked'>): PlayerSegment {
  if (search.blocked === true) return 'blocked';
  if (search.source === 'ICHANCY_IMPORT') return 'imported';
  if (search.source === 'TELEGRAM') return 'telegram';
  return 'all';
}

/** The URL fields a segment writes. Every field it does not own is written as absent. */
export function searchForSegment(
  segment: PlayerSegment,
): Pick<PlayerSearch, 'source' | 'blocked' | 'offset'> {
  switch (segment) {
    case 'telegram':
      return { source: 'TELEGRAM', blocked: undefined, offset: undefined };
    case 'imported':
      return { source: 'ICHANCY_IMPORT', blocked: undefined, offset: undefined };
    case 'blocked':
      return { source: undefined, blocked: true, offset: undefined };
    default:
      return { source: undefined, blocked: undefined, offset: undefined };
  }
}
