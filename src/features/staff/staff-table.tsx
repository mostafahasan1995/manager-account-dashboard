import { Link } from '@tanstack/react-router';
import { ShieldOff } from 'lucide-react';

import { CopyableValue } from '@/components/common/copy-button';
import { ActiveBadge, RoleBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/use-translation';
import type { AdminUser } from '@/types';

import { staffMessages } from './messages';

/**
 * The directory itself.
 *
 * The only column that is not straight from the row is the approval-limit flag: an admin whose role
 * decides deposits but who has no open limit version cannot approve anything, and finding that out
 * from a failed approval at 2am is worse than seeing it here.
 */
export function StaffTable({
  admins,
  noOpenLimit,
}: {
  admins: readonly AdminUser[];
  /** Ids of admins who decide deposits and have no limit version in force. */
  noOpenLimit: ReadonlySet<string>;
}) {
  const t = useT(staffMessages);

  return (
    <Table>
      <TableCaption>{t('staff.table.caption', { count: admins.length })}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('staff.column.name')}</TableHead>
          <TableHead>{t('field.username')}</TableHead>
          <TableHead>{t('field.telegramId')}</TableHead>
          <TableHead>{t('field.role')}</TableHead>
          <TableHead>{t('staff.column.account')}</TableHead>
          <TableHead>{t('staff.column.lastLogin')}</TableHead>
          <TableHead>{t('staff.column.added')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {admins.map((admin) => (
          <TableRow key={admin.id}>
            <TableCell>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/staff/$adminId"
                  params={{ adminId: admin.id }}
                  className="font-medium text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  {admin.displayName}
                </Link>
                {noOpenLimit.has(admin.id) ? (
                  <Tooltip content={t('staff.noLimitTooltip')}>
                    <Badge tone="danger">
                      <ShieldOff className="size-3" />
                      {t('staff.noLimitBadge')}
                    </Badge>
                  </Tooltip>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-[var(--muted-foreground)]">
              {admin.username === null ? '—' : `@${admin.username}`}
            </TableCell>
            <TableCell>
              {admin.telegramUserId === null ? (
                <span aria-label={t('staff.telegram.none')}>—</span>
              ) : (
                <CopyableValue value={admin.telegramUserId} />
              )}
            </TableCell>
            <TableCell>
              <RoleBadge role={admin.role} />
            </TableCell>
            <TableCell>
              <ActiveBadge isActive={admin.isActive} />
            </TableCell>
            <TableCell className="text-[var(--muted-foreground)]">
              {admin.lastLoginAt === null ? (
                t('staff.neverSignedIn')
              ) : (
                <TimeAgo value={admin.lastLoginAt} />
              )}
            </TableCell>
            <TableCell className="text-[var(--muted-foreground)]">
              <TimeAgo value={admin.createdAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
