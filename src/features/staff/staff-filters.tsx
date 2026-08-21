import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { ADMIN_ROLES, type AdminRole } from '@/types/enums';

import { staffMessages } from './messages';

/**
 * The directory's two filters.
 *
 * Both are emitted as a whole filter state rather than as a patch: the page writes them straight
 * into the URL, and "role cleared" has to be expressible as `undefined` rather than as an absent
 * key that the previous search would then win back.
 */

/** Radix Select has no empty value, so "no filter" needs a sentinel of its own. */
const ANY = 'ANY';

export interface StaffFilterState {
  role: AdminRole | undefined;
  isActive: boolean | undefined;
}

export function StaffFilters({
  role,
  isActive,
  onChange,
}: StaffFilterState & { onChange: (next: StaffFilterState) => void }) {
  const t = useT(staffMessages);
  const enumLabel = useEnumLabel();
  const filtered = role !== undefined || isActive !== undefined;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="staff-role">{t('field.role')}</Label>
        <Select
          value={role ?? ANY}
          onValueChange={(value) => {
            onChange({ role: ADMIN_ROLES.find((entry) => entry === value), isActive });
          }}
        >
          <SelectTrigger id="staff-role" aria-label={t('field.role')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('staff.filters.allRoles')}</SelectItem>
            {ADMIN_ROLES.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {enumLabel('adminRole', entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="staff-active">{t('staff.filters.accountState')}</Label>
        <Select
          value={isActive === undefined ? ANY : String(isActive)}
          onValueChange={(value) => {
            onChange({ role, isActive: value === ANY ? undefined : value === 'true' });
          }}
        >
          <SelectTrigger id="staff-active" aria-label={t('staff.filters.accountState')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('staff.filters.anyState')}</SelectItem>
            <SelectItem value="true">{t('staff.filters.activeOnly')}</SelectItem>
            <SelectItem value="false">{t('staff.filters.deactivatedOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange({ role: undefined, isActive: undefined });
          }}
        >
          <X className="size-3.5" />
          {t('common.clearFilters')}
        </Button>
      ) : null}
    </div>
  );
}
