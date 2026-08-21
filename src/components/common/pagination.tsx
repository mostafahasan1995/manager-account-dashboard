import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import type { PageMeta } from '@/types/api';

/** Offset pagination — players and the admin directory. */
export function Pagination({
  meta,
  onOffsetChange,
  disabled = false,
}: {
  meta: PageMeta | undefined;
  onOffsetChange: (offset: number) => void;
  disabled?: boolean;
}) {
  const t = useT();
  if (meta === undefined) return null;

  const { total, limit, offset, hasMore } = meta;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-3 py-2.5 text-sm">
      <p className="text-[var(--muted-foreground)]">
        {total === 0
          ? t('state.noResults')
          : t('state.range', {
              from: formatCount(from),
              to: formatCount(to),
              total: formatCount(total),
            })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || offset === 0}
          onClick={() => {
            onOffsetChange(Math.max(0, offset - limit));
          }}
        >
          <ChevronLeft className="size-3.5 rtl:rotate-180" />
          {t('common.previous')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !hasMore}
          onClick={() => {
            onOffsetChange(offset + limit);
          }}
        >
          {t('common.next')}
          <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Cursor pagination — the deposit queue and reconciliation breaks.
 *
 * A "load more" rather than pages: both lists are ordered by time and change under the reader, so
 * page numbers would point at different rows a minute later.
 */
export function LoadMore({
  hasMore,
  loading,
  loadedCount,
  onLoadMore,
  noun,
}: {
  hasMore: boolean;
  loading: boolean;
  loadedCount: number;
  onLoadMore: () => void;
  /** What is being counted, already translated. */
  noun?: string;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-3 py-2.5 text-sm">
      <p className="text-[var(--muted-foreground)]">
        {t('state.loadedCount', { count: loadedCount, noun: noun ?? t('state.items') })}
      </p>
      {hasMore ? (
        <Button variant="secondary" size="sm" onClick={onLoadMore} loading={loading}>
          {t('common.loadMore')}
        </Button>
      ) : (
        <span className="text-xs text-[var(--muted-foreground)]">{t('state.endOfList')}</span>
      )}
    </div>
  );
}
