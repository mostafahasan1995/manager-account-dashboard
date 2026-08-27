import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { CopyableValue } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useDepositChainCheck } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { ChainCheckOutcome, DepositChainCheck } from '@/types';

import { arrivedAsMoney } from './chain-money';
import { depositMessages } from './messages';

/**
 * What the chain says about the deposit being reviewed — until now this verdict reached only the
 * Telegram admin card, so an admin working in this console could not see "99.5 USDT arrived, worth
 * X NSP" and had to reach for a calculator and the rate.
 *
 * ══ TWO OUTCOMES CARRY THE WEIGHT, AND THEY PULL IN OPPOSITE DIRECTIONS ═══════════════════════
 *
 *   - `suspect` is the dangerous one BECAUSE it looks good. The transfer is real, it is confirmed,
 *     it is for the right amount — everything a reviewer checks is present — and it paid somebody
 *     else's wallet. It gets the danger tone and a title that says stop, because a warning that
 *     reads like the other warnings is one a busy reviewer approves past.
 *
 *   - `unavailable` must never read as a refusal. Our node did not answer; the deposit is exactly
 *     as good or as bad as it was before we asked. Rendered as a NEUTRAL notice with no verdict
 *     language in it — a red box here would turn an outage of ours into an accusation against a
 *     player, which is the same class of lie as showing an unreadable wallet balance as `0`.
 *
 * `skipped` renders nothing at all. Most deposits are cash and bank transfers with no chain behind
 * them, and a panel saying "not applicable" on every one of them is how a reviewer learns to skip
 * this whole section.
 *
 * Self-contained on purpose, like `WalletBalance`: one prop, its own query, its own states. The
 * approve dialog reads the same query key, so opening it costs nothing.
 */
export function ChainVerdict({ depositId }: { depositId: string }) {
  const t = useT(depositMessages);
  const query = useDepositChainCheck(depositId);

  if (query.isPending) {
    return (
      <VerdictSection title={t('deposits.section.chain')}>
        <p className="text-sm text-[var(--muted-foreground)]">{t('deposits.chain.loading')}</p>
      </VerdictSection>
    );
  }

  // A request that never arrived is our outage too, and says exactly as little about the deposit as
  // a chain node that timed out. Same state, deliberately: there is no path here from "we failed to
  // ask" to anything that reads as a finding against the player.
  if (query.isError) {
    return (
      <VerdictSection
        title={t('deposits.section.chain')}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        refreshLabel={t('deposits.chain.refresh')}
      >
        <Alert tone={TONES.unavailable} title={t('deposits.chain.unavailable.title')}>
          {t('deposits.chain.unavailable.body')}
        </Alert>
      </VerdictSection>
    );
  }

  const verdict = query.data;
  if (verdict.outcome === 'skipped') return null;

  return (
    <VerdictSection
      title={t('deposits.section.chain')}
      onRefresh={() => void query.refetch()}
      refreshing={query.isFetching}
      refreshLabel={t('deposits.chain.refresh')}
    >
      <Alert tone={TONES[verdict.outcome]} title={t(`deposits.chain.${verdict.outcome}.title`)}>
        <p>{t(`deposits.chain.${verdict.outcome}.body`)}</p>
        {/* The server's own sentence, second: it names the specifics — which wallet, how short, how
            deep — that a translated rule cannot carry. */}
        <p className="mt-1">{verdict.summary}</p>
      </Alert>

      <VerdictFacts verdict={verdict} />

      <p className="text-xs text-[var(--muted-foreground)]">
        <TimeAgo value={verdict.checkedAt} prefix={t('deposits.chain.checked')} />
      </p>
    </VerdictSection>
  );
}

/**
 * The tone each outcome is allowed to wear.
 *
 * A table rather than a chain of ternaries so the two rules the feature exists for are visible in
 * one place: `suspect` is DANGER and `unavailable` is NEUTRAL. An outcome the backend adds later has
 * no entry and the compiler says so, which is the point — a new verdict must be given a tone by a
 * person, not silently inherit whatever the last branch was.
 */
const TONES: Record<ChainCheckOutcome, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'info',
  mismatch: 'warning',
  suspect: 'danger',
  missing: 'warning',
  unavailable: 'neutral',
  // Never rendered — the component returns null first — but a tone is still owed to the type.
  skipped: 'neutral',
};

function VerdictFacts({ verdict }: { verdict: DepositChainCheck }) {
  const t = useT(depositMessages);
  const arrived = arrivedAsMoney(verdict.arrived);

  return (
    <DetailList>
      {arrived === null ? null : (
        <DetailRow label={t('deposits.chain.arrived')}>
          <MoneyAmount money={arrived} emphasis />
        </DetailRow>
      )}
      {verdict.creditable === null ? null : (
        <DetailRow label={t('deposits.chain.creditable')}>
          <MoneyAmount money={verdict.creditable} emphasis />
        </DetailRow>
      )}
      {verdict.network === null ? null : (
        <DetailRow label={t('deposits.chain.network')}>{verdict.network}</DetailRow>
      )}
      {verdict.confirmations === null || verdict.requiredConfirmations === null ? null : (
        <DetailRow label={t('deposits.chain.confirmations')}>
          <span className="tabular">
            {t('deposits.chain.confirmationsValue', {
              confirmations: verdict.confirmations,
              required: verdict.requiredConfirmations,
            })}
          </span>
        </DetailRow>
      )}
      {verdict.txHash === null ? null : (
        <DetailRow label={t('deposits.chain.txHash')}>
          <CopyableValue value={verdict.txHash} />
        </DetailRow>
      )}
      {verdict.fromAddress === null ? null : (
        <DetailRow label={t('deposits.chain.from')}>
          <CopyableValue value={verdict.fromAddress} />
        </DetailRow>
      )}
    </DetailList>
  );
}

function VerdictSection({
  title,
  children,
  onRefresh,
  refreshing = false,
  refreshLabel,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}) {
  return (
    <section className="space-y-2" data-testid="chain-verdict">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {title}
        </h3>
        {onRefresh === undefined ? null : (
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={refreshing}>
            <RefreshCw className="size-3.5" />
            {refreshLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
