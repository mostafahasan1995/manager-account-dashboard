import { useEffect, useState } from 'react';

import { Tooltip } from '@/components/ui/tooltip';
import { formatCountdown } from '@/lib/format';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

/** "3 minutes ago", with the exact timestamp one hover away. Both questions, always answered. */
export function TimeAgo({
  value,
  className,
  prefix,
}: {
  value: string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const formatters = useFormatters();
  if (value == null) return <span className={cn('text-[var(--muted-foreground)]', className)}>—</span>;
  return (
    <Tooltip content={formatters.dateTimeSeconds(value)}>
      <span className={cn('cursor-help whitespace-nowrap', className)}>
        {prefix === undefined ? '' : `${prefix} `}
        {formatters.relative(value)}
      </span>
    </Tooltip>
  );
}

const COUNTDOWN_TICK_MS = 1_000;

/**
 * A live countdown. Used for the claim lock and for the deposit expiry, where "8 minutes left" and
 * "expired" are different decisions — so this re-renders every second rather than on data refetch.
 */
export function Countdown({
  target,
  className,
  onExpire,
}: {
  target: string | null | undefined;
  className?: string;
  onExpire?: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target == null) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, COUNTDOWN_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [target]);

  const expiredLabel = t('countdown.expired');
  const text = formatCountdown(target, now, expiredLabel);
  const expired = text === expiredLabel;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  return (
    <span
      className={cn('tabular whitespace-nowrap', expired && 'text-[var(--danger)]', className)}
      data-testid="countdown"
    >
      {text}
    </span>
  );
}
