import { Activity } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useHealth } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { Tone } from '@/types/enums';

/**
 * A status light for the backend itself.
 *
 * It reads /health/live and /health/ready, which are public and cheap. When the API is unreachable
 * this is the difference between "the queue is empty" and "the queue could not be loaded" — a
 * distinction that matters a great deal at 2am.
 */
export function HealthPill() {
  const { data, isPending } = useHealth();
  const t = useT();

  if (isPending) return null;

  const reachable = data?.reachable ?? false;
  const ready = data?.ready?.status === 'ok';

  const tone: Tone = !reachable ? 'danger' : ready ? 'success' : 'warning';
  const label = !reachable
    ? t('health.unreachable')
    : ready
      ? t('health.ok')
      : t('health.degraded');

  const failing = Object.keys(data?.ready?.error ?? {});
  const detail = !reachable
    ? t('health.unreachableDetail')
    : failing.length > 0
      ? t('health.failing', { names: failing.join(', ') })
      : t('health.uptime', {
          role: data?.live?.role ?? '—',
          seconds: data?.live?.uptimeSeconds ?? 0,
        });

  return (
    <Tooltip content={detail}>
      <span>
        <Badge tone={tone} className="cursor-help">
          <Activity className="size-3" />
          <span className="hidden sm:inline">{label}</span>
        </Badge>
      </span>
    </Tooltip>
  );
}
