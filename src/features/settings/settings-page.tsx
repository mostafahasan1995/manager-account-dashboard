import { PageHeader } from '@/components/common/page-header';
import { useT } from '@/lib/i18n/use-translation';

import { settingsMessages } from './messages';
import { SettingsAccess } from './settings-access';
import { SettingsAppearance } from './settings-appearance';
import { SettingsConnection } from './settings-connection';
import { SettingsMaintenance } from './settings-maintenance';
import { SettingsProfile } from './settings-profile';

/**
 * The only screen every role can open.
 *
 * It answers the questions an operator asks about the console itself rather than about money: who
 * am I signed in as, how long have I got, what am I allowed to do, and is the backend actually
 * there. Maintenance is the one thing here that writes, so it is the one thing gated.
 */
export function SettingsPage() {
  const t = useT(settingsMessages);

  return (
    <div className="space-y-6">
      {/* The heading is the nav label, not a second copy of it: two spellings of the same screen
          is how a language ends up half translated. */}
      <PageHeader title={t('nav.settings')} description={t('settings.page.description')} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SettingsProfile />
          <SettingsAppearance />
        </div>
        <div className="space-y-6">
          <SettingsAccess />
          <SettingsConnection />
        </div>
      </div>

      <SettingsMaintenance />
    </div>
  );
}
