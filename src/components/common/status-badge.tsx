import { Badge } from '@/components/ui/badge';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import {
  BREAK_STATUS_TONES,
  DEPOSIT_STATUS_TONES,
  PLAYER_STATUS_TONES,
  TENANT_STATUS_TONES,
  type BreakStatus,
  type DepositStatus,
  type PlayerStatus,
  type TenantStatus,
  type Tone,
} from '@/types/enums';

/**
 * Status is always a WORD plus a colour, never a colour alone — a reviewer approving money must not
 * have to tell amber from red, and a colour cannot be translated.
 *
 * The props are `string`, not the enum unions, on purpose. A status the backend adds tomorrow must
 * render as itself in a neutral badge rather than disappearing off the screen.
 */

const toneOf = <T extends string>(value: string, tones: Record<T, Tone>): Tone =>
  (tones as Record<string, Tone | undefined>)[value] ?? 'neutral';

export function DepositStatusBadge({ status }: { status: string }) {
  const label = useEnumLabel();
  return (
    <Badge tone={toneOf<DepositStatus>(status, DEPOSIT_STATUS_TONES)}>
      {label('depositStatus', status)}
    </Badge>
  );
}

export function PlayerStatusBadge({ status }: { status: string }) {
  const label = useEnumLabel();
  return (
    <Badge tone={toneOf<PlayerStatus>(status, PLAYER_STATUS_TONES)}>
      {label('playerStatus', status)}
    </Badge>
  );
}

export function BreakStatusBadge({ status }: { status: string }) {
  const label = useEnumLabel();
  return (
    <Badge tone={toneOf<BreakStatus>(status, BREAK_STATUS_TONES)}>
      {label('breakStatus', status)}
    </Badge>
  );
}

export function TenantStatusBadge({ status }: { status: string }) {
  const label = useEnumLabel();
  return (
    <Badge tone={toneOf<TenantStatus>(status, TENANT_STATUS_TONES)}>
      {label('tenantStatus', status)}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const label = useEnumLabel();
  // PLATFORM_ADMIN runs the platform itself; it reads differently on purpose so nobody confuses it
  // with an operator's own SUPER_ADMIN.
  const tone: Tone =
    role === 'PLATFORM_ADMIN' ? 'info' : role === 'SUPER_ADMIN' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{label('adminRole', role)}</Badge>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  const t = useT();
  return (
    <Badge tone={isActive ? 'success' : 'muted'}>
      {isActive ? t('field.active') : t('field.deactivated')}
    </Badge>
  );
}
