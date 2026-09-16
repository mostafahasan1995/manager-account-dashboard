import { useState } from 'react';

import {
  Alert,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';

import {
  BOT_DESCRIPTION,
  BOT_DESCRIPTION_MAX,
  BOT_NAME,
  BOT_SHORT_DESCRIPTION,
  BOT_SHORT_DESCRIPTION_MAX,
} from './bot-surface';
import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * The bot's own name and profile — a working form over nothing, and it says so.
 *
 * ── WHY THE BRANDING NOTE IS THE FIRST THING ON THIS CARD ─────────────────────────────────────
 * `ABOUT_NAME = 'Ichancy Cashier'` is a literal interpolated into /start, /help and /about, so
 * every operator's bot introduces itself with the same name. The operator's own name is already in
 * the database — `tenant.displayName`, set when the operator was created — and NO bot handler reads
 * it. That is the single cheapest change on the whole roadmap of this screen: one handler reading a
 * column that already has the right value in it, and every operator's bot becomes theirs. Saying so
 * plainly is worth more than any control this card could offer, so it is placed above them.
 *
 * ── WHY THE FIELDS ARE EDITABLE AND THERE IS NO SAVE BUTTON ───────────────────────────────────
 * Disabling them would say "you lack permission", which is false — nobody has this permission,
 * because there is nothing to permit. Hiding them would say the questions are not worth asking,
 * when they are the questions an operator opens this screen to ask. So they type, they hold what
 * was typed, the character counters against Telegram's real caps work, and the one control that
 * would be a lie — a save button — is absent, with the absence explained rather than left to be
 * discovered.
 */
export function IdentityPanel() {
  const t = useT(botConfigMessages);
  const { session } = useAuth();

  const [name, setName] = useState(BOT_NAME);
  const [description, setDescription] = useState(BOT_DESCRIPTION);
  const [shortDescription, setShortDescription] = useState(BOT_SHORT_DESCRIPTION);
  const [menuButton, setMenuButton] = useState('commands');
  const [language, setLanguage] = useState('ar');

  const slug = session?.tenantSlug ?? null;

  return (
    <div className="space-y-4">
      <Alert tone="info" title={t('botConfig.identity.brandTitle')}>
        <p>{t('botConfig.identity.brandBody')}</p>
        <p className="font-medium text-[var(--foreground)]">
          {slug === null
            ? t('botConfig.identity.brandUnknown')
            : t('botConfig.identity.brandYours', { slug })}
        </p>
      </Alert>

      <Card>
        <SectionHeader title={t('botConfig.identity.title')} state="draft">
          {t('botConfig.identity.body')}
        </SectionHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bot-name">{t('botConfig.identity.name')}</Label>
            {/* `dir="ltr"`, like the command table and for the same reason: the value seeded here
                is a Latin literal quoted from the bot, and in an RTL field the neutrals around it —
                a trailing emoji, a hyphen, the caret an operator types at — resolve to the
                paragraph's direction and jump to the far end. The two Arabic texts below carry the
                opposite marking for the same reason, so neither inherits the console's. */}
            <Input
              id="bot-name"
              dir="ltr"
              value={name}
              autoComplete="off"
              className="max-w-sm"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.identity.nameHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bot-description">{t('botConfig.identity.description')}</Label>
            <Textarea
              id="bot-description"
              dir="rtl"
              lang="ar"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
            <CharacterCount value={description} max={BOT_DESCRIPTION_MAX} />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.identity.descriptionHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bot-short">{t('botConfig.identity.short')}</Label>
            <Input
              id="bot-short"
              dir="rtl"
              lang="ar"
              value={shortDescription}
              autoComplete="off"
              onChange={(event) => {
                setShortDescription(event.target.value);
              }}
            />
            <CharacterCount value={shortDescription} max={BOT_SHORT_DESCRIPTION_MAX} />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.identity.shortHint')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bot-menu-button">{t('botConfig.identity.menuButton')}</Label>
              <Select value={menuButton} onValueChange={setMenuButton}>
                <SelectTrigger id="bot-menu-button">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commands">
                    {t('botConfig.identity.menuButton.commands')}
                  </SelectItem>
                  <SelectItem value="webApp">
                    {t('botConfig.identity.menuButton.webApp')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('botConfig.identity.menuButtonHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bot-language">{t('botConfig.identity.language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="bot-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t('botConfig.identity.language.ar')}</SelectItem>
                  <SelectItem value="en">{t('botConfig.identity.language.en')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('botConfig.identity.languageHint')}
              </p>
            </div>
          </div>

          <Alert tone="neutral">{t('botConfig.identity.noSave')}</Alert>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Telegram's own caps, counted as you type.
 *
 * Real limits on a draft field, which sounds contradictory and is not: the caps are the one part of
 * this card that is already true, and an operator drafting a description worth 700 characters is
 * drafting something that could never be pushed even after the rest of this works.
 */
function CharacterCount({ value, max }: { value: string; max: number }) {
  const t = useT(botConfigMessages);
  const over = value.length > max;

  return (
    <p className={over ? 'text-xs text-[var(--danger)]' : 'text-xs text-[var(--muted-foreground)]'}>
      {over
        ? t('botConfig.identity.overLimit', { max })
        : t('botConfig.identity.chars', { count: value.length, max })}
    </p>
  );
}
