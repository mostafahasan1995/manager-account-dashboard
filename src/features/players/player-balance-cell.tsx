import { RefreshCw } from 'lucide-react';

import { MinorAmount } from '@/components/common';
import { Button } from '@/components/ui';
import { usePlayerBalance } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * One player's Ichancy balance, in one table cell.
 *
 * ── WHY A COMPONENT PER ROW RATHER THAN ONE FETCH FOR THE PAGE ────────────────────────────────
 * There is no bulk balance endpoint. Verified against a real logged response: Ichancy's player list
 * answers with `playerId, username, currency, affiliateId, phoneNumber, registerDate` and no
 * balance at all. So a column of balances is one upstream call PER ROW, each through Cloudflare,
 * seconds apart and rate-limited.
 *
 * That makes per-row the honest shape: each cell owns its own request, its own spinner and its own
 * failure. One request for the page would mean one spinner for the page and — worse — one failure
 * for the page, so a single slow player would blank every balance next to it. The shared limiter in
 * `playersApi.balance` is what stops "per row" becoming a burst.
 *
 * ── A FAILED READ IS NEVER A NUMBER ───────────────────────────────────────────────────────────
 * This is the rule the whole cell exists to keep. `0` and "we could not find out" look identical in
 * a table cell and lead to opposite decisions: one says the account is empty, the other says
 * nothing at all — and this cell sits next to buttons that move real money. So a failure renders as
 * a word plus a retry, never as a figure, and the backend answers 503 rather than a zero for the
 * same reason.
 */
export function PlayerBalanceCell({
  player,
  enabled,
}: {
  player: AdminPlayer;
  /** False while the page is waiting for an explicit "load balances" — see PlayerTable. */
  enabled: boolean;
}) {
  const t = useT(playerMessages);

  /*
   * A player with no Ichancy account has no balance to read, and asking would spend a request to be
   * told so. The backend refuses it deliberately (it will not open an account as a side effect of a
   * read), so this is not an optimisation — it is not asking a question whose answer we already
   * hold.
   */
  const linked = player.ichancyPlayerId !== null;
  const query = usePlayerBalance(player.id, { enabled: enabled && linked });

  if (!linked) {
    return <span className="text-[var(--muted-foreground)]">{t('players.balance.notLinked')}</span>;
  }

  if (!enabled) {
    return <span className="text-[var(--muted-foreground)]">—</span>;
  }

  if (query.isPending) {
    return (
      <span className="text-[var(--muted-foreground)]" aria-live="polite">
        {t('players.balance.loading')}
      </span>
    );
  }

  if (query.isError) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {/* The word, not a number. See the header. */}
        <span className="text-[var(--danger)]">{t('players.balance.unknown')}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void query.refetch()}
          aria-label={t('players.balance.retryFor', { name: player.telegramUserId })}
        >
          <RefreshCw className="size-3" />
        </Button>
      </span>
    );
  }

  return (
    <MinorAmount
      minor={query.data.balanceMinor}
      currency={query.data.currencyCode}
      className="font-medium"
    />
  );
}
