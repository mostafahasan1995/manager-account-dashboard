import { Link } from '@tanstack/react-router';
import { Radio } from 'lucide-react';

import { PageHeader } from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { usePaymentMethods } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { BotSettingsCard } from './bot-settings-card';
import { CommandMenuPanel } from './command-menu-panel';
import { IdentityPanel } from './identity-panel';
import { MessageSurfacesPanel } from './message-surfaces-panel';
import { botConfigMessages } from './messages';
import { FlowPanel } from './flow-panel';
import { PaymentButtonsPanel } from './payment-buttons-panel';
import { SurfaceBadge } from './surface-state';

/**
 * How the operator's bot LOOKS to a player: its buttons, its commands, its text and its name.
 *
 * ══ THE RULE THIS SCREEN IS BUILT ON ══════════════════════════════════════════════════════════
 * Every section says whether editing it changes the bot, and the ones that do not say what is
 * missing. That is not a disclaimer bolted onto a settings page — it is the reason the page can
 * exist at all. Almost everything a person means by "how my bot looks" is compiled into the bot
 * today: the command menu is a frozen constant, the /start grid is built at module load, the
 * messages are TypeScript literals scattered across several files, and the bot's own name is a
 * string in a handler. A console that rendered those as a settings form would be a screen where an
 * operator types a new welcome, presses save, and tells their players about a message the bot will
 * never send.
 *
 * The alternative is not "leave it out". An operator asking what their bot says deserves a true
 * answer, and the true answer is worth reading: it names the surfaces this console can point at,
 * shows exactly what each one holds today, and points at the one change — a handler reading
 * `tenant.displayName` — that would turn the largest read-only section into a live one.
 *
 * It stops short of counting them. Nothing serves an inventory of the bot's text, so "here are the
 * four" is a completeness claim this screen cannot stand behind — and the same promise that forbids
 * a fake save button forbids a real-looking total.
 *
 * ══ WHAT IS ACTUALLY LIVE HERE ════════════════════════════════════════════════════════════════
 *   the payment buttons   `displayName`, `sortOrder`, `isActive` and `instructions` on a payment
 *                         method ARE the bot's keyboard. Editing them here edits the bot.
 *   notification routing  fully wired, and it has its own screen — linked, not rebuilt.
 * Everything else on this page is a reading of the bot, marked as one.
 *
 * ══ WHY IT IS NOT UNDER /settings ═════════════════════════════════════════════════════════════
 * That folder is the CONSOLE's own settings — language, theme, the signed-in admin's access — and
 * its route carries no capability because every role may open it. This is the operator's product
 * surface, gated on the capability that already means "may configure my own bot's Telegram side".
 */
export function BotConfigPage() {
  const t = useT(botConfigMessages);
  const methods = usePaymentMethods();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('botConfig.title')}
        description={t('botConfig.description')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/telegram">
              <Radio aria-hidden="true" />
              {t('botConfig.routing.link')}
            </Link>
          </Button>
        }
      />

      {/* The whole screen in one paragraph, before any control. An operator who reads only this
          still knows which half of the page is theirs. */}
      <Alert tone="info" title={t('botConfig.honest.title')}>
        {t('botConfig.honest.body')}
      </Alert>

      {/* Routing is genuinely live and genuinely belongs to "how my bot behaves", so it is named
          here — as a link. Rebuilding the destinations table on a second screen would give an
          operator two places to bind a chat and no way to tell which one they last used. */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          {/* The one section on this screen that does not go through `SectionHeader`, so it names
              itself the same way by hand: title, marker and body as one landmark. */}
          <div
            className="min-w-0 space-y-1"
            role="region"
            aria-label={t('botConfig.routing.title')}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{t('botConfig.routing.title')}</h2>
              <SurfaceBadge state="live" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{t('botConfig.routing.body')}</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/telegram">{t('botConfig.routing.link')}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* `flow` is the default because it is the only tab that CHANGES the bot's own menu, and it
          is what an operator opening "bot configuration" came for. The rest read or edit around
          it. */}
      <Tabs defaultValue="flow">
        {/* Wraps rather than scrolls: five labels do not fit one 390px line, and a tab list that
            scrolls sideways hides the tab an operator has not thought to look for. */}
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="flow">{t('botConfig.tab.flow')}</TabsTrigger>
          <TabsTrigger value="buttons">{t('botConfig.tab.buttons')}</TabsTrigger>
          <TabsTrigger value="commands">{t('botConfig.tab.commands')}</TabsTrigger>
          <TabsTrigger value="messages">{t('botConfig.tab.messages')}</TabsTrigger>
          <TabsTrigger value="identity">{t('botConfig.tab.identity')}</TabsTrigger>
          <TabsTrigger value="settings">{t('botConfig.tab.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="flow">
          <FlowPanel />
        </TabsContent>

        <TabsContent value="buttons">
          <PaymentButtonsPanel
            methods={methods.data}
            isPending={methods.isPending}
            error={methods.error}
            onRetry={() => {
              void methods.refetch();
            }}
          />
        </TabsContent>

        <TabsContent value="commands">
          <CommandMenuPanel />
        </TabsContent>

        <TabsContent value="messages">
          <MessageSurfacesPanel />
        </TabsContent>

        <TabsContent value="identity">
          <IdentityPanel />
        </TabsContent>

        {/* The two runtime settings that are not buttons — live, like the flow, and kept apart from
            it because a mini-app URL and a cash-out mode are not a keyboard. */}
        <TabsContent value="settings">
          <BotSettingsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
