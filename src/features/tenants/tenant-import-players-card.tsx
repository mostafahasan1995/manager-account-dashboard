import { Download } from 'lucide-react';

import { DetailList, DetailRow } from '@/components/common/page-header';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import type { PlayerImportSummary } from '@/types';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';

/**
 * The "old players": pulling an operator's existing Ichancy accounts in from the platform side.
 *
 * Creation runs this import once, after activation — and activation fails on a fresh operator
 * whenever the agent id is wrong, so the first run often never happens. This card is the second
 * chance, and it is safe to press twice: an account already known counts as `existing`.
 *
 * An Ichancy failure arrives in `summary.error` rather than as a thrown request, because the
 * import is a batch that may have got halfway. The card shows the counts AND the error, in that
 * order: "12 created, then Ichancy stopped answering" is a different situation from "nothing".
 */
export function TenantImportPlayersCard({
  summary,
  actions,
}: {
  /** The last run in this session, or null when none has happened here. */
  summary: PlayerImportSummary | null;
  actions: TenantOperatorActions;
}) {
  const t = useT(tenantMessages);
  // Picked out by name: the summary is a loose object, and the interpolator takes only scalars.
  const counts =
    summary === null
      ? null
      : { scanned: summary.scanned, created: summary.created, existing: summary.existing };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tenants.import.title')}</CardTitle>
        <CardDescription>{t('tenants.import.body')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary === null || counts === null ? (
          <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.import.notRun')}</p>
        ) : (
          <>
            {summary.error === null ? (
              <Alert tone="success" title={t('tenants.import.doneTitle')}>
                {t('tenants.import.summary', counts)}
              </Alert>
            ) : (
              <Alert tone="danger" title={t('tenants.import.errorTitle')}>
                <p>{summary.error}</p>
                <p>{t('tenants.import.summary', counts)}</p>
              </Alert>
            )}
            <DetailList>
              <DetailRow label={t('tenants.import.finishedAt')}>
                <TimeAgo value={summary.finishedAt} />
              </DetailRow>
              <DetailRow label={t('tenants.field.players')}>
                <span className="tabular">{formatCount(summary.created)}</span>
              </DetailRow>
            </DetailList>
          </>
        )}

        <Button
          variant="secondary"
          size="sm"
          loading={actions.importing}
          onClick={actions.importPlayers}
        >
          <Download className="size-3.5" />
          {t('tenants.import.action')}
        </Button>
      </CardContent>
    </Card>
  );
}
