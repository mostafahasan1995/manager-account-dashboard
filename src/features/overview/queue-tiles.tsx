import {
  AlertTriangle,
  ArrowUpFromLine,
  Hourglass,
  Inbox,
  Scale,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

import { Can, ErrorState, StatCard } from '@/components/common';
import { Card } from '@/components/ui';
import {
  OVERVIEW_POLL_MS,
  flattenPages,
  useBreaks,
  useDepositQueue,
  useWithdrawals,
} from '@/lib/api/queries';
import { useT, type TranslatorKey } from '@/lib/i18n/use-translation';
import { ATTENTION_DEPOSIT_STATUSES, type Tone } from '@/types/enums';
import type { DepositQueueQuery } from '@/types';

import { overviewMessages } from './messages';
import {
  COUNT_SAMPLE_LIMIT,
  OPEN_BREAKS_QUERY,
  SECOND_APPROVAL_QUERY,
  STUCK_MONEY_QUERY,
  UNCLAIMED_QUERY,
  WAITING_QUERY,
  WITHDRAWALS_WAITING_QUERY,
  sampleCountLabel,
} from './overview-data';

/**
 * The row of numbers a cashier reads first.
 *
 * Each tile is its own component because each one is its own query: that way a rail that fails
 * takes down one tile instead of the row, and the breaks tile — which a SUPPORT user may not read —
 * simply never mounts, so no request goes out that the server would answer with a 403.
 *
 * Zero is deliberately muted and anything above zero takes its status colour. A tile that shouts
 * when there is nothing to do teaches people to stop looking at it.
 */

type OverviewKey = TranslatorKey<typeof overviewMessages.en>;

function TileError({
  label,
  error,
  onRetry,
}: {
  label: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
        {label}
      </p>
      <ErrorState error={error} onRetry={onRetry} className="gap-2 px-0 py-4" />
    </Card>
  );
}

interface TileSpec {
  labelKey: OverviewKey;
  hintKey: OverviewKey;
  icon: LucideIcon;
  /** The colour the number takes once there is something to do. */
  activeTone: Tone;
  query: DepositQueueQuery;
  search: Record<string, unknown>;
  /**
   * How live this tile has to be. Only the two a reviewer races for are worth a timer; "stuck
   * money" and "second approval" change when somebody acts, and that already invalidates them.
   */
  poll?: number | false;
}

function DepositCountTile({
  labelKey,
  hintKey,
  icon,
  activeTone,
  query,
  search,
  poll = false,
}: TileSpec) {
  const t = useT(overviewMessages);
  const { data, isLoading, error, refetch } = useDepositQueue(query, { poll });
  const label = t(labelKey);

  if (error !== null) {
    return (
      <TileError
        label={label}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const loaded = flattenPages(data?.pages).length;
  const hasMore = data?.pages[0]?.meta.hasMore ?? false;

  return (
    <StatCard
      label={label}
      value={sampleCountLabel(loaded, hasMore)}
      hint={hasMore ? t('overview.tiles.sampleHint', { limit: COUNT_SAMPLE_LIMIT }) : t(hintKey)}
      tone={loaded > 0 ? activeTone : 'muted'}
      icon={icon}
      to="/deposits"
      search={search}
      loading={isLoading}
    />
  );
}

function OpenBreaksTile() {
  const t = useT(overviewMessages);
  const { data, isLoading, error, refetch } = useBreaks(OPEN_BREAKS_QUERY);
  const label = t('overview.tiles.breaks');

  if (error !== null) {
    return (
      <TileError
        label={label}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const loaded = flattenPages(data?.pages).length;
  const hasMore = data?.pages[0]?.meta.hasMore ?? false;

  return (
    <StatCard
      label={label}
      value={sampleCountLabel(loaded, hasMore)}
      hint={
        hasMore
          ? t('overview.tiles.sampleHint', { limit: COUNT_SAMPLE_LIMIT })
          : t('overview.tiles.breaksHint')
      }
      tone={loaded > 0 ? 'danger' : 'muted'}
      icon={Scale}
      to="/reconciliation"
      search={{ tab: 'breaks' }}
      loading={isLoading}
    />
  );
}

/**
 * Cash-outs somebody owes an action to. Live, like the deposit tiles a reviewer races for: a
 * request arriving is the thing this tile exists to notice, and a DEBITED row is a player who has
 * been charged and is waiting on a person to pay them.
 */
function WithdrawalsWaitingTile() {
  const t = useT(overviewMessages);
  const { data, isLoading, error, refetch } = useWithdrawals(WITHDRAWALS_WAITING_QUERY, {
    poll: OVERVIEW_POLL_MS,
  });
  const label = t('overview.tiles.withdrawals');

  if (error !== null) {
    return (
      <TileError
        label={label}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const total = data?.meta.total ?? 0;

  return (
    <StatCard
      label={label}
      value={String(total)}
      hint={t('overview.tiles.withdrawalsHint')}
      tone={total > 0 ? 'warning' : 'muted'}
      icon={ArrowUpFromLine}
      to="/withdrawals"
      search={{ status: [...(WITHDRAWALS_WAITING_QUERY.status ?? [])] }}
      loading={isLoading}
    />
  );
}

const DEPOSIT_TILES: TileSpec[] = [
  {
    labelKey: 'overview.tiles.waiting',
    hintKey: 'overview.tiles.waitingHint',
    icon: Inbox,
    activeTone: 'info',
    query: WAITING_QUERY,
    search: { status: ['SUBMITTED'] },
    // Live: a deposit arriving is the thing this screen exists to notice.
    poll: OVERVIEW_POLL_MS,
  },
  {
    labelKey: 'overview.tiles.unclaimed',
    hintKey: 'overview.tiles.unclaimedHint',
    icon: Hourglass,
    activeTone: 'warning',
    query: UNCLAIMED_QUERY,
    search: { status: ['SUBMITTED'], unclaimedOnly: true },
    // Live: this is the number a reviewer decides whether to pick something up from.
    poll: OVERVIEW_POLL_MS,
  },
  {
    // This tile counts exactly one status, so it is named by that status rather than by a second
    // copy of the same words — a rename of the status renames the tile with it.
    labelKey: 'enum.depositStatus.PENDING_SECOND_APPROVAL',
    hintKey: 'overview.tiles.secondApprovalHint',
    icon: UserCheck,
    activeTone: 'warning',
    query: SECOND_APPROVAL_QUERY,
    search: { status: ['PENDING_SECOND_APPROVAL'] },
    // No timer: a deposit only reaches this state because somebody in this console approved it,
    // and that approval already invalidated this key.
  },
  {
    labelKey: 'overview.tiles.stuck',
    hintKey: 'overview.tiles.stuckHint',
    icon: AlertTriangle,
    activeTone: 'danger',
    query: STUCK_MONEY_QUERY,
    search: { status: [...ATTENTION_DEPOSIT_STATUSES] },
    // No timer, and this is the tile that made the case for cutting them: nine stuck deposits that
    // had not changed in days were being re-fetched four times a minute, for ever.
  },
];

export function QueueTiles() {
  return (
    // Flex rather than a fixed column count: a role that cannot see breaks gets four tiles that
    // fill the row instead of four tiles and a hole.
    <div className="flex flex-wrap gap-4">
      {DEPOSIT_TILES.map((tile) => (
        <div key={tile.labelKey} className="min-w-52 flex-1">
          <DepositCountTile {...tile} />
        </div>
      ))}
      <Can capability="withdrawals.read">
        <div className="min-w-52 flex-1">
          <WithdrawalsWaitingTile />
        </div>
      </Can>
      <Can capability="reconciliation.read">
        <div className="min-w-52 flex-1">
          <OpenBreaksTile />
        </div>
      </Can>
    </div>
  );
}
