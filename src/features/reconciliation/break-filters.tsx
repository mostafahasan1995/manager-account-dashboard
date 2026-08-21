import { useNavigate, useSearch } from '@tanstack/react-router';
import { FilterX } from 'lucide-react';
import { useId } from 'react';

import { pruneSearch } from '@/app/search-schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import {
  BREAK_CATEGORIES,
  BREAK_STATUSES,
  type BreakCategory,
  type BreakStatus,
} from '@/types/enums';

import { DEFAULT_BREAK_STATUSES } from './break-display';
import { reconMessages } from './messages';

/**
 * The breaks filter bar.
 *
 * Every control writes to the URL, so the exact view an operator is looking at survives a refresh
 * and can be pasted to whoever they are asking about it. Clearing the last status does not mean
 * "show nothing" — the parameter leaves the URL and the default open/investigating pair comes back,
 * visibly, in the boxes.
 */
export function BreakFilters() {
  const search = useSearch({ from: '/reconciliation' });
  const navigate = useNavigate();
  const t = useT(reconMessages);
  const enumLabel = useEnumLabel();
  const fieldId = useId();

  const statuses = search.status ?? DEFAULT_BREAK_STATUSES;
  const categories = search.category ?? [];
  const filtered =
    search.status !== undefined || search.category !== undefined || search.minSeverity !== undefined;

  const setStatus = (value: BreakStatus[]) => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ ...prev, status: value }) });
  };

  const setCategory = (value: BreakCategory[]) => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ ...prev, category: value }) });
  };

  const setMinSeverity = (value: number | undefined) => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ ...prev, minSeverity: value }) });
  };

  const clearAll = () => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ tab: prev.tab, selected: prev.selected }) });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('field.status')}
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {BREAK_STATUSES.map((status) => {
              const id = `${fieldId}-status-${status}`;
              const checked = statuses.includes(status);
              return (
                <div key={status} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => {
                      setStatus(
                        next === true
                          ? [...statuses, status]
                          : statuses.filter((entry) => entry !== status),
                      );
                    }}
                  />
                  <Label htmlFor={id} className="cursor-pointer font-normal">
                    {enumLabel('breakStatus', status)}
                  </Label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{t('recon.filters.statusHint')}</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {t('recon.field.category')}
          </legend>
          <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {BREAK_CATEGORIES.map((category) => {
              const id = `${fieldId}-category-${category}`;
              const checked = categories.includes(category);
              return (
                <div key={category} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => {
                      setCategory(
                        next === true
                          ? [...categories, category]
                          : categories.filter((entry) => entry !== category),
                      );
                    }}
                  />
                  <Label htmlFor={id} className="cursor-pointer font-normal">
                    {enumLabel('breakCategory', category)}
                  </Label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-44 space-y-1.5">
            <Label htmlFor={`${fieldId}-severity`}>{t('recon.filters.minSeverity')}</Label>
            <Select
              value={search.minSeverity === undefined ? 'any' : String(search.minSeverity)}
              onValueChange={(value) => {
                setMinSeverity(value === 'any' ? undefined : Number(value));
              }}
            >
              <SelectTrigger id={`${fieldId}-severity`}>
                <SelectValue placeholder={t('recon.filters.anySeverity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('recon.filters.anySeverity')}</SelectItem>
                {[1, 2, 3, 4, 5].map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    {t('recon.filters.severityAndAbove', { level })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <FilterX className="size-3.5" />
              {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
