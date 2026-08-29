import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Banknote, PlusCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';

import {
  Can,
  CardSkeleton,
  CopyableValue,
  ErrorState,
  PageHeader,
  PlayerStatusBadge,
} from '@/components/common';
import { Alert, Button } from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { usePlayer } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { formatMoney } from '@/lib/money';
import { useT } from '@/lib/i18n/use-translation';
import {
  playerDisplayName,
  type IchancyAccount,
  type ManualCredit,
  type PlayerDebit,
} from '@/types/player';

import { CreditPlayerDialog } from './credit-player-dialog';
import { DebitOutcomeAlert } from './debit-outcome-alert';
import { DebitPlayerDialog } from './debit-player-dialog';
import { LinkIchancyDialog } from './link-ichancy-dialog';
import { playerMessages } from './messages';
import { PlayerDeposits } from './player-deposits';
import { PlayerIdentity } from './player-identity';

/**
 * One player, opened from the list or from a deposit under review.
 *
 * A player id that does not exist is a 404 rather than an empty screen: support reaches this page
 * by pasting an id out of a chat, and "this account does not exist" is a real answer to give the
 * person on the phone.
 */
export function PlayerDetailPage() {
  const { playerId } = useParams({ from: '/players/$playerId' });
  const { can } = useAuth();
  const t = useT(playerMessages);
  const query = usePlayer(playerId);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<IchancyAccount | null>(null);
  const [debitOpen, setDebitOpen] = useState(false);
  const [debitResult, setDebitResult] = useState<PlayerDebit | null>(null);
  /** A debit that failed in a way nobody can prove either way. It outlives the dialog. */
  const [debitUnproven, setDebitUnproven] = useState<unknown>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditResult, setCreditResult] = useState<ManualCredit | null>(null);

  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/players">
        {/* A back arrow points the way the reader came from, which is the other way in Arabic. */}
        <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
        {t('players.backToList')}
      </Link>
    </Button>
  );

  if (query.isPending) {
    return (
      <div className="space-y-5">
        <PageHeader title={t('field.player')} actions={backLink} />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton className="lg:col-span-1" />
          <CardSkeleton className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.isNotFound;
    return (
      <div className="space-y-5">
        <PageHeader title={t('field.player')} actions={backLink} />
        <ErrorState
          error={query.error}
          // Retrying a 404 asks the same question and gets the same answer.
          {...(notFound
            ? {}
            : {
                onRetry: () => {
                  void query.refetch();
                },
              })}
        />
      </div>
    );
  }

  const player = query.data;
  const name = playerDisplayName(player);

  return (
    <div className="space-y-5">
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PlayerStatusBadge status={player.status} />
            <span className="inline-flex items-center gap-1">
              {t('field.telegramId')} <CopyableValue value={player.telegramUserId} />
            </span>
          </span>
        }
        actions={
          <>
            {backLink}
            {/* Credit and debit are the same money decision in opposite directions, so they share the
                deposit-decide capability. Credit is offered whatever the player's state: it records a
                manual deposit, and the deposit spine links a new Ichancy account on the way to
                crediting it, exactly as a real deposit for a first-time player does. */}
            <Can capability="deposits.decide">
              <Button
                variant="secondary"
                onClick={() => {
                  setCreditOpen(true);
                }}
              >
                <PlusCircle aria-hidden="true" />
                {t('players.credit.action')}
              </Button>
            </Can>
            {/* A debit, on the other hand, needs a live account to take from; its dialog says so when
                there is none rather than leaving the operator wondering where the action went. */}
            <Can capability="deposits.decide">
              <Button
                variant="secondary"
                onClick={() => {
                  setDebitOpen(true);
                }}
              >
                <Banknote aria-hidden="true" />
                {t('players.debit.action')}
              </Button>
            </Can>
            {player.ichancyLinked ? null : (
              <Can capability="players.link">
                <Button
                  variant="primary"
                  onClick={() => {
                    setLinkOpen(true);
                  }}
                >
                  <UserPlus aria-hidden="true" />
                  {t('players.link.action')}
                </Button>
              </Can>
            )}
          </>
        }
      />

      {linkResult === null ? null : (
        <Alert
          tone={linkResult.created ? 'success' : 'info'}
          title={linkResult.created ? t('players.link.created') : t('players.link.alreadyLinked')}
        >
          {t('players.ichancy.login')} <span className="font-mono">{linkResult.ichancyLogin}</span>{' '}
          · {t('players.field.ichancyPlayerId')}{' '}
          <span className="font-mono">{linkResult.ichancyPlayerId}</span> ·{' '}
          {t('players.ichancy.agent')} <span className="font-mono">{linkResult.agentId}</span>
          {linkResult.created ? null : t('players.link.nothingCreated')}
        </Alert>
      )}

      {creditResult === null ? null : (
        <Alert
          tone="success"
          title={
            creditResult.status === 'PENDING_SECOND_APPROVAL'
              ? t('players.credit.secondApprovalTitle')
              : t('players.credit.queuedTitle', { amount: formatMoney(creditResult.amount) })
          }
        >
          {creditResult.status === 'PENDING_SECOND_APPROVAL'
            ? t('players.credit.secondApprovalBody', {
                name,
                amount: formatMoney(creditResult.amount),
              })
            : t('players.credit.queuedBody', { name, amount: formatMoney(creditResult.amount) })}
        </Alert>
      )}

      {debitResult === null ? null : <DebitOutcomeAlert debit={debitResult} player={player} />}

      {debitUnproven == null ? null : (
        /* Kept on the page rather than in the dialog the operator just closed: after a failure
           that may have debited the player anyway, the next person to look at this screen has to
           see it too. */
        <Alert tone="danger" title={t('players.debit.maybeLandedTitle')}>
          <p>{errorMessage(debitUnproven)}</p>
          <p className="mt-1">{t('players.debit.maybeLandedBody')}</p>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PlayerIdentity player={player} />
        </div>
        <div className="lg:col-span-2">
          {can('deposits.read') ? <PlayerDeposits playerId={player.id} /> : null}
        </div>
      </div>

      <LinkIchancyDialog
        player={player}
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onLinked={setLinkResult}
      />

      <CreditPlayerDialog
        player={player}
        open={creditOpen}
        onOpenChange={setCreditOpen}
        onCredited={(credit) => {
          setCreditResult(credit);
          setCreditOpen(false);
        }}
      />

      <DebitPlayerDialog
        player={player}
        open={debitOpen}
        onOpenChange={setDebitOpen}
        onDebited={(debit) => {
          setDebitResult(debit);
          setDebitUnproven(null);
          setDebitOpen(false);
        }}
        onUnproven={(error) => {
          // The dialog stays open on this one; the page keeps saying it after it closes.
          setDebitResult(null);
          setDebitUnproven(error);
        }}
      />
    </div>
  );
}
