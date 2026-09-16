import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { MoneyAmount } from '@/components/common/money-amount';
import { TimeAgo } from '@/components/common/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRefreshTenantFinance } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type {
  AgentFloatCell,
  ShamCashCell,
  TenantFinanceRow,
  UsdtCell,
  UsdtWalletCell,
} from '@/types';

import { financeMessages } from './messages';

/**
 * One row per operator: its slug, its agent float, its USDT wallets and its Sham Cash — each cell
 * rendering its OWN status.
 *
 * The rule the whole screen turns on lives in the cell renderers below: a read that did not land is
 * shown as what it is, never as a `0`. Only the `ok`/`loaded` arms reach `MoneyAmount`; every other
 * arm renders a word. There is no path from a failed read to a figure.
 */
export function FinanceBalancesTable({ rows }: { rows: readonly TenantFinanceRow[] }) {
  const t = useT(financeMessages);

  return (
    <Table>
      <TableCaption>{t('finance.caption', { count: rows.length })}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('finance.col.operator')}</TableHead>
          <TableHead>{t('finance.col.agentFloat')}</TableHead>
          <TableHead>{t('finance.col.usdt')}</TableHead>
          <TableHead>{t('finance.col.shamCash')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.tenantId}>
            <TableCell className="align-top">
              <div className="space-y-1.5">
                <span className="block font-mono text-sm font-medium break-all">{row.slug}</span>
                <RefreshRowButton tenantId={row.tenantId} slug={row.slug} />
              </div>
            </TableCell>
            <TableCell className="align-top">
              <AgentFloatCellView cell={row.agentFloat} />
            </TableCell>
            <TableCell className="align-top">
              <UsdtCellView cell={row.usdt} />
            </TableCell>
            <TableCell className="align-top">
              <ShamCashCellView cell={row.shamCash} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The per-operator refresh. Its own mutation instance per row, so one row's spinner is that row's
 * alone and pressing Refresh on one operator does not busy the others.
 */
function RefreshRowButton({ tenantId, slug }: { tenantId: string; slug: string }) {
  const t = useT(financeMessages);
  const refresh = useRefreshTenantFinance();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t('finance.refreshAria', { slug })}
      loading={refresh.isPending}
      onClick={() => {
        refresh.mutate(tenantId);
      }}
    >
      <RefreshCw className="size-3.5" />
      {t('finance.refreshRow')}
    </Button>
  );
}

// ── Agent float ──────────────────────────────────────────────────────────────────────────────────

function AgentFloatCellView({ cell }: { cell: AgentFloatCell }) {
  const t = useT(financeMessages);

  if (cell.status === 'unavailable') {
    return <FailedRead title={t('finance.unavailable')} detail={cell.detail} />;
  }

  // A genuine figure — including a genuine 0 — and the server's own `isLow` verdict beside it.
  return (
    <div className="space-y-1">
      <MoneyAmount
        money={{ minor: cell.balanceMinor, amount: cell.balance, currency: cell.currencyCode }}
        emphasis
      />
      {cell.isLow ? <Badge tone="danger">{t('agentFloat.low')}</Badge> : null}
    </div>
  );
}

// ── USDT wallets ─────────────────────────────────────────────────────────────────────────────────

function UsdtCellView({ cell }: { cell: UsdtCell }) {
  const t = useT(financeMessages);

  if (cell.status === 'not_loaded') return <NotLoaded />;
  if (cell.wallets.length === 0) {
    return <Muted>{t('finance.usdt.noWallets')}</Muted>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {cell.wallets.map((wallet, index) => (
          <li key={`${wallet.label}-${index}`}>
            <UsdtWalletView wallet={wallet} />
          </li>
        ))}
      </ul>
      <CheckedAt value={cell.checkedAt} />
    </div>
  );
}

function UsdtWalletView({ wallet }: { wallet: UsdtWalletCell }) {
  const t = useT(financeMessages);
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{wallet.label}</span>
        {wallet.network === null ? null : (
          <span className="font-mono text-xs text-[var(--muted-foreground)]">{wallet.network}</span>
        )}
      </div>
      {wallet.status === 'ok' ? (
        <MoneyAmount
          money={{ minor: wallet.balanceMinor, amount: wallet.balance, currency: 'USDT' }}
        />
      ) : (
        <FailedRead title={t('finance.unavailable')} detail={wallet.detail ?? wallet.problem} />
      )}
    </div>
  );
}

// ── Sham Cash ────────────────────────────────────────────────────────────────────────────────────

function ShamCashCellView({ cell }: { cell: ShamCashCell }) {
  const t = useT(financeMessages);

  switch (cell.status) {
    case 'not_loaded':
      return <NotLoaded />;
    // Neither an outage nor a figure: the operator simply has no Sham Cash API key on record.
    case 'not_linked':
      return <Muted>{t('finance.shamCash.notLinked')}</Muted>;
    // A key that exists and is refused. The operator's to fix, and NOT an outage — saying "could
    // not reach" would send them looking at the network instead of at their key.
    case 'unauthorized':
      return <FailedRead title={t('finance.shamCash.unauthorized')} />;
    case 'unavailable':
      return <FailedRead title={t('finance.unavailable')} detail={cell.detail} />;
    case 'ok':
      return (
        <div className="space-y-3">
          <ul className="space-y-1.5">
            {cell.balances.map((balance) => (
              <li key={balance.currency} className="space-y-0.5">
                {/* Server-preformatted strings; shown ltr so the amount and its currency keep their
                    reading order inside an Arabic column. */}
                <span dir="ltr" className="tabular block text-sm whitespace-nowrap">
                  {balance.available} {balance.currency}
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {t('finance.shamCash.locked', {
                    amount: `${balance.locked} ${balance.currency}`,
                  })}
                </span>
              </li>
            ))}
          </ul>
          <CheckedAt value={cell.checkedAt} />
        </div>
      );
  }
}

// ── Shared cell pieces ───────────────────────────────────────────────────────────────────────────

/**
 * Why there is no figure. A warning tone and the word for the state, plus the server's own sentence
 * when it sent one. Deliberately reaches no money helper — nothing here can become a number.
 */
function FailedRead({ title, detail }: { title: string; detail?: string | null }) {
  return (
    <div className="space-y-0.5" data-testid="finance-unread">
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--warning)]">
        <AlertTriangle className="size-3.5 shrink-0" />
        {title}
      </span>
      {detail === null || detail === undefined || detail === '' ? null : (
        <p className="max-w-xs text-xs text-[var(--muted-foreground)]">{detail}</p>
      )}
    </div>
  );
}

function NotLoaded() {
  const t = useT(financeMessages);
  return (
    <div className="space-y-0.5" data-testid="finance-unread">
      <span className="text-sm text-[var(--muted-foreground)]">{t('finance.notLoaded')}</span>
      <p className="max-w-xs text-xs text-[var(--muted-foreground)]">
        {t('finance.notLoadedHint')}
      </p>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <span className="text-sm text-[var(--muted-foreground)]" data-testid="finance-unread">
      {children}
    </span>
  );
}

function CheckedAt({ value }: { value: string }) {
  const t = useT(financeMessages);
  return (
    <TimeAgo
      value={value}
      prefix={t('finance.checked')}
      className="text-xs text-[var(--muted-foreground)]"
    />
  );
}
