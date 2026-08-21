import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, UserPlus } from 'lucide-react';
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
import { isApiError } from '@/lib/api/errors';
import { usePlayer } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import { playerDisplayName, type IchancyAccount } from '@/types/player';

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
          {t('players.ichancy.login')}{' '}
          <span className="font-mono">{linkResult.ichancyLogin}</span> ·{' '}
          {t('players.field.ichancyPlayerId')}{' '}
          <span className="font-mono">{linkResult.ichancyPlayerId}</span> ·{' '}
          {t('players.ichancy.agent')} <span className="font-mono">{linkResult.agentId}</span>
          {linkResult.created ? null : t('players.link.nothingCreated')}
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
    </div>
  );
}
