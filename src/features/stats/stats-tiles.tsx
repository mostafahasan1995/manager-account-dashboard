import {
  AlertTriangle,
  ArrowUpFromLine,
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  Clock,
  Hourglass,
  Inbox,
  TimerOff,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { MoneyAmount, StatCard } from '@/components/common';
import { useT } from '@/lib/i18n/use-translation';
import type { StatsBlock, TenantStats } from '@/types';
import { DEPOSIT_STATUSES, type Tone } from '@/types/enums';

import { statsMessages } from './messages';

/**
 * The figures, as tiles.
 *
 * ── EVERY TILE CARRIES ITS CLOCK IN THE HINT ──────────────────────────────────────────────────
 * `Opened` is counted on createdAt and `Credited` on creditedAt, so a deposit opened last night and
 * credited this morning is in one figure for yesterday and the other for today. They are not two
 * views of one set and they will not add up. Somebody will nevertheless try to subtract them, so
 * each tile states which clock it is on — that footnote is the difference between a reader who
 * understands the screen and a bug report saying the totals are wrong.
 *
 * ── THE MONEY IS THE VALUE, THE COUNT IS THE HINT ─────────────────────────────────────────────
 * The other way round reads better on a queue ("7 waiting") and worse here: the question this
 * screen answers is how much moved, and a count without an amount is the thing the deposit queue
 * could already tell you. `waiting` and `attention` keep the count first, because those two ARE
 * work-list questions and the amount is the supporting detail.
 */

interface Tile {
  label: string;
  block: StatsBlock;
  icon: LucideIcon;
  tone: Tone;
  /** Count-first tiles: the queue questions, where "how many to do" beats "how much". */
  countFirst?: boolean;
  to?: string;
  search?: Record<string, unknown>;
}

function BlockTile({ label, block, icon, tone, countFirst = false, to, search }: Tile) {
  const t = useT(statsMessages);
  // Zero is muted on purpose, exactly as the overview tiles are: a tile that shouts when there is
  // nothing to report teaches people to stop reading it.
  const active = block.count > 0;
  const basis = t(`stats.basis.${block.basis}` as 'stats.basis.current');

  return (
    <StatCard
      label={label}
      value={countFirst ? block.count : <MoneyAmount money={block.total} className="text-xl" />}
      hint={
        countFirst ? (
          <>
            <MoneyAmount money={block.total} /> · {basis}
          </>
        ) : (
          `${block.count} · ${basis}`
        )
      }
      tone={active ? tone : 'muted'}
      icon={icon}
      {...(to === undefined ? {} : { to })}
      {...(search === undefined ? {} : { search })}
    />
  );
}

/** Money in: what was opened, what landed, and what did not. */
export function DepositTiles({ stats }: { stats: TenantStats }) {
  const t = useT(statsMessages);
  const { deposits } = stats;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <BlockTile
        label={t('stats.deposits.opened')}
        block={deposits.opened}
        icon={Inbox}
        tone="neutral"
        to="/deposits"
        // Every status, not the reviewable three — this tile counted all of them, so the link it
        // offers has to show all of them or the screen it opens contradicts the number clicked.
        search={{ status: [...DEPOSIT_STATUSES] }}
      />
      <BlockTile
        label={t('stats.deposits.credited')}
        block={deposits.credited}
        icon={CheckCircle2}
        tone="success"
        to="/deposits"
        search={{ status: ['CREDITED'] }}
      />
      <BlockTile
        label={t('stats.deposits.rejected')}
        block={deposits.rejected}
        icon={Ban}
        tone="danger"
        to="/deposits"
        search={{ status: ['REJECTED'] }}
      />
      <BlockTile
        label={t('stats.deposits.expired')}
        block={deposits.expired}
        icon={TimerOff}
        tone="muted"
        to="/deposits"
        search={{ status: ['EXPIRED'] }}
      />
      <BlockTile
        label={t('stats.deposits.waiting')}
        block={deposits.waiting}
        icon={Hourglass}
        tone="warning"
        countFirst
        to="/deposits"
      />
      <BlockTile
        label={t('stats.deposits.attention')}
        block={deposits.attention}
        icon={AlertTriangle}
        tone="danger"
        countFirst
        to="/deposits"
        search={{ status: ['CREDIT_FAILED', 'NEEDS_RECONCILIATION'] }}
      />
    </div>
  );
}

/** Money out, and the people behind it. */
export function WithdrawalAndPlayerTiles({ stats }: { stats: TenantStats }) {
  const t = useT(statsMessages);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <BlockTile
        label={t('stats.withdrawals.paid')}
        block={stats.withdrawals.paid}
        icon={ArrowUpFromLine}
        tone="neutral"
        to="/withdrawals"
        search={{ status: ['PAID'] }}
      />
      <BlockTile
        label={t('stats.withdrawals.pending')}
        block={stats.withdrawals.pending}
        icon={Clock}
        tone="warning"
        countFirst
        to="/withdrawals"
      />
      <StatCard
        label={t('stats.players.new')}
        value={stats.players.newInPeriod}
        tone={stats.players.newInPeriod > 0 ? 'success' : 'muted'}
        icon={UserPlus}
        to="/players"
      />
      <StatCard
        label={t('stats.players.total')}
        value={stats.players.total}
        hint={t('stats.players.totalHint')}
        icon={Users}
        to="/players"
      />
    </div>
  );
}

/**
 * The lifetime count, which is the tile that answers the question the deposit queue never could:
 * how many deposits exist AT ALL, as opposed to how many need a decision.
 */
export function LifetimeTile({ stats }: { stats: TenantStats }) {
  const t = useT(statsMessages);

  return (
    <StatCard
      label={t('stats.deposits.lifetime')}
      value={stats.deposits.lifetimeCount}
      hint={t('stats.deposits.lifetimeHint')}
      icon={Wallet}
      to="/deposits"
      search={{ status: [...DEPOSIT_STATUSES] }}
    />
  );
}

/** Fees kept. See `stats.profit.noRails` for why a zero here usually is not a bad month. */
export function ProfitTile({ stats }: { stats: TenantStats }) {
  const t = useT(statsMessages);
  const { profit } = stats;

  return (
    <StatCard
      label={t('stats.profit.total')}
      value={<MoneyAmount money={profit.total} className="text-xl" />}
      hint={t('stats.profit.rails', {
        charging: profit.chargingRails,
        active: profit.activeRails,
      })}
      tone={profit.chargingRails === 0 ? 'muted' : 'success'}
      icon={BadgeDollarSign}
    />
  );
}
