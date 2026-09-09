import { useNavigate, useSearch } from '@tanstack/react-router';

import { pruneSearch } from '@/app/search-schemas';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';

import { playerMessages } from './messages';
import { PLAYER_SEGMENTS, searchForSegment, segmentOf, type PlayerSegment } from './segments';

/**
 * The four views of the directory, above the filters.
 *
 * "Old players" is the owner's own word for the accounts that existed under the Ichancy agent
 * before the bot did — the rows the tenant import wrote, with no Telegram and often no name. They
 * are one segment rather than a value in the status select because they are not a status: an old
 * player is ACTIVE like anyone else, and the question the desk asks is "was this person here before
 * the bot?", not "what state are they in?".
 *
 * Every segment is a URL, so a colleague can be sent "the blocked ones" as a link, and changing it
 * drops the offset for the same reason every other filter does: page three of a different set of
 * people is a different page.
 */
export function PlayerSegments() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/players' });
  const t = useT(playerMessages);
  const current = segmentOf(search);

  const labels: Record<PlayerSegment, string> = {
    all: t('players.segment.all'),
    telegram: t('players.segment.telegram'),
    imported: t('players.segment.imported'),
    blocked: t('players.segment.blocked'),
  };

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const segment = PLAYER_SEGMENTS.find((candidate) => candidate === value) ?? 'all';
        void navigate({
          from: '/players',
          to: '.',
          search: (prev) => pruneSearch({ ...prev, ...searchForSegment(segment) }),
        });
      }}
    >
      <TabsList aria-label={t('players.segment.label')}>
        {PLAYER_SEGMENTS.map((segment) => (
          <TabsTrigger key={segment} value={segment}>
            {labels[segment]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
