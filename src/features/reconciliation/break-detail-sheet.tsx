import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Scale, UserCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { pruneSearch } from '@/app/search-schemas';
import { Can } from '@/components/common/can';
import { CopyableValue } from '@/components/common/copy-button';
import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { SeverityBadge } from '@/components/common/risk-flags';
import { ErrorState } from '@/components/common/states';
import { BreakStatusBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import { useAssignBreak, useBreak, useCorrectFloat } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { ReconciliationBreak } from '@/types';
import { TERMINAL_BREAK_STATUSES } from '@/types/enums';

import { reconMessages } from './messages';
import { ResolveBreakDialog } from './resolve-break-dialog';

/**
 * One break, in full, as a side panel over the list.
 *
 * The panel is addressed by `selected` in the URL, so "come and look at this one" is a link rather
 * than a set of instructions. Everything the backend sent is shown, including the free-form `detail`
 * blob: it arrives as `unknown` and is narrowed rather than trusted, and the raw JSON stays one
 * click away because a summary of evidence is not evidence.
 */
export function BreakDetailSheet() {
  const search = useSearch({ from: '/reconciliation' });
  const navigate = useNavigate();
  const t = useT(reconMessages);
  const enumLabel = useEnumLabel();
  const selected = search.selected;
  const detail = useBreak(selected);

  const close = () => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ ...prev, selected: undefined }) });
  };

  return (
    <Sheet
      open={selected !== undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {detail.data === undefined
              ? t('recon.detail.title')
              : enumLabel('breakCategory', detail.data.category)}
          </SheetTitle>
          <SheetDescription>
            {detail.data === undefined ? t('recon.detail.loading') : t('recon.detail.description')}
          </SheetDescription>
        </SheetHeader>

        {detail.isPending ? (
          <SheetBody className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </SheetBody>
        ) : detail.isError ? (
          <SheetBody>
            <ErrorState
              error={detail.error}
              onRetry={() => {
                void detail.refetch();
              }}
            />
          </SheetBody>
        ) : (
          <BreakBody row={detail.data} onClose={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function BreakBody({ row, onClose }: { row: ReconciliationBreak; onClose: () => void }) {
  const { admin, can } = useAuth();
  const t = useT(reconMessages);
  const enumLabel = useEnumLabel();
  const assign = useAssignBreak();
  const correct = useCorrectFloat();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);

  const terminal = (TERMINAL_BREAK_STATUSES as readonly string[]).includes(row.status);
  const assignedToMe = admin !== null && admin.id === row.assignedToAdminId;
  const isFloatMismatch = row.category === 'AGENT_FLOAT_MISMATCH';

  const handleAssign = () => {
    assign.mutate(row.id, {
      onSuccess: () => {
        toast.success(t('recon.assign.success'));
      },
      onError: (error) => {
        toast.error(t('recon.assign.error'), { description: errorMessage(error) });
      },
    });
  };

  const handleCorrect = (note: string) => {
    correct.mutate(
      { breakId: row.id, note },
      {
        onSuccess: (result) => {
          setCorrectOpen(false);
          toast.success(t('recon.correct.posted'), {
            description: t('recon.correct.transactionId', { id: result.ledgerTransactionId }),
          });
        },
        onError: (error) => {
          toast.error(t('recon.correct.error'), { description: errorMessage(error) });
        },
      },
    );
  };

  return (
    <>
      <SheetBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={row.severity} />
          <BreakStatusBadge status={row.status} />
          <span className="text-sm text-[var(--muted-foreground)]">{row.currencyCode}</span>
        </div>

        {correct.data === undefined ? null : (
          <Alert tone="success" title={t('recon.correct.posted')}>
            <p>
              {t('recon.correct.restatedBy')}{' '}
              <MinorAmount minor={correct.data.deltaMinor} currency={row.currencyCode} signed />.
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1">
              {t('recon.correct.transaction')}
              <CopyableValue value={correct.data.ledgerTransactionId} />
            </p>
          </Alert>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('recon.detail.comparison')}
          </h3>
          <DetailList>
            <DetailRow label={t('recon.field.expected')}>
              <MinorAmount minor={row.expected?.minor ?? null} currency={row.currencyCode} signed />
            </DetailRow>
            <DetailRow label={t('recon.field.actual')}>
              <MinorAmount minor={row.actual?.minor ?? null} currency={row.currencyCode} signed />
            </DetailRow>
            <DetailRow label={t('recon.field.delta')}>
              <MinorAmount
                minor={row.delta?.minor ?? null}
                currency={row.currencyCode}
                signed
                className="font-semibold"
              />
            </DetailRow>
          </DetailList>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('recon.field.pointsAt')}
          </h3>
          <DetailList>
            <DetailRow label={t('recon.field.deposit')}>
              {row.depositRequestId === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : can('deposits.read') ? (
                <Link
                  to="/deposits"
                  search={{ selected: row.depositRequestId }}
                  className="font-mono text-xs text-[var(--primary)] hover:underline"
                >
                  {row.depositRequestId}
                </Link>
              ) : (
                <CopyableValue value={row.depositRequestId} />
              )}
            </DetailRow>
            <DetailRow label={t('field.player')}>
              {row.playerId === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : can('players.read') ? (
                <Link
                  to="/players/$playerId"
                  params={{ playerId: row.playerId }}
                  className="font-mono text-xs text-[var(--primary)] hover:underline"
                >
                  {row.playerId}
                </Link>
              ) : (
                <CopyableValue value={row.playerId} />
              )}
            </DetailRow>
            <DetailRow label={t('recon.field.ledgerAccount')}>
              {row.ledgerAccountId === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : (
                <CopyableValue value={row.ledgerAccountId} />
              )}
            </DetailRow>
            <DetailRow label={t('recon.field.ichancyCall')}>
              {row.ichancyCallId === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : (
                <CopyableValue value={row.ichancyCallId} />
              )}
            </DetailRow>
          </DetailList>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('recon.detail.history')}
          </h3>
          <DetailList>
            <DetailRow label={t('recon.field.detected')}>
              <TimeAgo value={row.detectedAt} />
            </DetailRow>
            <DetailRow label={t('recon.field.assignee')}>
              {row.assignedToAdminId === null ? (
                <span className="text-[var(--muted-foreground)]">
                  {t('recon.assignee.unassigned')}
                </span>
              ) : assignedToMe ? (
                t('recon.assignee.you')
              ) : (
                <CopyableValue value={row.assignedToAdminId} />
              )}
            </DetailRow>
            <DetailRow label={t('recon.field.resolvedAt')}>
              <TimeAgo value={row.resolvedAt} />
            </DetailRow>
            <DetailRow label={t('recon.field.resolutionNote')}>
              {row.resolutionNote ?? <span className="text-[var(--muted-foreground)]">—</span>}
            </DetailRow>
            <DetailRow label={t('recon.field.resolutionTx')}>
              {row.resolutionTxId === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : (
                <CopyableValue value={row.resolutionTxId} />
              )}
            </DetailRow>
            <DetailRow label={t('recon.field.breakId')}>
              <CopyableValue value={row.id} />
            </DetailRow>
            <DetailRow label={t('recon.field.dedupeKey')}>
              {row.dedupeKey === null ? (
                <span className="text-[var(--muted-foreground)]">—</span>
              ) : (
                <code className="font-mono text-xs break-all">{row.dedupeKey}</code>
              )}
            </DetailRow>
          </DetailList>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('recon.detail.recorded')}
          </h3>
          <BreakDetailJson detail={row.detail} />
        </section>
      </SheetBody>

      <Can capability="reconciliation.act">
        <SheetFooter className="flex flex-wrap gap-2">
          {terminal || assignedToMe ? null : (
            <Button variant="secondary" loading={assign.isPending} onClick={handleAssign}>
              <UserCheck className="size-4" />
              {t('recon.detail.assign')}
            </Button>
          )}

          {isFloatMismatch ? (
            <Button
              variant="secondary"
              onClick={() => {
                setCorrectOpen(true);
              }}
            >
              <Scale className="size-4" />
              {t('recon.detail.correctFloat')}
            </Button>
          ) : null}

          {terminal ? null : (
            <Button
              variant="primary"
              onClick={() => {
                setResolveOpen(true);
              }}
            >
              {t('recon.detail.resolve')}
            </Button>
          )}
        </SheetFooter>
      </Can>

      <ResolveBreakDialog
        breakId={row.id}
        breakLabel={`${enumLabel('breakCategory', row.category)} · ${t('severity.label', {
          level: row.severity,
        })}`}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        onResolved={onClose}
      />

      <CorrectFloatDialog
        open={correctOpen}
        onOpenChange={setCorrectOpen}
        deltaMinor={row.delta?.minor ?? null}
        currencyCode={row.currencyCode}
        pending={correct.isPending}
        onConfirm={handleCorrect}
      />
    </>
  );
}

/** Built from the translated message rather than around it: the reason is read, not logged. */
const correctSchema = (noteRequired: string) =>
  z.object({ note: z.string().trim().min(1, noteRequired) });

type CorrectFormValues = z.infer<ReturnType<typeof correctSchema>>;

/**
 * Correcting the float writes a real ledger transaction, so the dialog restates the exact amount it
 * is about to move and refuses to move it without a reason. There is no undo on the other side.
 */
function CorrectFloatDialog({
  open,
  onOpenChange,
  deltaMinor,
  currencyCode,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deltaMinor: string | null;
  currencyCode: string;
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const t = useT(reconMessages);
  const fieldId = useId();
  const form = useForm<CorrectFormValues>({
    resolver: zodResolver(correctSchema(t('recon.correct.noteRequired'))),
    defaultValues: { note: '' },
  });

  const noteError = form.formState.errors.note?.message;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ note: '' });
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              onConfirm(values.note.trim());
            })(event);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('recon.correct.title')}</DialogTitle>
            <DialogDescription>{t('recon.correct.description')}</DialogDescription>
          </DialogHeader>

          <Alert tone="warning" title={t('recon.correct.willRestate')} className="mt-4">
            <p>
              {t('recon.correct.amount')}{' '}
              <MinorAmount
                minor={deltaMinor}
                currency={currencyCode}
                signed
                className="font-semibold"
              />
            </p>
          </Alert>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor={`${fieldId}-note`}>{t('field.reason')}</Label>
            <Textarea
              id={`${fieldId}-note`}
              placeholder={t('recon.correct.notePlaceholder')}
              aria-invalid={noteError !== undefined}
              aria-describedby={noteError === undefined ? undefined : `${fieldId}-note-error`}
              {...form.register('note')}
            />
            {noteError === undefined ? null : (
              <p id={`${fieldId}-note-error`} role="alert" className="text-sm text-[var(--danger)]">
                {noteError}
              </p>
            )}
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              {t('recon.correct.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** ISO-ish enough to be worth rendering as a time; anything else stays the string it arrived as. */
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function DetailValue({ value }: { value: unknown }) {
  const t = useT(reconMessages);

  if (value === null || value === undefined) {
    return <span className="text-[var(--muted-foreground)]">—</span>;
  }
  if (typeof value === 'string') {
    return ISO_LIKE.test(value) && !Number.isNaN(Date.parse(value)) ? (
      <TimeAgo value={value} />
    ) : (
      <span className="break-words">{value}</span>
    );
  }
  if (typeof value === 'number') {
    return <span className="tabular">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? t('common.yes') : t('common.no')}</span>;
  }
  return <code className="font-mono text-xs break-all">{JSON.stringify(value)}</code>;
}

function BreakDetailJson({ detail }: { detail: unknown }) {
  const t = useT(reconMessages);

  if (detail === null || detail === undefined) {
    return <p className="text-sm text-[var(--muted-foreground)]">{t('recon.detail.noDetail')}</p>;
  }

  const raw = JSON.stringify(detail, null, 2);

  return (
    <div className="space-y-2">
      {isRecord(detail) ? (
        <DetailList>
          {Object.entries(detail).map(([key, value]) => (
            <DetailRow key={key} label={key}>
              <DetailValue value={value} />
            </DetailRow>
          ))}
        </DetailList>
      ) : (
        // JSON is code, so it stays left-to-right on an Arabic screen too: mirrored braces and a
        // right-aligned indent make evidence harder to read, not easier.
        <pre
          dir="ltr"
          className="scrollbar-thin overflow-x-auto rounded-md bg-[var(--surface-muted)] p-3 font-mono text-xs"
        >
          {raw}
        </pre>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted-foreground)]">
          {t('recon.detail.rawJson')}
        </summary>
        <pre
          dir="ltr"
          className="scrollbar-thin mt-2 overflow-x-auto rounded-md bg-[var(--surface-muted)] p-3 font-mono text-xs"
        >
          {raw}
        </pre>
      </details>
    </div>
  );
}
