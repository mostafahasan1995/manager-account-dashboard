import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Download, UserRoundPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { pruneSearch } from '@/app/search-schemas';
import {
  Can,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  TableSkeleton,
} from '@/components/common';
import { Alert, Button, Card } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useImportPlayers, usePlayers } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { formatMoney } from '@/lib/money';
import {
  playerDisplayName,
  type AdminPlayer,
  type ManualCredit,
  type PlayerDebit,
  type PlayerImportSummary,
  type PlayerListQuery,
  type RegisterPlayerResult,
} from '@/types/player';

import { AttachTelegramDialog } from './attach-telegram-dialog';
import { BlockPlayerDialog } from './block-player-dialog';
import { CreditPlayerDialog } from './credit-player-dialog';
import { DebitOutcomeAlert } from './debit-outcome-alert';
import { DebitPlayerDialog } from './debit-player-dialog';
import { LinkIchancyDialog } from './link-ichancy-dialog';
import { playerMessages } from './messages';
import { PlayerFilters } from './player-filters';
import { PlayerSegments } from './player-segments';
import { PlayerTable } from './player-table';
import { registeredPlayerName } from './register-player-body';
import { RegisterPlayerDialog } from './register-player-dialog';
import { UnblockPlayerDialog } from './unblock-player-dialog';

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
 * opening another starts from an empty form rather than from the last player's amount. The block,
 * unblock and attach dialogs follow the same rule for the same reason.
 *
 * ── AND WHY THE OUTCOMES LIVE HERE TOO ────────────────────────────────────────────────────────
 * The detail page keeps a debit's receipt on the page after its dialog closes, because a debit that
 * MIGHT have gone through is the one thing an operator must not be able to dismiss by accident.
 * Firing the same action from a table row needs the same place to put that, or the warning would
 * vanish with the dialog that raised it. So the outcome alerts sit above the table, and they name
 * the player — on a list screen, unlike the detail page, "which player was that?" is a real question.
 * A registration that made the player but not their Ichancy account is kept here for the same
 * reason: the dialog is gone, and the missing account is not.
 */

const DEFAULT_LIMIT = 20;

export function PlayersPage() {
  const search = useSearch({ from: '/players' });
  const navigate = useNavigate();
  const t = useT(playerMessages);
  const [linkTarget, setLinkTarget] = useState<AdminPlayer | null>(null);
  const [creditTarget, setCreditTarget] = useState<AdminPlayer | null>(null);
  const [debitTarget, setDebitTarget] = useState<AdminPlayer | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminPlayer | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<AdminPlayer | null>(null);
  const [attachTarget, setAttachTarget] = useState<AdminPlayer | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

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
  const [registerResult, setRegisterResult] = useState<RegisterPlayerResult | null>(null);
  const [importResult, setImportResult] = useState<PlayerImportSummary | null>(null);

  const importPlayers = useImportPlayers();

  const query: PlayerListQuery = {
    limit: search.limit ?? DEFAULT_LIMIT,
    offset: search.offset ?? 0,
    ...(search.status === undefined ? {} : { status: search.status }),
    ...(search.search === undefined ? {} : { search: search.search }),
    ...(search.telegramUserId === undefined ? {} : { telegramUserId: search.telegramUserId }),
    ...(search.linked === undefined ? {} : { linked: search.linked }),
    ...(search.source === undefined ? {} : { source: search.source }),
    ...(search.blocked === undefined ? {} : { blocked: search.blocked }),
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

  const runImport = () => {
    void (async () => {
      try {
        const summary = await importPlayers.mutateAsync({});
        setImportResult(summary);
        if (summary.error === null) {
          toast.success(t('players.import.doneTitle'), {
            description: t('players.import.summary', importCounts(summary)),
          });
        } else {
          toast.error(t('players.import.stoppedTitle'), { description: summary.error });
        }
      } catch (error) {
        toast.error(t('players.import.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.players')}
        description={t('players.description')}
        actions={
          <>
            <Can capability="players.import">
              <Button
                variant="secondary"
                loading={importPlayers.isPending}
                onClick={runImport}
                title={t('players.import.hint')}
              >
                <Download aria-hidden="true" />
                {t('players.import.action')}
              </Button>
            </Can>
            <Can capability="players.write">
              <Button
                variant="primary"
                onClick={() => {
                  setRegisterOpen(true);
                }}
              >
                <UserRoundPlus aria-hidden="true" />
                {t('players.register.action')}
              </Button>
            </Can>
          </>
        }
      />

      <PlayerSegments />

      <PlayerFilters />

      {registerResult === null ? null : (
        <RegisterOutcomeAlert
          result={registerResult}
          onDismiss={() => {
            setRegisterResult(null);
          }}
        />
      )}

      {importResult === null ? null : (
        <Alert
          tone={importResult.error === null ? 'success' : 'warning'}
          title={
            importResult.error === null
              ? t('players.import.doneTitle')
              : t('players.import.stoppedTitle')
          }
        >
          <p>{t('players.import.summary', importCounts(importResult))}</p>
          {importResult.error === null ? null : (
            <p className="mt-1">{t('players.import.stoppedBody', { error: importResult.error })}</p>
          )}
        </Alert>
      )}

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
              onBlock={(player) => {
                setBlockTarget(player);
              }}
              onUnblock={(player) => {
                setUnblockTarget(player);
              }}
              onAttachTelegram={(player) => {
                setAttachTarget(player);
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

      <RegisterPlayerDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={(result) => {
          setRegisterResult(result);
          setRegisterOpen(false);
        }}
      />

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

      {blockTarget === null ? null : (
        <BlockPlayerDialog
          player={blockTarget}
          open
          onOpenChange={(open) => {
            if (!open) setBlockTarget(null);
          }}
          onBlocked={() => {
            setBlockTarget(null);
          }}
        />
      )}

      {unblockTarget === null ? null : (
        <UnblockPlayerDialog
          player={unblockTarget}
          open
          onOpenChange={(open) => {
            if (!open) setUnblockTarget(null);
          }}
          onUnblocked={() => {
            setUnblockTarget(null);
          }}
        />
      )}

      {attachTarget === null ? null : (
        <AttachTelegramDialog
          player={attachTarget}
          open
          onOpenChange={(open) => {
            if (!open) setAttachTarget(null);
          }}
          onAttached={() => {
            setAttachTarget(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * What registering answered, kept on the page after the dialog closed.
 *
 * Three endings, and the tone follows them: the account was created (success), nobody asked for
 * one or Ichancy already had this player (info), or the player exists but the Ichancy call failed
 * (warning — the row is real and the missing account is the operator's next job).
 */
function RegisterOutcomeAlert({
  result,
  onDismiss,
}: {
  result: RegisterPlayerResult;
  onDismiss: () => void;
}) {
  const t = useT(playerMessages);
  const name = registeredPlayerName(result);
  const failed = result.ichancyError !== null;

  const openLink = (
    <Link
      to="/players/$playerId"
      params={{ playerId: result.player.id }}
      className="font-medium underline"
    >
      {t('players.register.open', { name })}
    </Link>
  );

  if (failed) {
    return (
      <Alert tone="warning" title={t('players.register.ichancy.failedTitle', { name })}>
        <p>{t('players.register.ichancy.failedBody', { error: result.ichancyError ?? '' })}</p>
        <p className="mt-1 flex flex-wrap items-center gap-3">
          {openLink}
          <DismissButton onClick={onDismiss} />
        </p>
      </Alert>
    );
  }

  const ichancy = result.ichancy;
  return (
    <Alert
      tone={ichancy?.created === true ? 'success' : 'info'}
      title={t('players.register.successTitle', { name })}
    >
      <p>
        {ichancy === null
          ? t('players.register.ichancy.notRequested')
          : ichancy.created
            ? t('players.register.ichancy.created', {
                login: ichancy.ichancyLogin,
                agent: ichancy.agentId,
              })
            : t('players.register.ichancy.existing', { login: ichancy.ichancyLogin })}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-3">
        {openLink}
        <DismissButton onClick={onDismiss} />
      </p>
    </Alert>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      {t('common.close')}
    </Button>
  );
}

/** The name shown in an outcome alert. Kept local: only these alerts need it on this screen. */
function playerName(player: AdminPlayer): string {
  const full = [player.firstName, player.lastName].filter((part) => part !== null).join(' ');
  if (full.length > 0) return full;
  // The shared fallback chain: @username, then the Telegram id, then — for an imported row that
  // has neither — the Ichancy login.
  return playerDisplayName(player);
}

/** The three figures the summary sentence reads; the timestamps and the error are said elsewhere. */
function importCounts(summary: PlayerImportSummary) {
  return { scanned: summary.scanned, created: summary.created, existing: summary.existing };
}
