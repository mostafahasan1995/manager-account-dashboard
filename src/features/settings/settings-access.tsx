import { Check } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { capabilitiesOf } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';

import { settingsMessages } from './messages';

/**
 * What this role may do — only what it may do.
 *
 * The console knows the full capability table, so it could just as easily list every cross. It
 * deliberately does not: a page of things you are not allowed to do reads as a complaint and tells
 * an operator nothing they can act on. One sentence covers the rest, and the server enforces it
 * either way.
 */
export function SettingsAccess() {
  const { role } = useAuth();
  const t = useT(settingsMessages);
  const enumLabel = useEnumLabel();
  const capabilities = capabilitiesOf(role);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.access.title')}</CardTitle>
        <CardDescription>
          {role === null
            ? t('settings.access.signedOut')
            : t('settings.access.description', { role: enumLabel('adminRole', role) })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {capabilities.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('settings.access.noCapabilities')}
          </p>
        ) : (
          <ul className="space-y-2">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
                  aria-hidden="true"
                />
                <span>
                  {t(`settings.capability.${capability}`)}
                  {/* The capability id itself is what the API refuses by name, so it is never
                      translated — and it sits after the sentence in either direction. */}
                  <span className="ms-2 font-mono text-xs text-[var(--muted-foreground)]">
                    {capability}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-[var(--muted-foreground)]">{t('settings.access.footnote')}</p>
      </CardContent>
    </Card>
  );
}
