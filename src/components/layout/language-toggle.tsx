import { Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, LOCALE_NATIVE_NAMES } from '@/lib/i18n/locales';
import { useI18n, useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

/**
 * The language picker.
 *
 * Each language is listed in ITSELF — «العربية», not "Arabic". A picker exists for someone who
 * cannot read the language currently on screen, so translating the options defeats the one job it
 * has.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label={t('language.switch')}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => {
              setLocale(option);
            }}
            className={cn(option === locale && 'font-semibold text-[var(--primary)]')}
            // The chosen language is announced, not just coloured.
            aria-current={option === locale ? 'true' : undefined}
          >
            {LOCALE_NATIVE_NAMES[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
