import { useNavigate, useSearch } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useState } from 'react';

import { pruneSearch } from '@/app/search-schemas';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/common';
import { Alert, Card } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { usePlayers } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { formatMoney } from '@/lib/money';
import type { AdminPlayer, ManualCredit, PlayerDebit, PlayerListQuery } from '@/types/player';

import { CreditPlayerDialog } from './credit-player-dialog';
import { DebitOutcomeAlert } from './debit-outcome-alert';
import { DebitPlayerDialog } from './debit-player-dialog';
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
 *
 * ── WHY THE MONEY DIALOGS LIVE HERE AND NOT IN THE TABLE ──────────────────────────────────────
 * Every row can start a deposit or a withdrawal, but a dialog mounted per row would be one dialog
 * per player on screen, each holding its own form state. The table raises "this player" and the
 * page owns exactly one of each dialog, keyed by the target — which also means closing one and
 * opening another starts from an empty form rather than from the last player's amount.
 *
 * ── AND WHY THE OUTCOMES LIVE HERE TOO ────────────────────────────────────────────────────────
 * The detail page keeps a debit's receipt on the page after its dialog closes, because a debit that
 * MIGHT have gone through is the one thing an operator must not be able to dismiss by accident.
 * Firing the same action from a table row needs the same place to put that, or the warning would
 * vanish with the dialog that raised it. So the outcome alerts sit above the table, and they name
 * the player — on a list screen, unlike the detail page, "which player was that?" is a real question.
 */

const DEFAULT_LIMIT = 20;

export function PlayersPage() {
  const search = useSearch({ from: '/players' });
  const navigate = useNavigate();
  const t = useT(playerMessages);
  const [linkTarget, setLinkTarget] = useState<AdminPlayer | null>(null);
  const [creditTarget, setCreditTarget] = useState<AdminPlayer | null>(null);
  const [debitTarget, setDebitTarget] = useState<AdminPlayer | null>(null);

  /** The last completed money action, kept on the page after its dialog closed. See the header. */
  const [creditResult, setCreditResult] = useState<{
    player: AdminPlayer;
    credit: ManualCredit;
  } | null>(null);
  const [debitResult, setDebitResult] = useState<{
    player: AdminPlayer;
    debit: PlayerDebit;
  } | null>(null);
  const [debitUnproven, setDebitUnproven] = useState<{
    player: AdminPlayer;
    error: unknown;
  } | null>(null);

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

      {creditResult === null ? null : (
        <Alert
          tone="success"
          title={
            creditResult.credit.status === 'PENDING_SECOND_APPROVAL'
              ? t('players.credit.secondApprovalTitle')
              : t('players.credit.queuedTitle', {
                  amount: formatMoney(creditResult.credit.amount),
                })
          }
        >
          {creditResult.credit.status === 'PENDING_SECOND_APPROVAL'
            ? t('players.credit.secondApprovalBody', {
                name: playerName(creditResult.player),
                amount: formatMoney(creditResult.credit.amount),
              })
            : t('players.credit.queuedBody', {
                name: playerName(creditResult.player),
                amount: formatMoney(creditResult.credit.amount),
              })}
        </Alert>
      )}

      {debitResult === null ? null : (
        <DebitOutcomeAlert debit={debitResult.debit} player={debitResult.player} />
      )}

      {debitUnproven === null ? null : (
        /* The one alert that must outlive its dialog: after a failure that may have debited the
           player anyway, the next person to look at this screen has to see it too. */
        <Alert tone="danger" title={t('players.debit.maybeLandedTitle')}>
          <p>{errorMessage(debitUnproven.error)}</p>
          <p className="mt-1">{t('players.debit.maybeLandedBody')}</p>
        </Alert>
      )}

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
              onDeposit={(player) => {
                setCreditTarget(player);
              }}
              onWithdraw={(player) => {
                setDebitTarget(player);
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

      {creditTarget === null ? null : (
        <CreditPlayerDialog
          player={creditTarget}
          open
          onOpenChange={(open) => {
            if (!open) setCreditTarget(null);
          }}
          onCredited={(credit) => {
            setCreditResult({ player: creditTarget, credit });
            setCreditTarget(null);
          }}
        />
      )}

      {debitTarget === null ? null : (
        <DebitPlayerDialog
          player={debitTarget}
          open
          onOpenChange={(open) => {
            if (!open) setDebitTarget(null);
          }}
          onDebited={(debit) => {
            setDebitResult({ player: debitTarget, debit });
            // A completed debit supersedes any earlier "we do not know" — the doubt is resolved.
            setDebitUnproven(null);
            setDebitTarget(null);
          }}
          onUnproven={(error) => {
            setDebitUnproven({ player: debitTarget, error });
          }}
        />
      )}
    </div>
  );
}

/** The name shown in an outcome alert. Kept local: only these alerts need it on this screen. */
function playerName(player: AdminPlayer): string {
  const full = [player.firstName, player.lastName].filter((part) => part !== null).join(' ');
  if (full.length > 0) return full;
  return player.telegramUsername === null ? player.telegramUserId : `@${player.telegramUsername}`;
}
