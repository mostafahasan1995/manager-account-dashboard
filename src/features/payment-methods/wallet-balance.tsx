import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Can, MoneyAmount } from '@/components/common';
import { TimeAgo } from '@/components/common/time';
import { Alert, Button } from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useWalletBalance } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, minorFromString } from '@/lib/money';
import type { MoneyView } from '@/types/api';
import type { WalletBalance as WalletBalanceView } from '@/types/payment-method';

import { railMessages, type RailTranslator } from './messages';

/**
 * What the chain says one payout wallet holds — the operator's own USDT, on their own address.
 *
 * ══ THE ONE RULE ══════════════════════════════════════════════════════════════════════════════
 * "We could not read the balance" must never render as `0`.
 *
 * Zero is a real answer with real consequences: it says the wallet is empty, and an operator who
 * reads that acts on it. An outage displayed as "0.00 USDT" is therefore the most alarming false
 * statement this screen can make to somebody whose money is in that wallet — it says their money is
 * gone. So the two are kept structurally apart rather than by care: `readableAmount` is the ONLY
 * path to a figure on this card, it returns `null` for every answer that is not a number, and null
 * renders the unavailable state. There is no code path that can turn silence into a digit.
 *
 * The backend agrees: it answers `200` with `balanceMinor: null` rather than a zero or a 5xx,
 * because the request was fine and it is the ANSWER that is missing — see `walletBalanceSchema`.
 *
 * ══ WHY THIS IS ITS OWN FILE ══════════════════════════════════════════════════════════════════
 * It is dropped into the USDT rail card, which is owned elsewhere. Self-contained on purpose: one
 * prop, its own query, its own four states, its own refresh. The card decides where it goes and
 * nothing else.
 */
export function WalletBalance({ destinationId }: { destinationId: string }) {
  return (
    <Can capability="paymentMethods.read">
      <WalletBalanceBody destinationId={destinationId} />
    </Can>
  );
}

function WalletBalanceBody({ destinationId }: { destinationId: string }) {
  const t = useT(railMessages);
  const query = useWalletBalance(destinationId);

  let content: ReactNode;
  if (query.isPending) {
    content = (
      <p className="text-sm text-[var(--muted-foreground)]">{t('rails.walletBalance.loading')}</p>
    );
  } else if (query.isError) {
    // A request that never arrived is not a zero either. Same state, and the server's own words
    // where the chain's would have been.
    content = (
      <Unavailable
        t={t}
        detail={errorMessage(query.error)}
        problem={isApiError(query.error) ? query.error.code : null}
      />
    );
  } else {
    const money = readableAmount(query.data);
    content =
      money === null ? (
        <Unavailable t={t} detail={query.data.detail} problem={query.data.problem} />
      ) : (
        <MoneyAmount money={money} emphasis className="text-lg" />
      );
  }

  const checkedAt = query.data?.checkedAt;

  return (
    <section className="space-y-2" data-testid="wallet-balance">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {t('rails.walletBalance.label')}
        </p>
        {/*
         * One button for both jobs. Refreshing a number that read and retrying one that did not are
         * the same act to an operator — press it and ask the chain again — and giving them two
         * controls would be inventing a distinction they do not have.
         */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void query.refetch()}
          loading={query.isFetching}
        >
          <RefreshCw className="size-3.5" />
          {t('rails.walletBalance.refresh')}
        </Button>
      </div>

      {content}

      {checkedAt === undefined ? null : (
        <p className="text-xs text-[var(--muted-foreground)]">
          <TimeAgo value={checkedAt} prefix={t('rails.walletBalance.checked')} />
        </p>
      )}

      <p className="text-xs text-[var(--muted-foreground)]">{t('rails.walletBalance.hint')}</p>
    </section>
  );
}

/**
 * The amount to show, or `null` when there is no amount to show.
 *
 * The single gate described in the header. It reads the MINOR units through `money.ts` — the one
 * place in this console that turns minor units into a decimal — at the scale the response carries
 * rather than the default two, because USDT has six and a balance rendered two decimals short is
 * off by a factor of ten thousand.
 */
function readableAmount(balance: WalletBalanceView): MoneyView | null {
  const minor = balance.balanceMinor;
  if (minor === null) return null;

  try {
    return {
      minor,
      amount: formatMinorToDecimal(minorFromString(minor), balance.scale),
      currency: balance.asset,
    };
  } catch {
    // Minor units this console cannot parse are not zero: they are a number nobody has. Falling
    // through to null puts the card in the state that says so, which is the honest one.
    return null;
  }
}

/**
 * Why there is no figure.
 *
 * Three sentences, in falling order of who wrote them: ours, which carries the rule in the reader's
 * own language; the server's, which says what actually went wrong and is shown as it arrived
 * because a machine code alone tells an operator nothing; and the code itself, which is what gets
 * quoted in a support message.
 */
function Unavailable({
  detail,
  problem,
  t,
}: {
  detail: string | null;
  problem: string | null;
  t: RailTranslator;
}) {
  return (
    <Alert tone="warning" title={t('rails.walletBalance.unavailableTitle')}>
      <p>{t('rails.walletBalance.unavailableBody')}</p>
      {detail === null ? null : <p className="mt-1">{detail}</p>}
      {problem === null ? null : <p className="mt-1 font-mono text-xs">{problem}</p>}
    </Alert>
  );
}
