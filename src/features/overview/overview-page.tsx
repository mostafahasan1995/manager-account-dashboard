import { Can, PageHeader } from '@/components/common';
import { useT } from '@/lib/i18n/use-translation';

import { overviewMessages } from './messages';
import { OldestWaiting } from './oldest-waiting';
import { OpenBreaks } from './open-breaks';
import { QueueTiles } from './queue-tiles';
import { SystemStrip } from './system-strip';

/**
 * What a cashier sees when the console opens at the start of a shift.
 *
 * It answers one question — what needs me right now — so everything on it is a link into the screen
 * that acts on it, and a number nobody can act on is left off. The counts are honest about their
 * source: the queue is cursor paginated and sends no total, so a tile says "20+" rather than
 * inventing one.
 *
 * Every block is laid out so a role that cannot see it leaves no hole. A SUPPORT user has no
 * reconciliation, so the breaks tile, the breaks panel and the system strip all disappear and the
 * remaining tiles simply fill the row.
 */
export function OverviewPage() {
  const t = useT(overviewMessages);

  return (
    <div className="space-y-6">
      {/* The heading is the nav label, from the shared bundle: the screen a link is named after
          should carry the same word once it opens. */}
      <PageHeader title={t('nav.overview')} description={t('overview.description')} />

      <QueueTiles />

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          <OldestWaiting />
        </div>
        <Can capability="reconciliation.read">
          <div className="min-w-0 flex-1">
            <OpenBreaks />
          </div>
        </Can>
      </div>

      <Can capability="reconciliation.read">
        <SystemStrip />
      </Can>
    </div>
  );
}
