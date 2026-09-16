import { Brush } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api/errors';
import { useSweepDeposits } from '@/lib/api/queries';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import type { SweepReport } from '@/types/deposit';

import { settingsMessages } from './messages';

/** Three numbers nobody can interpret without being told what they counted. */
const SWEEP_LINES = [
  {
    key: 'expired',
    label: 'settings.maintenance.expired',
    meaning: 'settings.maintenance.expiredMeaning',
  },
  {
    key: 'released',
    label: 'settings.maintenance.released',
    meaning: 'settings.maintenance.releasedMeaning',
  },
  {
    key: 'reaped',
    label: 'settings.maintenance.reaped',
    meaning: 'settings.maintenance.reapedMeaning',
  },
] as const;

/**
 * The deposit maintenance sweep.
 *
 * It is a write against the live queue — deposits change status and claims are taken off other
 * people's screens — so it is confirmed rather than fired from one click, and the result is shown
 * as three named counts rather than a toast that scrolls away. `{expired, released, reaped}` means
 * nothing to a reviewer who has not read the backend's cron.
 */
export function SettingsMaintenance() {
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<SweepReport | null>(null);
  const sweep = useSweepDeposits();
  const t = useT(settingsMessages);

  const runSweep = async () => {
    try {
      const result = await sweep.mutateAsync(undefined);
      setReport(result);
      setConfirming(false);
      toast.success(t('settings.maintenance.done'), {
        description: t('settings.maintenance.counts', {
          expired: formatCount(result.expired),
          released: formatCount(result.released),
          reaped: formatCount(result.reaped),
        }),
      });
    } catch (error) {
      toast.error(t('settings.maintenance.failed'), { description: errorMessage(error) });
    }
  };

  return (
    <Can capability="deposits.sweep">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.maintenance.title')}</CardTitle>
          <CardDescription>{t('settings.maintenance.description')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('settings.maintenance.summary')}
          </p>

          <Button
            variant="secondary"
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Brush className="size-4" />
            {t('settings.maintenance.run')}
          </Button>

          {report === null ? null : (
            <div className="space-y-3">
              {/* Three zeros and "it worked" look the same at a glance, so the pass says in words
                  how much it moved. Arabic agrees the noun with that number, which is why this is
                  a plural key and not a sentence with a digit dropped into it. */}
              <p className="text-sm font-medium">
                {t('settings.maintenance.changed', {
                  count: report.expired + report.released + report.reaped,
                })}
              </p>

              <dl className="grid gap-3 sm:grid-cols-3">
                {SWEEP_LINES.map((line) => (
                  <div key={line.key} className="rounded-lg border border-[var(--border)] p-3">
                    <dt className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
                      {t(line.label)}
                    </dt>
                    <dd>
                      <span className="tabular mt-1 block text-2xl font-semibold">
                        {formatCount(report[line.key])}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                        {t(line.meaning)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('settings.maintenance.confirmTitle')}
        description={t('settings.maintenance.confirmBody')}
        confirmLabel={t('settings.maintenance.run')}
        loading={sweep.isPending}
        onConfirm={() => {
          void runSweep();
        }}
      />
    </Can>
  );
}
