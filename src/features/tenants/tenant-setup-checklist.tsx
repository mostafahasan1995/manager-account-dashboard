import { CircleCheck, CircleDashed, CircleDot, CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { Tenant, TenantHealth } from '@/types';
import { isPlatformTenant } from '@/types/tenant';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';
import { sightingFor } from './chat-sighting';
import { TenantChatBinding } from './tenant-chat-binding';

/**
 * The steps between a created operator and one that serves somebody.
 *
 * A new operator lands SUSPENDED with no staff group, so the honest first screen is not a dashboard
 * of green dots — it is a list of what is still missing, in the order it has to be done, with the
 * control for each step beside it. The staff group comes right after the webhook because its link
 * only completes once Telegram delivers to this deployment, and activation is refused without it.
 *
 * ── WHY TWO OF THE STEPS ARE NEITHER DONE NOR TODO ────────────────────────────────────────────────
 * Telegram is never asked what a bot's command menu contains, and this operator's staff list is not
 * readable from the platform screen — `/v1/admin/admins` answers for whichever operator the console
 * is pointed at, which is not necessarily this one. Both steps therefore report that they cannot be
 * checked from here, instead of a tick that would be a guess or a cross that would be a lie. The agent
 * step joins them in Ichancy fake mode: a fake sign-in proves nothing, and neither tick nor cross is
 * honest about it.
 *
 * ── WHY THE FEED GROUP IS "OPTIONAL" RATHER THAN "TODO" ───────────────────────────────────────────
 * An operator with no feed group is fully set up. Counting it as a missing step would keep "every step
 * is done" out of reach forever, and teach people to ignore the count.
 *
 * ── WHY TENANT ZERO HAS ONLY TWO STEPS ────────────────────────────────────────────────────────────
 * Tenant zero is the platform itself, not an operator: no groups, no bot, no Ichancy agent. The
 * backend refuses every group link, bind and removal, a new bot token and an Ichancy edit for it (422
 * TENANT_PLATFORM_LOCKED), and registering its webhook or pushing its menus can only fail (422
 * TENANT_BOT_UNAVAILABLE: its stored token is a placeholder, never a bot). Each of those steps would
 * be a todo nobody can ever tick, with a button that always fails, so they are left out; the panel
 * says why in one sentence above the list. What is left is the two steps that are real for it: an
 * admin who can sign in, and "activated" — which it already is.
 */
export function TenantSetupChecklist({
  tenant,
  health,
  actions,
  commandsSet,
}: {
  tenant: Tenant;
  health: TenantHealth;
  actions: TenantOperatorActions;
  /** How many commands the last push set, when one happened in this session. */
  commandsSet: number | null;
}) {
  const t = useT(tenantMessages);
  const { bot, ichancy } = health;

  const botVerified = bot.ok && bot.username !== null;
  const staffSighting = sightingFor(tenant.adminChatId, health.chats.staff);
  const staffName = staffSighting?.title ?? tenant.adminChatId ?? '';
  const staffRemoved = staffSighting?.isPresent === false;
  const feedSighting = sightingFor(tenant.feedChatId, health.chats.feed);
  const feedName = feedSighting?.title ?? tenant.feedChatId ?? '';
  const feedRemoved = feedSighting?.isPresent === false;
  const platform = isPlatformTenant(tenant);

  const allSteps: ChecklistStep[] = [
    {
      key: 'bot-token',
      title: t('tenants.checklist.botToken'),
      state: botVerified ? 'done' : 'todo',
      body: botVerified
        ? t('tenants.checklist.botTokenDone', { bot: bot.username ?? '' })
        : t('tenants.checklist.botTokenTodo'),
      action: botVerified ? null : (
        <Button variant="secondary" size="sm" onClick={actions.replaceBotToken}>
          {t('tenants.bot.replace')}
        </Button>
      ),
    },
    {
      key: 'webhook',
      title: t('tenants.checklist.webhook'),
      state: bot.webhookMatches ? 'done' : 'todo',
      body: bot.webhookMatches
        ? t('tenants.checklist.webhookDone')
        : t('tenants.checklist.webhookTodo'),
      action: bot.webhookMatches ? null : (
        <Button
          variant="primary"
          size="sm"
          loading={actions.registering}
          onClick={actions.registerWebhook}
        >
          {t('tenants.webhook.register')}
        </Button>
      ),
    },
    {
      key: 'staff-group',
      title: t('tenants.checklist.staffGroup'),
      state: tenant.adminChatId === null || staffRemoved ? 'todo' : 'done',
      body:
        tenant.adminChatId === null
          ? t('tenants.checklist.staffGroupTodo')
          : staffRemoved
            ? t('tenants.checklist.staffGroupRemoved', { name: staffName })
            : t('tenants.checklist.staffGroupDone', { name: staffName }),
      action: <TenantChatBinding tenant={tenant} purpose="STAFF" />,
    },
    {
      key: 'feed-group',
      title: t('tenants.checklist.feedGroup'),
      state: tenant.feedChatId === null ? 'optional' : feedRemoved ? 'todo' : 'done',
      body:
        tenant.feedChatId === null
          ? t('tenants.checklist.feedGroupOff')
          : feedRemoved
            ? t('tenants.checklist.feedGroupRemoved', { name: feedName })
            : t('tenants.checklist.feedGroupDone', { name: feedName }),
      action: <TenantChatBinding tenant={tenant} purpose="FEED" />,
    },
    {
      key: 'commands',
      title: t('tenants.checklist.commands'),
      state: commandsSet === null ? 'unknown' : 'done',
      body:
        commandsSet === null
          ? t('tenants.checklist.commandsUnknown')
          : t('tenants.checklist.commandsDone', { count: commandsSet }),
      action: (
        <Button
          variant="secondary"
          size="sm"
          loading={actions.pushing}
          onClick={actions.pushCommands}
        >
          {t('tenants.commands.push')}
        </Button>
      ),
    },
    {
      key: 'admin',
      title: t('tenants.checklist.admin'),
      state: 'unknown',
      // No control of its own: "Add me as an admin here" sits in this panel's footer, and putting
      // a second copy of it here would give one write two buttons that can be clicked twice.
      body: t('tenants.checklist.adminUnknown', { action: t('tenants.addMe.action') }),
      action: null,
    },
    {
      key: 'agent',
      title: t('tenants.checklist.agent'),
      state: ichancy.fake ? 'unknown' : ichancy.ok ? 'done' : 'todo',
      body: ichancy.fake
        ? t('tenants.checklist.agentFake')
        : ichancy.ok
          ? t('tenants.checklist.agentDone', { agent: ichancy.agentId })
          : t('tenants.checklist.agentTodo'),
      action:
        ichancy.ok || ichancy.fake ? null : (
          <Button variant="secondary" size="sm" onClick={actions.editIchancy}>
            {t('tenants.ichancy.edit')}
          </Button>
        ),
    },
    {
      key: 'active',
      title: t('tenants.checklist.active'),
      state: tenant.status === 'ACTIVE' ? 'done' : 'todo',
      body:
        tenant.status === 'ACTIVE'
          ? t('tenants.checklist.activeDone')
          : tenant.adminChatId === null && !platform
            ? t('tenants.checklist.activeNeedsStaffGroup', { action: t('tenants.activate.action') })
            : t('tenants.checklist.activeTodo', { action: t('tenants.activate.action') }),
      action: null,
    },
  ];
  const steps = platform
    ? allSteps.filter((step) => !NOT_THE_PLATFORMS_STEPS.has(step.key))
    : allSteps;

  const remaining = steps.filter((step) => step.state === 'todo').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tenants.checklist.title')}</CardTitle>
        <CardDescription>
          {remaining === 0
            ? t('tenants.checklist.allDone')
            : t('tenants.checklist.remaining', { count: remaining })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <ChecklistRow key={step.key} step={step} number={index + 1} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** The steps an operator has and the platform does not: each is refused, or can only fail, for it. */
const NOT_THE_PLATFORMS_STEPS: ReadonlySet<string> = new Set([
  'bot-token',
  'webhook',
  'staff-group',
  'feed-group',
  'commands',
  'agent',
]);

type StepState = 'done' | 'todo' | 'unknown' | 'optional';

interface ChecklistStep {
  key: string;
  title: string;
  body: string;
  state: StepState;
  action: ReactNode;
}

const STATE_ICONS = {
  done: CircleCheck,
  todo: CircleDashed,
  unknown: CircleHelp,
  optional: CircleDot,
} as const;

const STATE_COLORS = {
  done: 'text-[var(--success)]',
  todo: 'text-[var(--warning)]',
  unknown: 'text-[var(--muted-foreground)]',
  optional: 'text-[var(--muted-foreground)]',
} as const;

const STATE_TONES = {
  done: 'success',
  todo: 'warning',
  unknown: 'muted',
  optional: 'muted',
} as const;

function ChecklistRow({ step, number }: { step: ChecklistStep; number: number }) {
  const t = useT(tenantMessages);
  const Icon = STATE_ICONS[step.state];
  const stateLabel = {
    done: t('tenants.checklist.stateDone'),
    todo: t('tenants.checklist.stateTodo'),
    unknown: t('tenants.checklist.stateUnknown'),
    optional: t('tenants.checklist.stateOptional'),
  }[step.state];

  return (
    <li className="flex items-start gap-3" data-step={step.key}>
      {/* Never mirrored: a tick and a dashed ring mean the same thing in both directions. */}
      <Icon className={cn('mt-0.5 size-4 shrink-0', STATE_COLORS[step.state])} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="text-[var(--muted-foreground)] tabular">{number}.</span>
          <span>{step.title}</span>
          <Badge tone={STATE_TONES[step.state]}>{stateLabel}</Badge>
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{step.body}</p>
        {step.action === null ? null : <div className="pt-1">{step.action}</div>}
      </div>
    </li>
  );
}
