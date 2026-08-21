import { ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import { highestRiskSeverity, riskFlagSeverity, type Tone } from '@/types/enums';

const SEVERITY_TONE = (severity: number): Tone => {
  if (severity >= 4) return 'danger';
  if (severity >= 2) return 'warning';
  return 'muted';
};

/** The flags the backend attached to a deposit, worst first. */
export function RiskFlagList({
  flags,
  className,
}: {
  flags: readonly string[];
  className?: string;
}) {
  const label = useEnumLabel();
  const t = useT();

  if (flags.length === 0) {
    return (
      <span className={cn('text-sm text-[var(--muted-foreground)]', className)}>
        {t('common.none')}
      </span>
    );
  }

  const sorted = [...flags].sort((a, b) => riskFlagSeverity(b) - riskFlagSeverity(a));

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {sorted.map((flag) => (
        <Badge key={flag} tone={SEVERITY_TONE(riskFlagSeverity(flag))}>
          <ShieldAlert className="size-3" />
          {label('riskFlag', flag)}
        </Badge>
      ))}
    </div>
  );
}

/**
 * The compact form for a queue row: one mark carrying the worst flag, with all of them on hover.
 * A row with nothing to say shows nothing, so the ones that do stand out.
 */
export function RiskIndicator({ flags }: { flags: readonly string[] }) {
  const label = useEnumLabel();
  if (flags.length === 0) return null;

  const tone = SEVERITY_TONE(highestRiskSeverity(flags));

  return (
    <Tooltip content={flags.map((flag) => label('riskFlag', flag)).join(' · ')}>
      <span className="inline-flex cursor-help items-center gap-1" data-testid="risk-indicator">
        <ShieldAlert
          className={cn(
            'size-3.5',
            tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]',
          )}
        />
        <span className="tabular text-xs text-[var(--muted-foreground)]">{flags.length}</span>
      </span>
    </Tooltip>
  );
}

export function SeverityBadge({ severity }: { severity: number }) {
  const t = useT();
  return <Badge tone={SEVERITY_TONE(severity)}>{t('severity.label', { level: severity })}</Badge>;
}
