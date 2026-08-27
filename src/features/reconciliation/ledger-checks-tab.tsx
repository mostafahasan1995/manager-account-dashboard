import { CheckCircle2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { MinorAmount } from '@/components/common/money-amount';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/api/errors';
import { useRunInvariants } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { reconMessages } from './messages';

/**
 * The ledger's own invariants, run on demand.
 *
 * The check is read-only and can be slow, so it is a button rather than something the page does on
 * open. Read-only roles still see this tab: knowing that the ledger is checked, and by whom, is
 * part of understanding the numbers on every other screen.
 */

/** The invariants this build knows the name of. Anything else is shown as the backend named it. */
const KNOWN_INVARIANTS = [
  'I1_TRANSACTION_BALANCES',
  'I2_GLOBAL_BALANCE',
  'I3_ACCOUNT_BALANCE_MATCHES_ENTRIES',
] as const;

type KnownInvariant = (typeof KNOWN_INVARIANTS)[number];

const isKnownInvariant = (value: string): value is KnownInvariant =>
  (KNOWN_INVARIANTS as readonly string[]).includes(value);

export function LedgerChecksTab() {
  const invariants = useRunInvariants();
  const t = useT(reconMessages);
  const report = invariants.data;

  const invariantLabel = (invariant: string) =>
    isKnownInvariant(invariant) ? t(`recon.invariant.${invariant}`) : invariant;

  const run = () => {
    invariants.mutate(undefined, {
      onSuccess: (outcome) => {
        if (outcome.ok) {
          toast.success(t('recon.ledger.passed'));
        } else {
          toast.error(t('recon.ledger.failedCount', { count: outcome.violations.length }));
        }
      },
      onError: (error) => {
        toast.error(t('recon.ledger.runError'), { description: errorMessage(error) });
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{t('recon.ledger.title')}</CardTitle>
            <CardDescription>{t('recon.ledger.description')}</CardDescription>
          </div>
          <Can capability="reconciliation.act">
            <Button variant="primary" loading={invariants.isPending} onClick={run}>
              <PlayCircle className="size-4" />
              {t('recon.ledger.run')}
            </Button>
          </Can>
        </CardHeader>

        {invariants.isError ? (
          <CardContent>
            <Alert tone="danger" title={t('recon.ledger.didNotRun')}>
              {errorMessage(invariants.error)}
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      {report === undefined ? null : (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {report.ok ? (
                <Alert tone="success" title={t('recon.ledger.consistent')} className="w-full">
                  {t('recon.ledger.consistentBody')}
                </Alert>
              ) : (
                <Alert tone="danger" title={t('recon.ledger.inconsistent')} className="w-full">
                  {t('recon.ledger.violationCount', { count: report.violations.length })}
                </Alert>
              )}
            </div>
            <CardDescription>
              <TimeAgo value={report.checkedAt} prefix={t('recon.ledger.checked')} />.
            </CardDescription>
            {report.truncated ? (
              <Alert tone="warning" title={t('recon.ledger.truncatedTitle')}>
                {t('recon.ledger.truncatedBody')}
              </Alert>
            ) : null}
          </CardHeader>

          {report.violations.length === 0 ? (
            <CardContent>
              <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <CheckCircle2 className="size-4 text-[var(--success)]" />
                {t('recon.ledger.noViolations')}
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableCaption className="sr-only">{t('recon.ledger.caption')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recon.ledger.invariant')}</TableHead>
                  <TableHead>{t('recon.ledger.subject')}</TableHead>
                  <TableHead className="text-end">{t('recon.field.expected')}</TableHead>
                  <TableHead className="text-end">{t('recon.field.actual')}</TableHead>
                  <TableHead className="text-end">{t('recon.field.delta')}</TableHead>
                  <TableHead>{t('recon.ledger.detail')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.violations.map((violation, index) => (
                  <TableRow key={`${violation.invariant}-${violation.subject}-${index}`}>
                    <TableCell className="font-medium">
                      {invariantLabel(violation.invariant)}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs break-all">{violation.subject}</code>
                    </TableCell>
                    <TableCell className="text-end">
                      <MinorCell
                        value={violation.expectedMinor}
                        currency={violation.currencyCode}
                      />
                    </TableCell>
                    <TableCell className="text-end">
                      <MinorCell value={violation.actualMinor} currency={violation.currencyCode} />
                    </TableCell>
                    <TableCell className="text-end">
                      <MinorCell
                        value={violation.deltaMinor}
                        currency={violation.currencyCode}
                        signed
                      />
                    </TableCell>
                    <TableCell className="text-sm">{violation.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * The invariant report types its amounts as `string | number`. Anything that is not a whole number
 * of minor units is shown verbatim rather than coerced: a figure this console cannot parse is worth
 * seeing exactly as the backend sent it.
 */
function MinorCell({
  value,
  currency,
  signed = false,
}: {
  value: string | number;
  currency: string;
  signed?: boolean;
}) {
  const text = (typeof value === 'number' ? String(value) : value).trim();
  if (!/^-?\d+$/.test(text)) {
    return <code className="font-mono text-xs break-all">{text}</code>;
  }
  return <MinorAmount minor={text} currency={currency} signed={signed} />;
}
