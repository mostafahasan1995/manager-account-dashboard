import { config } from '@/config';

import { useT } from './use-translation';

/**
 * The name this console calls itself, in the reader's language.
 *
 * Two callers — the sidebar and the sign-in screen — and they must never disagree, because they are
 * the first and second thing a new operator reads. Before this existed both rendered
 * `config.appName`, an env string with no Arabic, so a fully Arabic screen carried an English
 * product name in the one place a person looks to find out where they are.
 *
 * A deployment that sets `VITE_APP_NAME` still wins. That name is untranslatable by construction —
 * it arrives at build time — and a deployment that chose one has said what it wants to be called.
 */
export function useAppName(): string {
  const t = useT();
  return config.appName.length > 0 ? config.appName : t('app.name');
}
