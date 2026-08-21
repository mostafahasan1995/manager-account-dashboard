import { useNavigate, useSearch } from '@tanstack/react-router';

import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RECONCILIATION_TABS, type ReconciliationTab } from '@/app/search-schemas';
import { useT } from '@/lib/i18n/use-translation';

import { BreakDetailSheet } from './break-detail-sheet';
import { BreakFilters } from './break-filters';
import { BreakList } from './break-list';
import { FloatSyncPanel } from './float-sync-panel';
import { LedgerChecksTab } from './ledger-checks-tab';
import { reconMessages } from './messages';
import { RailAgeingTab } from './rail-ageing-tab';

/** The tab ids live in the URL, so they are keys into the bundle rather than text of their own. */
const TAB_KEYS = {
  breaks: 'recon.tab.breaks',
  ageing: 'recon.tab.ageing',
  ledger: 'recon.tab.ledger',
} as const satisfies Record<ReconciliationTab, string>;

/**
 * Where somebody finds out the books and the casino disagree.
 *
 * The three tabs answer three different questions and are deliberately not merged: what is broken
 * right now (breaks), what has been quietly waiting too long (rail ageing), and whether the ledger
 * is even consistent with itself (invariants). The tab lives in the URL along with the filters, so
 * a finding can be sent to whoever has to act on it as a single link.
 */
export function ReconciliationPage() {
  const search = useSearch({ from: '/reconciliation' });
  const navigate = useNavigate();
  const t = useT(reconMessages);
  const tab: ReconciliationTab = search.tab ?? 'breaks';

  const selectTab = (value: string) => {
    const next = RECONCILIATION_TABS.find((entry) => entry === value) ?? 'breaks';
    void navigate({ to: '.', search: (prev) => ({ ...prev, tab: next }) });
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.reconciliation')} description={t('recon.description')} />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList>
          {RECONCILIATION_TABS.map((entry) => (
            <TabsTrigger key={entry} value={entry}>
              {t(TAB_KEYS[entry])}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="breaks" className="space-y-4">
          <FloatSyncPanel />
          <BreakFilters />
          <BreakList />
          <BreakDetailSheet />
        </TabsContent>

        <TabsContent value="ageing">
          <RailAgeingTab />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerChecksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
