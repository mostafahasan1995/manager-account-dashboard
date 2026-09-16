import { CopyableValue, DetailList, DetailRow, MinorAmount } from '@/components/common';
import { Alert, type AlertProps } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorString } from '@/lib/money';
import { PLAYER_DEBIT_STATUS_TONES, type Tone } from '@/types/enums';
import { playerDisplayName, type AdminPlayer, type PlayerDebit } from '@/types/player';

import { playerMessages, usePlayerEnumLabel } from './messages';

/**
 * What a debit did, left on the screen after the dialog has gone.
 *
 * A toast is not enough for this one. The three endings mean three different jobs — nothing to do,
 * take the money out of the float, or go and read the real balance in Ichancy before anybody
 * touches it again — and the operator has to still be able to see which one they got after they
 * have looked away and come back. So it stays on the page with the figures attached.
 */
export function DebitOutcomeAlert({ debit, player }: { debit: PlayerDebit; player: AdminPlayer }) {
  const t = useT(playerMessages);
  const enumLabel = usePlayerEnumLabel();

  const name = playerDisplayName(player);
  const currency = player.currencyCode;
  const amount = formatMinorString(debit.amountMinor, currency);
  const before = formatMinorString(debit.playerBalanceBeforeMinor, currency);
  const after = formatMinorString(debit.playerBalanceAfterMinor, currency);

  /*
   * A status this console has never heard of reads as the unconfirmed one, not as a success. The
   * whole point of the third ending is that nobody knows yet — which is exactly the position an
   * unrecognised status leaves us in.
   */
  const { title, body } =
    debit.status === 'DEBITED'
      ? {
          title: t('players.debit.doneTitle', { amount }),
          body: t('players.debit.doneBody', { name, before, after, amount }),
        }
      : debit.status === 'REJECTED'
        ? {
            title: t('players.debit.refusedTitle'),
            body: t('players.debit.refusedBody', { name, after }),
          }
        : {
            title: t('players.debit.unsureTitle'),
            body: t('players.debit.unsureBody', {
              status: enumLabel('debit.status', debit.status),
            }),
          };

  return (
    <Alert tone={alertTone(debit.status)} title={title}>
      <p>{body}</p>

      {/* The figures again, as figures: tabular, direction-pinned, and not embedded in a sentence
          the bidi algorithm can rearrange around a minus sign. */}
      <DetailList className="mt-2">
        <DetailRow label={t('players.debit.field.balanceBefore')}>
          <MinorAmount minor={debit.playerBalanceBeforeMinor} currency={currency} />
        </DetailRow>
        <DetailRow label={t('players.debit.field.balanceAfter')}>
          <MinorAmount minor={debit.playerBalanceAfterMinor} currency={currency} />
        </DetailRow>
        <DetailRow label={t('players.debit.field.verifiedBy')}>
          {debit.verifiedBy === null
            ? t('players.debit.verifiedBy.unconfirmed')
            : enumLabel('debit.verifiedBy', debit.verifiedBy)}
        </DetailRow>
        <DetailRow label={t('field.reason')}>{debit.reason}</DetailRow>
        <DetailRow label={t('players.debit.field.debitId')}>
          <CopyableValue value={debit.debitId} />
        </DetailRow>
      </DetailList>
    </Alert>
  );
}

/** The shared tone table, mapped onto the tones an alert actually has a variant for. */
function alertTone(status: string): NonNullable<AlertProps['tone']> {
  const tone = (PLAYER_DEBIT_STATUS_TONES as Record<string, Tone | undefined>)[status];
  return tone === undefined || tone === 'muted' ? 'neutral' : tone;
}
