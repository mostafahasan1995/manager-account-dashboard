import {
  CopyableValue,
  DetailList,
  DetailRow,
  PlayerStatusBadge,
  TimeAgo,
} from '@/components/common';
import { Badge, Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui';
import { useFormatters } from '@/lib/i18n/use-format';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { isImportedPlayer, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * Everything the backend knows about one player, in the order support needs it.
 *
 * Nulls render as an em dash rather than as an empty row: "we have no phone number for this
 * player" and "this panel forgot to render the phone number" have to look different when somebody
 * is deciding whether the person on the phone is who they say they are.
 */

const orDash = (value: string | null | undefined) =>
  value == null || value.trim().length === 0 ? '—' : value;

export function PlayerIdentity({ player }: { player: AdminPlayer }) {
  const t = useT(playerMessages);
  const enumLabel = useEnumLabel();
  const formatters = useFormatters();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('players.identity.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailList>
          <DetailRow label={t('players.field.playerId')}>
            <CopyableValue value={player.id} />
          </DetailRow>
          <DetailRow label={t('field.telegramId')}>
            {player.telegramUserId === null ? '—' : <CopyableValue value={player.telegramUserId} />}
          </DetailRow>
          <DetailRow label={t('field.username')}>
            {player.telegramUsername == null ? '—' : `@${player.telegramUsername}`}
          </DetailRow>
          <DetailRow label={t('players.field.firstName')}>{orDash(player.firstName)}</DetailRow>
          <DetailRow label={t('players.field.lastName')}>{orDash(player.lastName)}</DetailRow>
          <DetailRow label={t('players.field.phone')}>
            {player.phone == null ? '—' : <CopyableValue value={player.phone} />}
          </DetailRow>
          <DetailRow label={t('players.field.language')}>{orDash(player.languageCode)}</DetailRow>
          <DetailRow label={t('field.status')}>
            <PlayerStatusBadge status={player.status} />
          </DetailRow>
          <DetailRow label={t('players.field.source')}>
            {/* An "old player" says when Ichancy first knew them, which is the date that matters
                for a row the bot has never seen; the other sources are a word. */}
            {isImportedPlayer(player) && player.ichancyRegisteredAt != null
              ? t('players.source.importedOn', {
                  date: formatters.dateTime(player.ichancyRegisteredAt),
                })
              : enumLabel('playerSource', player.source)}
          </DetailRow>
          <DetailRow label={t('field.currency')}>
            <span className="tabular">{player.currencyCode}</span>
          </DetailRow>
          <DetailRow label={t('field.created')}>
            <TimeAgo value={player.createdAt} />
          </DetailRow>
          <DetailRow label={t('players.field.lastSeen')}>
            <TimeAgo value={player.lastSeenAt} />
          </DetailRow>
        </DetailList>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {t('players.identity.ichancyAccount')}
          </h3>
          <DetailList>
            <DetailRow label={t('players.field.linked')}>
              <Badge tone={player.ichancyLinked ? 'success' : 'warning'}>
                {player.ichancyLinked
                  ? t('players.ichancy.linked')
                  : t('players.ichancy.notLinked')}
              </Badge>
            </DetailRow>
            <DetailRow label={t('players.field.ichancyPlayerId')}>
              {player.ichancyPlayerId == null ? (
                '—'
              ) : (
                <CopyableValue value={player.ichancyPlayerId} />
              )}
            </DetailRow>
            <DetailRow label={t('players.field.ichancyLogin')}>
              {player.ichancyLogin == null ? '—' : <CopyableValue value={player.ichancyLogin} />}
            </DetailRow>
            <DetailRow label={t('players.field.registered')}>
              <TimeAgo value={player.ichancyRegisteredAt} />
            </DetailRow>
          </DetailList>
        </div>
      </CardContent>
    </Card>
  );
}
