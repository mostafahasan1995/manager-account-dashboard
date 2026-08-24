import { CircleDashed, CircleHelp, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { Tenant, TenantHealth } from '@/types';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';

/**
 * The six steps between a created operator and one that serves somebody.
 *
 * A new operator lands SUSPENDED with a webhook path Telegram has never heard of, so the honest
 * first screen is not a dashboard of green dots — it is a list of what is still missing, in the
 * order docs/TENANT-OPERATIONS.md section 7 does it, with the control for each step beside it.
 *
 * ── WHY TWO OF THE STEPS ARE NEITHER DONE NOR TODO ────────────────────────────────────────────
 * Telegram is never asked what a bot's command menu contains, and this operator's staff list is not
 * readable from the platform screen — `/v1/admin/admins` answers for whichever operator the console
 * is pointed at, which is not necessarily this one. Both steps therefore report that they cannot be
 * checked from here, instead of a tick that would be a guess or a cross that would be a lie.
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
  const steps: ChecklistStep[] = [
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
      state: ichancy.ok ? 'done' : 'todo',
      body: ichancy.ok
        ? t('tenants.checklist.agentDone', { agent: ichancy.agentId })
        : t('tenants.checklist.agentTodo'),
      action: ichancy.ok ? null : (
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
          : t('tenants.checklist.activeTodo', { action: t('tenants.activate.action') }),
      action: null,
    },
  ];

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

type StepState = 'done' | 'todo' | 'unknown';

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
} as const;

const STATE_COLORS = {
  done: 'text-[var(--success)]',
  todo: 'text-[var(--warning)]',
  unknown: 'text-[var(--muted-foreground)]',
} as const;

const STATE_TONES = {
  done: 'success',
  todo: 'warning',
  unknown: 'muted',
} as const;

function ChecklistRow({ step, number }: { step: ChecklistStep; number: number }) {
  const t = useT(tenantMessages);
  const Icon = STATE_ICONS[step.state];
  const stateLabel = {
    done: t('tenants.checklist.stateDone'),
    todo: t('tenants.checklist.stateTodo'),
    unknown: t('tenants.checklist.stateUnknown'),
  }[step.state];

  return (
    <li className="flex items-start gap-3">
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
