import { LinkIcon, RefreshCw, Unlink } from 'lucide-react';

import { TimeAgo } from '@/components/common/time';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api/errors';
import {
  useRefreshShamCashAccount,
  useShamCashAccount,
  useUnlinkShamCashAccount,
} from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { shamCashDevMessages } from './messages';
import { ParsedBalances, ParsedTransactions } from './parsed-tables';

/**
 * THE ACCOUNT, once it is linked. Balances, transfers, and a Refresh.
 *
 * ══ WHY THERE IS NO TIMER ═════════════════════════════════════════════════════════════════════
 * A refresh drives a real browser at shamcash.sy on the API side. A poll every few seconds would
 * drive it forever, whether or not anybody was looking, for figures that change when a person does
 * something rather than on a clock. So the numbers are read when asked for, and the LAST ones stay
 * on screen with the time they were read until somebody asks again.
 *
 * ══ WHY THE AGE IS ALWAYS ON SCREEN ═══════════════════════════════════════════════════════════
 * Every figure here is a cached read. A balance shown without an age is a claim about NOW, and the
 * one thing this screen must never do is let somebody act on a ten-minute-old number believing it
 * is current. `TimeAgo` beside the heading is not decoration — it is the qualifier that makes the
 * rest of the card honest.
 */
export function ShamCashAccountPanel({ onRelink }: { onRelink: () => void }) {
  const t = useT(shamCashDevMessages);

  const account = useShamCashAccount();
  const refresh = useRefreshShamCashAccount();
  const unlink = useUnlinkShamCashAccount();

  if (account.isPending) return <CardSkeleton />;

  if (account.isError) {
    return (
      <Card>
        <ErrorState
          error={account.error}
          onRetry={() => {
            void account.refetch();
          }}
        />
      </Card>
    );
  }

  const { linked, snapshot } = account.data;

  /*
   * NOTHING LINKED AND NOTHING CACHED is the only state that hides the account entirely. The
   * screen's whole job then is one button, which is what the caller renders above this.
   */
  if (!linked && snapshot === null) {
    return (
      <Card>
        <EmptyState
          title={t('shamDev.account.emptyTitle')}
          description={t('shamDev.account.emptyBody')}
          action={
            <Button type="button" onClick={onRelink}>
              <LinkIcon className="size-4" />
              {t('shamDev.account.link')}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('shamDev.account.title')}</CardTitle>
            <CardDescription>
              {snapshot === null ? (
                t('shamDev.account.neverRead')
              ) : (
                <>
                  {t('shamDev.account.readAt')} <TimeAgo value={snapshot.checkedAt} />
                </>
              )}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={refresh.isPending}
              onClick={() => {
                refresh.mutate();
              }}
            >
              <RefreshCw className="size-4" />
              {t('shamDev.account.refresh')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={unlink.isPending}
              onClick={() => {
                unlink.mutate();
              }}
            >
              <Unlink className="size-4" />
              {t('shamDev.account.unlink')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-0">
        {/*
         * THE SESSION IS GONE BUT THE NUMBERS REMAIN. Said plainly, with the link button, because
         * the figures below are still on screen and somebody has to know they will not update.
         */}
        {!linked ? (
          <div className="px-6">
            <Alert tone="warning" title={t('shamDev.account.sessionClosed')}>
              <span className="flex flex-wrap items-center gap-2">
                {t('shamDev.account.sessionClosedBody')}
                <Button type="button" variant="secondary" size="sm" onClick={onRelink}>
                  <LinkIcon className="size-4" />
                  {t('shamDev.account.link')}
                </Button>
              </span>
            </Alert>
          </div>
        ) : null}

        {refresh.isError ? (
          <div className="px-6">
            <Alert tone="danger" title={t('shamDev.account.refreshFailed')}>
              <span className="flex flex-wrap items-center gap-2">
                {errorMessage(refresh.error)}
                <Button type="button" variant="secondary" size="sm" onClick={onRelink}>
                  <LinkIcon className="size-4" />
                  {t('shamDev.account.link')}
                </Button>
              </span>
            </Alert>
          </div>
        ) : null}

        {snapshot === null ? (
          <div className="px-6">
            <EmptyState
              title={t('shamDev.account.neverRead')}
              description={t('shamDev.account.neverReadBody')}
            />
          </div>
        ) : (
          <>
            <ParsedBalances balances={snapshot.balances} />
            <ParsedTransactions transactions={snapshot.transactions} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
