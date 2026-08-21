import { useNavigate, useSearch } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useState } from 'react';

import { pruneSearch } from '@/app/search-schemas';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/common';
import { Card } from '@/components/ui';
import { usePlayers } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { AdminPlayer, PlayerListQuery } from '@/types/player';

import { LinkIchancyDialog } from './link-ichancy-dialog';
import { playerMessages } from './messages';
import { PlayerFilters } from './player-filters';
import { PlayerTable } from './player-table';

/**
 * The player directory.
 *
 * Support lives on this screen while somebody is on the phone, so everything is aimed at finding
 * one account in seconds: the filters are in the URL (a colleague can be sent the exact view), the
 * previous page stays on screen while the next one loads, and the accounts that cannot be credited
 * are visible without filtering for them.
 */

const DEFAULT_LIMIT = 20;

export function PlayersPage() {
  const search = useSearch({ from: '/players' });
  const navigate = useNavigate();
  const t = useT(playerMessages);
  const [linkTarget, setLinkTarget] = useState<AdminPlayer | null>(null);

  const query: PlayerListQuery = {
    limit: search.limit ?? DEFAULT_LIMIT,
    offset: search.offset ?? 0,
    ...(search.status === undefined ? {} : { status: search.status }),
    ...(search.search === undefined ? {} : { search: search.search }),
    ...(search.telegramUserId === undefined ? {} : { telegramUserId: search.telegramUserId }),
    ...(search.linked === undefined ? {} : { linked: search.linked }),
  };

  const players = usePlayers(query);
  const rows = players.data?.data ?? [];

  const goToOffset = (offset: number) => {
    void navigate({
      from: '/players',
      to: '.',
      search: (prev) => pruneSearch({ ...prev, offset: offset === 0 ? undefined : offset }),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.players')} description={t('players.description')} />

      <PlayerFilters />

      <Card>
        {players.isPending ? (
          <TableSkeleton rows={8} columns={7} />
        ) : players.isError ? (
          <ErrorState
            error={players.error}
            onRetry={() => {
              void players.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={t('players.empty.title')}
            description={t('players.empty.description')}
          />
        ) : (
          <>
            <PlayerTable
              players={rows}
              onLink={(player) => {
                setLinkTarget(player);
              }}
            />
            <Pagination
              meta={players.data.meta}
              onOffsetChange={goToOffset}
              disabled={players.isFetching}
            />
          </>
        )}
      </Card>

      {linkTarget === null ? null : (
        <LinkIchancyDialog
          player={linkTarget}
          open
          onOpenChange={(open) => {
            if (!open) setLinkTarget(null);
          }}
        />
      )}
    </div>
  );
}
