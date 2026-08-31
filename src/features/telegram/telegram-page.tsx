import { useState } from 'react';
import { Plus, Send, Radio } from 'lucide-react';
import { toast } from 'sonner';

import {
  Can,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '@/components/common';
import {
  Alert,
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  usePublishActivityReport,
  useCheckTelegramDestination,
  useRemoveTelegramDestination,
  useTelegramDestinations,
  useTestTelegramDestination,
} from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { TelegramDestination } from '@/types/telegram-destination';

import { DestinationFormDialog } from './destination-form-dialog';
import { DestinationsTable } from './destinations-table';
import { checkReasonSentence, failureSentence } from './failure-sentence';
import { telegramMessages } from './messages';

/**
 * Telegram destinations — where this operator's bot publishes.
 *
 * ── WHAT THIS SCREEN IS FOR ───────────────────────────────────────────────────────────────────
 * The operator's bot is already registered against their account, so there is nothing to configure
 * about the bot itself and no token to enter. What was missing was somewhere to say WHERE it should
 * publish: before this, an operator's chats lived on the platform's Tenants screen as two raw
 * numbers that only a platform admin could edit, with nothing anywhere checking that either number
 * was a real group the bot could post to.
 *
 * ── THE ONE RULE THE SCREEN HOLDS ─────────────────────────────────────────────────────────────
 * Nothing appears in this table that the bot has not proved it can post to. The server resolves the
 * pasted link through the operator's own bot, checks membership, administrator status and the post
 * right as three separate facts, and only then writes the row. So the failure this replaces —
 * accepted, saved, silently undelivered — cannot occur: a binding either works or it never existed.
 */
export function TelegramPage() {
  const t = useT(telegramMessages);
  const destinations = useTelegramDestinations();
  const test = useTestTelegramDestination();
  const check = useCheckTelegramDestination();
  const remove = useRemoveTelegramDestination();
  const publish = usePublishActivityReport();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TelegramDestination | null>(null);
  const [removing, setRemoving] = useState<TelegramDestination | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  const rows = destinations.data ?? [];

  const nameOf = (destination: TelegramDestination) =>
    destination.displayName ?? destination.title ?? destination.chatId;

  const runTest = (destination: TelegramDestination) => {
    void (async () => {
      try {
        const result = await test.mutateAsync(destination.id);
        if (result.ok) {
          toast.success(t('telegram.test.ok', { name: nameOf(destination) }));
          return;
        }
        // The sentence that names who fixes it, not "the test failed".
        toast.error(t('telegram.test.failed'), {
          description:
            checkReasonSentence(result.reason, t) ?? result.detail ?? t('telegram.test.failed'),
        });
      } catch (error) {
        toast.error(t('telegram.test.failed'), {
          description: failureSentence(error, t) ?? errorMessage(error),
        });
      }
    })();
  };

  /**
   * The silent re-verify. Reports the same sentences as a test, and posts nothing — which is what
   * makes it safe to offer a reader.
   */
  const runCheck = (destination: TelegramDestination) => {
    void (async () => {
      try {
        const result = await check.mutateAsync(destination.id);
        if (result.ok) {
          toast.success(t('telegram.checked.ok', { name: nameOf(destination) }));
          return;
        }
        toast.error(t('telegram.test.failed'), {
          description:
            checkReasonSentence(result.reason, t) ?? result.detail ?? t('telegram.test.failed'),
        });
      } catch (error) {
        toast.error(t('telegram.test.failed'), {
          description: failureSentence(error, t) ?? errorMessage(error),
        });
      }
    })();
  };

  const runPublish = () => {
    void (async () => {
      try {
        const result = await publish.mutateAsync({ period });

        if (result.considered === 0) {
          // Not an error, and deliberately not a success either: nothing was sent, and saying
          // "published" would be a lie about a report nobody received.
          toast.warning(t('telegram.report.none'));
          return;
        }

        if (result.failed > 0) {
          toast.warning(
            t('telegram.report.partial', {
              title: result.title,
              delivered: result.delivered,
              considered: result.considered,
            }),
          );
          return;
        }

        toast.success(t('telegram.report.sent', { title: result.title, count: result.delivered }));
      } catch (error) {
        toast.error(t('telegram.test.failed'), { description: errorMessage(error) });
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('telegram.title')}
        description={t('telegram.description')}
        actions={
          <Can capability="telegramDestinations.write">
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              {t('telegram.add')}
            </Button>
          </Can>
        }
      />

      <Alert tone="info" title={t('telegram.title')}>
        {t('telegram.note')}
      </Alert>

      <Card>
        {destinations.isPending ? <TableSkeleton rows={3} columns={6} /> : null}

        {destinations.isError ? (
          <ErrorState
            error={destinations.error}
            onRetry={() => {
              void destinations.refetch();
            }}
          />
        ) : null}

        {destinations.isSuccess && rows.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title={t('telegram.empty.title')}
            description={t('telegram.empty.body')}
          />
        ) : null}

        {destinations.isSuccess && rows.length > 0 ? (
          <DestinationsTable
            destinations={rows}
            testingId={test.isPending ? test.variables : null}
            onEdit={(destination) => {
              setEditing(destination);
              setFormOpen(true);
            }}
            onRemove={(destination) => {
              setRemoving(destination);
            }}
            onTest={runTest}
            onCheck={runCheck}
            checkingId={check.isPending ? check.variables : null}
          />
        ) : null}
      </Card>

      {/* Publishing a report is a separate job from configuring where reports go, so it is a
          separate card rather than a button in the header — but it belongs on this screen, because
          "send the report" and "to where?" are the same question asked twice. */}
      <Can capability="reports.publish">
        <Card className="space-y-3 p-4">
          <div>
            <h2 className="font-medium">{t('telegram.report.title')}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{t('telegram.report.body')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value as 'day' | 'week' | 'month');
              }}
            >
              <SelectTrigger className="w-48" aria-label={t('telegram.report.title')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('telegram.report.period.day')}</SelectItem>
                <SelectItem value="week">{t('telegram.report.period.week')}</SelectItem>
                <SelectItem value="month">{t('telegram.report.period.month')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" loading={publish.isPending} onClick={runPublish}>
              <Send aria-hidden="true" />
              {t('telegram.report.publish')}
            </Button>
          </div>
        </Card>
      </Can>

      <DestinationFormDialog
        destination={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />

      {removing === null ? null : (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null);
          }}
          title={t('telegram.remove.title')}
          description={t('telegram.remove.body', { name: nameOf(removing) })}
          confirmLabel={t('telegram.remove.confirm')}
          destructive
          loading={remove.isPending}
          onConfirm={() => {
            const target = removing;
            void (async () => {
              try {
                await remove.mutateAsync(target.id);
                setRemoving(null);
              } catch (error) {
                toast.error(t('telegram.test.failed'), { description: errorMessage(error) });
              }
            })();
          }}
        />
      )}
    </div>
  );
}
