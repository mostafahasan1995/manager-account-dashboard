import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/lib/i18n/use-translation';
import { useTheme } from '@/lib/theme/use-theme';
import type { ThemePreference } from '@/lib/theme/theme-context';
import { cn } from '@/lib/utils';

import { settingsMessages } from './messages';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Theme, as three real radios rather than a cycling icon button.
 *
 * The topbar already has the quick toggle; this is where "system" stops being a hidden third state
 * somebody lands on by clicking twice. Which one is actually on screen is spelled out too, because
 * "System" alone does not answer the question a night-shift reviewer is asking.
 */
export function SettingsAppearance() {
  const { preference, resolved, setPreference } = useTheme();
  const t = useT(settingsMessages);

  // Built here rather than at module load: a table of English strings frozen at import time is
  // exactly what survives a language switch.
  const options: readonly ThemeOption[] = [
    {
      value: 'light',
      label: t('theme.light'),
      hint: t('settings.appearance.hintLight'),
      icon: Sun,
    },
    { value: 'dark', label: t('theme.dark'), hint: t('settings.appearance.hintDark'), icon: Moon },
    {
      value: 'system',
      label: t('theme.system'),
      hint: t('settings.appearance.hintSystem'),
      icon: Monitor,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appearance.title')}</CardTitle>
        <CardDescription>{t('settings.appearance.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t('settings.appearance.theme')}</legend>

          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((option) => {
              const Icon = option.icon;
              const selected = preference === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]',
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary-muted)]'
                      : 'border-[var(--border)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  <input
                    type="radio"
                    name="theme-preference"
                    value={option.value}
                    checked={selected}
                    onChange={() => {
                      setPreference(option.value);
                    }}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4" aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">{option.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Two sentences rather than one with the palette name dropped in: "the {light} palette"
            needs an article and an agreement in Arabic that a substitution cannot produce. */}
        <p className="text-xs text-[var(--muted-foreground)]">
          {resolved === 'dark'
            ? t('settings.appearance.showingDark')
            : t('settings.appearance.showingLight')}
        </p>
      </CardContent>
    </Card>
  );
}
