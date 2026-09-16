import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { Alert, Button, Card, CardContent, Label, Textarea } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';

import {
  INTERACTIVE_MESSAGE_COUNT,
  QUEUED_MESSAGE_COUNT,
  QUOTED_CREDITED,
  QUOTED_WELCOME,
  QUOTED_WELCOME_REFERRAL,
} from './bot-surface';
import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * "The bot's messages" — which is not one list, and the reason this screen refuses to draw one.
 *
 * ── WHY A MAP INSTEAD OF AN EDITOR ────────────────────────────────────────────────────────────
 * There is no template table, no template model and no tenant dimension on the bot's own
 * `defineMessages`, so every player-facing string is a TypeScript literal compiled into the bundle.
 * An editor over that is a text box that changes nothing.
 *
 * WORSE, and this is the part a plausible-looking editor would hide: the strings do not live in one
 * place. The interactive replies are one Arabic bundle; the queued deposit notifications are a
 * SECOND surface, in another file, rendered by a switch that answers in ENGLISH; the admin bot has
 * no bundle at all and writes its sentences where it sends them; and some of the most-read text —
 * the welcome below — is inline in the handler. A screen claiming to list "all your bot's messages"
 * would be showing a fraction of them under a title that said otherwise.
 *
 * So this section names the surfaces it can point at and stops there. It is NOT an inventory, and
 * the copy no longer counts the surfaces out loud: nothing enumerates the bot's text over the API,
 * so a number here would be a completeness claim nobody can check — including the next person to
 * add a fifth card.
 *
 * The one thing that IS interactive here is a draft box with no save button. That absence is the
 * design: a box that accepts typing and then offers to "save" it is exactly the lie this screen was
 * written against, and a box with the save button missing, explained, is not.
 */
export function MessageSurfacesPanel() {
  const t = useT(botConfigMessages);

  return (
    <div className="space-y-4">
      <Alert tone="warning" title={t('botConfig.messages.title')}>
        {t('botConfig.messages.body')}
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader title={t('botConfig.messages.interactive.title')} state="reading">
            {t('botConfig.messages.interactive.body', { count: INTERACTIVE_MESSAGE_COUNT })}
          </SectionHeader>
          <CardContent>
            <Quote text={WELCOME} conditional={WELCOME_REFERRAL} />
          </CardContent>
        </Card>

        {/* "Reading", not "live": these templates are compiled into the bot exactly like the ones
            above, and nothing on this console writes them. The badge means "saved here", and the
            notifications being genuinely sent is not the same claim. */}
        <Card>
          <SectionHeader title={t('botConfig.messages.queued.title')} state="reading">
            {t('botConfig.messages.queued.body', { count: QUEUED_MESSAGE_COUNT })}
          </SectionHeader>
          <CardContent className="space-y-3">
            <Quote text={CREDITED} />
            <Alert tone="warning">{t('botConfig.messages.queued.warning')}</Alert>
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title={t('botConfig.messages.admin.title')} state="reading">
            {t('botConfig.messages.admin.body')}
          </SectionHeader>
        </Card>

        <Card>
          <SectionHeader title={t('botConfig.messages.inline.title')} state="reading">
            {t('botConfig.messages.inline.body')}
          </SectionHeader>
        </Card>
      </div>

      <DraftCard />
    </div>
  );
}

/**
 * A piece of the bot's text and the language it is written in.
 *
 * Carried together, and never inferred, because the two are easy to drift apart: the credited
 * notification is ENGLISH while everything around it is Arabic, and a box that inherits the
 * console's RTL for that string lays English out backwards, one card below a quote of the same
 * string that got it right. The pair is the one source a quote and its draft box read their
 * direction from, so they cannot disagree again.
 */
interface BotText {
  readonly value: string;
  readonly language: 'ar' | 'en';
}

const WELCOME: BotText = { value: QUOTED_WELCOME, language: 'ar' };
const WELCOME_REFERRAL: BotText = { value: QUOTED_WELCOME_REFERRAL, language: 'ar' };
const CREDITED: BotText = { value: QUOTED_CREDITED, language: 'en' };

const dirOf = (text: BotText): 'rtl' | 'ltr' => (text.language === 'ar' ? 'rtl' : 'ltr');

const QUOTE_BOX =
  'rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs whitespace-pre-line';

/**
 * The bot's own text, marked as a quotation and rendered in its own direction.
 *
 * `conditional` is a line the handler appends only sometimes. It is here rather than dropped —
 * leaving it out hides text a referred player really reads — and behind its own caption rather than
 * run on, which would say every player reads it.
 */
function Quote({ text, conditional }: { text: BotText; conditional?: BotText }) {
  const t = useT(botConfigMessages);

  return (
    <figure className="space-y-1">
      <figcaption className="text-xs text-[var(--muted-foreground)]">
        {t('botConfig.messages.quoted')}
      </figcaption>
      <blockquote dir={dirOf(text)} lang={text.language} className={QUOTE_BOX}>
        {text.value}
      </blockquote>
      {conditional === undefined ? null : (
        <>
          <figcaption className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.messages.conditional')}
          </figcaption>
          <blockquote dir={dirOf(conditional)} lang={conditional.language} className={QUOTE_BOX}>
            {conditional.value}
          </blockquote>
        </>
      )}
    </figure>
  );
}

/** A draft box over one quoted string, taking its direction from the same pair the quote reads. */
function DraftField({
  id,
  label,
  text,
  value,
  onChange,
}: {
  id: string;
  label: string;
  text: BotText;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        dir={dirOf(text)}
        lang={text.language}
        value={value}
        className="min-h-28"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

function DraftCard() {
  const t = useT(botConfigMessages);
  const [welcome, setWelcome] = useState(WELCOME.value);
  const [credited, setCredited] = useState(CREDITED.value);

  const edited = welcome !== WELCOME.value || credited !== CREDITED.value;

  return (
    <Card>
      <SectionHeader title={t('botConfig.messages.draft.title')} state="draft">
        {t('botConfig.messages.draft.body')}
      </SectionHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DraftField
            id="draft-welcome"
            label={t('botConfig.messages.draft.welcome')}
            text={WELCOME}
            value={welcome}
            onChange={setWelcome}
          />
          <DraftField
            id="draft-credited"
            label={t('botConfig.messages.draft.credited')}
            text={CREDITED}
            value={credited}
            onChange={setCredited}
          />
        </div>

        {/* The only control on a draft card: putting the bot's own words back. There is nothing to
            save to, so there is nothing that saves. */}
        <Button
          variant="secondary"
          size="sm"
          disabled={!edited}
          onClick={() => {
            setWelcome(WELCOME.value);
            setCredited(CREDITED.value);
          }}
        >
          <RotateCcw aria-hidden="true" />
          {t('botConfig.messages.draft.reset')}
        </Button>
      </CardContent>
    </Card>
  );
}
