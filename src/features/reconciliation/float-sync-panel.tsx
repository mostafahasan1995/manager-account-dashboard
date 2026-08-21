import { useNavigate } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api/errors';
import { useSyncFloat } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { reconMessages } from './messages';

/**
 * Re-reads the agent wallet from Ichancy and compares it with the ledger.
 *
 * Two of the outcomes are alerts rather than numbers. A float below the low watermark means the
 * agent will start failing player credits shortly, and `ichancyMinor: null` means Ichancy could not
 * be read at all — which is not a missing value to be shown as a dash but the finding itself, and
 * the one case where the console genuinely does not know whether the books agree.
 */
export function FloatSyncPanel() {
  const sync = useSyncFloat();
  const navigate = useNavigate();
  const t = useT(reconMessages);
  const result = sync.data;

  const run = () => {
    sync.mutate(undefined, {
      onSuccess: (outcome) => {
        toast.success(
          outcome.ichancyMinor === null
            ? t('recon.float.syncedNoIchancy')
            : t('recon.float.synced'),
        );
      },
      onError: (error) => {
        toast.error(t('recon.float.syncError'), { description: errorMessage(error) });
      },
    });
  };

  return (
    <Can capability="reconciliation.act">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{t('recon.float.title')}</CardTitle>
            <CardDescription>{t('recon.float.description')}</CardDescription>
          </div>
          <Button variant="secondary" size="sm" loading={sync.isPending} onClick={run}>
            <RefreshCw className="size-3.5" />
            {t('recon.float.sync')}
          </Button>
        </CardHeader>

        {sync.isError || result !== undefined ? (
          <CardContent className="space-y-3">
            {sync.isError ? (
              <Alert tone="danger" title={t('recon.float.failedTitle')}>
                {errorMessage(sync.error)}
              </Alert>
            ) : null}

            {result === undefined ? null : (
              <>
                {result.ichancyMinor === null ? (
                  <Alert tone="danger" title={t('recon.float.unreadableTitle')}>
                    {t('recon.float.unreadableBody')}
                  </Alert>
                ) : null}

                {result.belowWatermark ? (
                  <Alert tone="danger" title={t('recon.float.belowTitle')}>
                    {t('recon.float.belowBody')}
                  </Alert>
                ) : null}

                <DetailList>
                  <DetailRow label={t('recon.float.ledger')}>
                    <MinorAmount minor={result.ledgerMinor} currency={result.currencyCode} />
                  </DetailRow>
                  <DetailRow label={t('recon.float.ichancy')}>
                    {result.ichancyMinor === null ? (
                      <span className="text-[var(--danger)]">{t('recon.float.unavailable')}</span>
                    ) : (
                      <MinorAmount minor={result.ichancyMinor} currency={result.currencyCode} />
                    )}
                  </DetailRow>
                  <DetailRow label={t('recon.field.delta')}>
                    {result.deltaMinor === null ? (
                      <span className="text-[var(--danger)]">{t('recon.float.notComparable')}</span>
                    ) : (
                      <MinorAmount
                        minor={result.deltaMinor}
                        currency={result.currencyCode}
                        signed
                        className="font-semibold"
                      />
                    )}
                  </DetailRow>
                  <DetailRow label={t('recon.float.watermark')}>
                    <span className={result.belowWatermark ? 'text-[var(--danger)]' : undefined}>
                      {result.belowWatermark ? t('recon.float.below') : t('recon.float.above')}
                    </span>
                  </DetailRow>
                </DetailList>

                {result.breakId === null ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {t('recon.float.noBreak')}
                  </p>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => {
                      const breakId = result.breakId;
                      if (breakId === null) return;
                      void navigate({
                        to: '.',
                        search: (prev) => ({ ...prev, tab: 'breaks', selected: breakId }),
                      });
                    }}
                  >
                    {t('recon.float.openBreak')}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        ) : null}
      </Card>
    </Can>
  );
}
