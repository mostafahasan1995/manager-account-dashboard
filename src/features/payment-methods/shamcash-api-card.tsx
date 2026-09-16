import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  useClearShamCashApi,
  useSetShamCashApi,
  useShamCashStatus,
  useTestShamCashApi,
} from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { ShamCashTestResult } from '@/types';

import { railMessages } from './messages';

/**
 * The Sham Cash HTTP API key.
 *
 * ══ THE TWO FIELDS ARE NOT THE SAME KIND OF THING ════════════════════════════════════════════
 * The wallet id is an ADDRESS — the path segment in `/wallets/shamcash/<id>/transactions` — and the
 * key is a SECRET. That is why one is echoed back and the other never is, and why a wrong wallet id
 * produces a 404 on every call while a wrong key produces a 401. They are saved together because
 * neither half is usable alone, not because they are the same sort of value.
 *
 * ══ WHY THE KEY FIELD IS NEVER PREFILLED ═════════════════════════════════════════════════════
 * Nothing in this console can read it back — the backend seals it and no endpoint returns it. So
 * the field starts empty even when a key IS configured, and the badge is what says one exists.
 * Saving replaces it; there is no partial edit, because there is nothing to edit from.
 *
 * The WALLET ID is prefilled, because it is not a credential and an operator needs to check what
 * was saved against their Sham Cash dashboard.
 */
export function ShamCashApiCard() {
  const t = useT(railMessages);
  const status = useShamCashStatus();
  const save = useSetShamCashApi();
  const clear = useClearShamCashApi();
  const test = useTestShamCashApi();

  const linked = status.data?.apiLinked === true;
  const [walletId, setWalletId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [open, setOpen] = useState(false);

  // The saved wallet id is the field's starting value until the operator types over it. Read on
  // every render rather than seeded into state, so a save elsewhere is reflected without a remount.
  const walletValue = open ? walletId : (status.data?.walletId ?? '');
  const canSave = walletValue.trim().length > 0 && apiKey.trim().length > 0;

  const submit = () => {
    if (!canSave) return;

    void (async () => {
      try {
        await save.mutateAsync({ walletId: walletValue.trim(), apiKey: apiKey.trim() });
        toast.success(t('financial.shamcashApi.saved'));
        // CLEARED from memory the moment it is stored. It cannot be read back, so holding it in a
        // React state that survives the form is a copy with no purpose and one more place to leak.
        setApiKey('');
        setOpen(false);
      } catch (caught) {
        toast.error(t('financial.shamcashApi.saveFailed'), { description: errorMessage(caught) });
      }
    })();
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('financial.shamcashApi.title')}</CardTitle>
        {linked ? (
          <Badge tone="success">{t('financial.shamcashApi.linkedBadge')}</Badge>
        ) : (
          <Badge tone="muted">{t('financial.shamcashApi.notLinkedBadge')}</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">{t('financial.shamcashApi.body')}</p>

        {linked ? null : (
          <Alert tone="info" title={t('financial.shamcashApi.whyTitle')}>
            {t('financial.shamcashApi.whyBody')}
          </Alert>
        )}

        <Can capability="paymentMethods.write">
          {open ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="shamcash-wallet">{t('financial.shamcashApi.walletId')}</Label>
                <Input
                  id="shamcash-wallet"
                  value={walletValue}
                  autoComplete="off"
                  placeholder="4c326c62cd11f1a72e10bbc9c41e90c8"
                  onChange={(event) => {
                    setWalletId(event.target.value);
                  }}
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t('financial.shamcashApi.walletIdHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shamcash-key">{t('financial.shamcashApi.apiKey')}</Label>
                <Input
                  id="shamcash-key"
                  // `password`, not text: this is read off a screen in an office, and it is the one
                  // value here that must not be shoulder-surfed or captured in a screen share.
                  type="password"
                  value={apiKey}
                  autoComplete="off"
                  onChange={(event) => {
                    setApiKey(event.target.value);
                  }}
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  {linked
                    ? t('financial.shamcashApi.apiKeyReplaceHint')
                    : t('financial.shamcashApi.apiKeyHint')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={save.isPending}
                  disabled={!canSave}
                  onClick={submit}
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setApiKey('');
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setWalletId(status.data?.walletId ?? '');
                  setOpen(true);
                }}
              >
                {linked ? t('financial.shamcashApi.replace') : t('financial.shamcashApi.link')}
              </Button>

              {linked ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={test.isPending}
                  onClick={() => {
                    void test.mutateAsync().catch(() => undefined);
                  }}
                >
                  {t('financial.shamcashApi.test')}
                </Button>
              ) : null}

              {linked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={clear.isPending}
                  onClick={() => {
                    void clear
                      .mutateAsync()
                      .then(() => {
                        toast.success(t('financial.shamcashApi.cleared'));
                      })
                      .catch((caught: unknown) => {
                        toast.error(t('financial.shamcashApi.saveFailed'), {
                          description: errorMessage(caught),
                        });
                      });
                  }}
                >
                  {t('financial.shamcashApi.unlink')}
                </Button>
              ) : null}
            </div>
          )}
        </Can>

        {linked && !open ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('financial.shamcashApi.walletLabel', {
              wallet: status.data?.walletId ?? '—',
            })}
          </p>
        ) : null}

        {test.isError ? (
          <Alert tone="danger" title={t('financial.shamcashApi.testFailed')}>
            {errorMessage(test.error)}
          </Alert>
        ) : test.data === undefined ? null : (
          <TestResult result={test.data} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What the live test found.
 *
 * ══ WHY THE TWO HALVES ARE DRAWN APART ═══════════════════════════════════════════════════════
 * The balance and the transaction list are different endpoints and can fail apart. A single ✅
 * would hide the case this test exists to catch: a key that reads the balance fine while lookups —
 * the thing `/checkpay` depends on — are refused or down.
 */
function TestResult({ result }: { result: ShamCashTestResult }) {
  const t = useT(railMessages);

  if (result.status === 'not_linked') {
    return <Alert tone="neutral">{t('financial.shamcashApi.testNotLinked')}</Alert>;
  }
  if (result.status === 'unauthorized') {
    return <Alert tone="danger" title={t('financial.shamcashApi.testRejected')} />;
  }

  const { balance, transactions } = result;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div className="space-y-1">
        <p className="text-xs font-medium">{t('financial.shamcashApi.testBalance')}</p>
        {balance.status === 'ok' ? (
          <ul className="space-y-0.5">
            {balance.balances.map((row) => (
              // ltr on the numbers: an amount and its currency must not be reordered by the
              // console's own direction — the operator is comparing this against Sham Cash's screen.
              <li key={row.currency} dir="ltr" className="text-sm tabular-nums">
                {row.available} {row.currency}
                {row.locked === '0' ? null : (
                  <span className="text-[var(--muted-foreground)]"> ({row.locked} locked)</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--danger)]">
            {balance.status === 'unavailable' ? balance.detail : balance.status}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">{t('financial.shamcashApi.testTransactions')}</p>
        {transactions.status === 'ok' ? (
          transactions.sample.length === 0 ? (
            // Reachable AND empty is a pass, not a failure: a brand-new wallet has no operations,
            // and calling that broken would send an operator hunting for a problem they do not have.
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('financial.shamcashApi.testNoTransactions')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {transactions.sample.map((tx) => (
                <li key={tx.id} dir="ltr" className="text-sm tabular-nums">
                  {tx.type === 'credit' ? '+' : '−'}
                  {tx.amount} {tx.currency}
                  <span className="text-[var(--muted-foreground)]"> · {tx.occurredAt}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-sm text-[var(--danger)]">{transactions.detail}</p>
        )}
      </div>
    </div>
  );
}
