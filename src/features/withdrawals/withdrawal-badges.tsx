import { Badge } from '@/components/ui/badge';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { WalletCheck } from '@/types';
import {
  WALLET_CHECK_STATUS_TONES,
  WITHDRAWAL_STATUS_TONES,
  type Tone,
  type WalletCheckStatus,
  type WithdrawalStatus,
} from '@/types/enums';

import { withdrawalMessages } from './messages';

/**
 * The three chips this screen is read by: status, mode, and what the payout wallet held.
 *
 * Status is always a WORD plus a colour, never a colour alone — and the props are `string`, not the
 * enum unions, so a status the backend adds tomorrow renders as itself in a neutral badge rather
 * than disappearing off a screen that decides whether somebody gets paid.
 */

const toneOf = <T extends string>(value: string, tones: Record<T, Tone>): Tone =>
  (tones as Record<string, Tone | undefined>)[value] ?? 'neutral';

export function WithdrawalStatusBadge({ status }: { status: string }) {
  const label = useEnumLabel();
  return (
    <Badge tone={toneOf<WithdrawalStatus>(status, WITHDRAWAL_STATUS_TONES)}>
      {label('withdrawalStatus', status)}
    </Badge>
  );
}

/** AUTO reads as information, MANUAL as the plain default: neither is a warning. */
export function WithdrawalModeChip({ mode }: { mode: string }) {
  const label = useEnumLabel();
  return <Badge tone={mode === 'AUTO' ? 'info' : 'neutral'}>{label('withdrawalMode', mode)}</Badge>;
}

/**
 * What the payout wallet held when the debit landed — or that nobody has asked yet.
 *
 * `null` is "not checked", muted: the check is taken once, after the debit, so a REQUESTED row has
 * no wallet check and that is not a problem to colour.
 */
export function WalletCheckChip({ check }: { check: Pick<WalletCheck, 'status'> | null }) {
  const t = useT(withdrawalMessages);
  const label = useEnumLabel();

  if (check === null) {
    return <Badge tone="muted">{t('withdrawals.walletCheck.notTaken')}</Badge>;
  }

  return (
    <Badge tone={toneOf<WalletCheckStatus>(check.status, WALLET_CHECK_STATUS_TONES)}>
      {label('walletCheckStatus', check.status)}
    </Badge>
  );
}

/** `TRC20`, `BEP20` — a chain name, the same in every language, so a plain neutral chip. */
export function NetworkChip({ network }: { network: string | null }) {
  if (network === null) return null;
  return (
    <Badge tone="neutral" className="font-mono">
      {network}
    </Badge>
  );
}
