import { Check, Circle, Clock, Minus, X } from 'lucide-react';

import { TimeAgo } from '@/components/common/time';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { AdminWithdrawal } from '@/types';

import { withdrawalMessages, type WithdrawalMessageKey } from './messages';
import { timelineOf, type TimelineStep, type TimelineStepState } from './withdrawal-model';

/**
 * Requested → decided → debited → paid, each marked with what became of it on this row.
 *
 * Each step is a word, a glyph AND a colour: the state is readable with any one of the three
 * missing, and a screen reader gets the word. The one state the whole screen is built around —
 * debited, not paid — is the `current` mark on the last step, drawn in the warning tone so it
 * never reads as finished.
 */
export function WithdrawalTimeline({ withdrawal }: { withdrawal: AdminWithdrawal }) {
  const steps = timelineOf(withdrawal);

  return (
    <ol className="space-y-0" data-testid="withdrawal-timeline">
      {steps.map((step, index) => (
        <TimelineItem key={step.key} step={step} last={index === steps.length - 1} />
      ))}
    </ol>
  );
}

const STATE_CLASSES: Record<TimelineStepState, string> = {
  done: 'border-[var(--success)] bg-[var(--success-muted)] text-[var(--success)]',
  current: 'border-[var(--warning)] bg-[var(--warning-muted)] text-[var(--warning)]',
  pending: 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted-foreground)]',
  skipped: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
  failed: 'border-[var(--danger)] bg-[var(--danger-muted)] text-[var(--danger)]',
};

const STATE_ICONS: Record<TimelineStepState, typeof Check> = {
  done: Check,
  current: Clock,
  pending: Circle,
  skipped: Minus,
  failed: X,
};

function TimelineItem({ step, last }: { step: TimelineStep; last: boolean }) {
  const t = useT(withdrawalMessages);
  const Icon = STATE_ICONS[step.state];
  const stepKey = `withdrawals.timeline.step.${step.key}` as WithdrawalMessageKey;
  const detailKey = `withdrawals.timeline.${step.detail}` as WithdrawalMessageKey;
  const muted = step.state === 'pending' || step.state === 'skipped';

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0" data-state={step.state}>
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute top-6 bottom-0 start-[11px] w-px bg-[var(--border)]"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
          STATE_CLASSES[step.state],
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cn('text-sm font-medium', muted && 'text-[var(--muted-foreground)]')}>
            {t(stepKey)}
          </p>
          {step.at === null ? null : (
            <TimeAgo value={step.at} className="text-xs text-[var(--muted-foreground)]" />
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{t(detailKey)}</p>
      </div>
    </li>
  );
}
