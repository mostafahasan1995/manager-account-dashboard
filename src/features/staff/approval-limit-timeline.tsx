import { History, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { MoneyAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api/errors';
import { useEndApprovalLimit } from '@/lib/api/queries';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, parseDecimalToMinor } from '@/lib/money';
import { isCurrentLimit, type ApprovalLimit, type MoneyView } from '@/types';

import { staffMessages } from './messages';

/**
 * An administrator's authority over money, as the backend actually stores it: a chain of versions.
 *
 * Setting a limit does not edit a row — it closes the open version and opens a new one, and nothing
 * ever rewrites what came before. Rendering that as a single editable form would be a lie about the
 * data and, worse, about the audit trail, so it is a timeline: exactly one version can be in force,
 * every earlier one keeps the dates it was in force for, and an administrator with no open version
 * has no authority at all.
 */

/**
 * Limit amounts come over the wire as bare decimal strings with the currency alongside, while every
 * amount on screen is a MoneyView. Minor units are derived rather than invented; an amount the
 * parser will not accept is shown as it arrived instead of blanking the page.
 */
function limitMoney(amount: string, currencyCode: string): MoneyView {
  try {
    const minor = parseDecimalToMinor(amount);
    return { minor: minor.toString(), amount: formatMinorToDecimal(minor), currency: currencyCode };
  } catch {
    return { minor: '0', amount, currency: currencyCode };
  }
}

export function ApprovalLimitTimeline({
  limits,
  adminName,
}: {
  limits: readonly ApprovalLimit[];
  adminName: string;
}) {
  const endLimit = useEndApprovalLimit();
  const t = useT(staffMessages);
  const formatters = useFormatters();
  const [ending, setEnding] = useState<ApprovalLimit | null>(null);
  const [endError, setEndError] = useState<unknown>(null);

  if (limits.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-5" />}
        title={t('staff.limit.emptyTitle')}
        description={t('staff.limit.emptyBody', { name: adminName })}
      />
    );
  }

  const confirmEnd = async () => {
    if (ending === null) return;
    try {
      await endLimit.mutateAsync(ending.id);
      toast.success(t('staff.limit.endedToast', { name: adminName }));
      setEnding(null);
    } catch (caught) {
      setEndError(caught);
      toast.error(errorMessage(caught));
    }
  };

  return (
    <>
      <ol className="space-y-3">
        {limits.map((limit) => {
          const open = isCurrentLimit(limit);
          return (
            <li
              key={limit.id}
              className={
                open
                  ? 'rounded-lg border border-[var(--success)]/40 bg-[var(--success-muted)]/40 p-4'
                  : 'rounded-lg border border-[var(--border)] p-4'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {open ? (
                    <Badge tone="success">{t('staff.limit.inForce')}</Badge>
                  ) : (
                    <Badge tone="muted">{t('staff.limit.ended')}</Badge>
                  )}
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {open ? (
                      <TimeAgo value={limit.effectiveFrom} prefix={t('staff.limit.inForceSince')} />
                    ) : (
                      `${formatters.date(limit.effectiveFrom)} — ${formatters.date(limit.effectiveTo)}`
                    )}
                  </span>
                </div>

                {open ? (
                  <Can capability="admins.write">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setEndError(null);
                        setEnding(limit);
                      }}
                    >
                      <ShieldOff className="size-3.5" />
                      {t('staff.limit.end')}
                    </Button>
                  </Can>
                ) : null}
              </div>

              <DetailList className="mt-3">
                <DetailRow label={t('field.currency')}>
                  <span className="font-mono text-xs">{limit.currencyCode}</span>
                </DetailRow>
                <DetailRow label={t('staff.limit.maxSingle')}>
                  <MoneyAmount
                    money={limitMoney(limit.maxSingleApproval, limit.currencyCode)}
                    emphasis
                  />
                </DetailRow>
                <DetailRow label={t('staff.limit.maxDaily')}>
                  <MoneyAmount money={limitMoney(limit.maxDailyApproval, limit.currencyCode)} />
                </DetailRow>
                <DetailRow label={t('staff.limit.secondAbove')}>
                  {limit.secondApprovalAbove === null ? (
                    <span className="text-[var(--muted-foreground)]">
                      {t('staff.limit.neverSecond')}
                    </span>
                  ) : (
                    <MoneyAmount
                      money={limitMoney(limit.secondApprovalAbove, limit.currencyCode)}
                    />
                  )}
                </DetailRow>
              </DetailList>
            </li>
          );
        })}
      </ol>

      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEnding(null);
            setEndError(null);
          }
        }}
        title={t('staff.limit.endConfirmTitle')}
        description={
          // Split around the two phrases that carry the whole warning, so each language can bold
          // its own words rather than inherit English's position for them.
          <>
            {t('staff.limit.endConfirmLead', { name: adminName })}{' '}
            <strong>{t('staff.limit.endConfirmNone')}</strong>
            {t('staff.limit.endConfirmMiddle')} <strong>DENIED</strong>
            {t('staff.limit.endConfirmTail')}
          </>
        }
        confirmLabel={t('staff.limit.endConfirmAction')}
        destructive
        loading={endLimit.isPending}
        onConfirm={() => {
          void confirmEnd();
        }}
      >
        {endError === null ? null : (
          <Alert tone="danger" title={t('staff.apiRefused')}>
            {errorMessage(endError)}
          </Alert>
        )}
      </ConfirmDialog>
    </>
  );
}
