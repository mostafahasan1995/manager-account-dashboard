import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { tenantHealth } from '@/mocks/db';
import { mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { Tenant, TenantHealth } from '@/types';

import { TenantOperations } from './tenant-operations';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const homeTenant = mockTenants[0]!;
const northernTenant = mockTenants[1]!;
/** Created, never finished: no webhook, an Ichancy agent that does not answer, no bot username. */
const stalledTenant = mockTenants[2]!;

const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

const HEALTH_PATH = `${config.apiBaseUrl}/v1/admin/tenants/:id/health`;

const envelope = (data: unknown, status = 200) =>
  HttpResponse.json(
    {
      success: status < 400,
      data: status < 400 ? data : null,
      error: null,
      meta: { correlationId: 'test', timestamp: '' },
    },
    { status },
  );

const failure = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message, ...(details === undefined ? {} : { details }) },
      meta: { correlationId: 'test', timestamp: '' },
    },
    { status },
  );

/** Starts from what the mock backend really answers, so an override changes one field, not all. */
const healthWith = (tenant: Tenant, patch: (health: TenantHealth) => TenantHealth) => {
  const base = tenantHealth(tenant);
  server.use(http.get(HEALTH_PATH, () => envelope(patch(base))));
};

describe('TenantOperations', () => {
  describe('an operator Telegram has never been told about', () => {
    it('says the bot receives nothing, in a sentence, rather than colouring a dot', async () => {
      renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      expect(
        await screen.findByText('Pilot operator receives nothing from Telegram'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /no webhook is registered for this bot, so every message sent to it is dropped/i,
        ),
      ).toBeInTheDocument();
      // What a silent bot actually costs, now that signing in does not go through Telegram at all:
      // players cannot reach it, and staff can still get into the console. Saying "nobody can sign
      // in" here would send an operator to fix the wrong thing.
      expect(screen.getByText(/no player can start a deposit/i)).toBeInTheDocument();
      expect(screen.getByText(/signing in to the console is unaffected/i)).toBeInTheDocument();
      expect(screen.getByText('Telegram holds no webhook for this bot')).toBeInTheDocument();
    });

    it('tells a webhook pointed elsewhere apart from no webhook at all', async () => {
      healthWith(stalledTenant, (health) => ({
        ...health,
        bot: {
          ...health.bot,
          webhookUrl: 'https://staging.example/telegram/webhook/abc',
          webhookMatches: false,
        },
      }));

      renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      expect(
        await screen.findByText(
          /delivers this bot’s updates to https:\/\/staging\.example\/telegram\/webhook\/abc/i,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no webhook is registered for this bot/i)).not.toBeInTheDocument();
    });

    it('opens on a checklist that names every step still missing', async () => {
      renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      expect(await screen.findByText('Setup checklist')).toBeInTheDocument();
      expect(screen.getByText('4 steps still to do.')).toBeInTheDocument();
      expect(screen.getByText('Bot token verified')).toBeInTheDocument();
      expect(screen.getByText('Webhook registered')).toBeInTheDocument();
      expect(screen.getByText('Ichancy agent verified')).toBeInTheDocument();
      expect(screen.getByText('Activated')).toBeInTheDocument();
      // The two nobody can check from here are reported as such, not ticked and not crossed.
      expect(screen.getAllByText('cannot be checked here')).toHaveLength(2);
    });

    it('registers the webhook and then says delivery is working', async () => {
      const { user } = renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      await user.click((await screen.findAllByRole('button', { name: 'Register webhook' }))[0]!);

      expect(
        await screen.findByText('Telegram is delivering to this deployment'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Pilot operator receives nothing from Telegram'),
      ).not.toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith(
        'Pilot operator is receiving updates',
        expect.objectContaining({
          description: 'Telegram now delivers this bot’s updates to this deployment.',
        }),
      );
    });

    it('says which of register and unregister the operator probably wants', async () => {
      renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      expect(
        await screen.findByText(/unregister stops delivery without suspending the operator/i),
      ).toBeInTheDocument();
    });
  });

  describe('the two fields that explain a bot which does not work', () => {
    it('shows the pending backlog and what a high one means', async () => {
      renderPlain(<TenantOperations tenant={northernTenant} />, platformAdmin);

      expect(
        await screen.findByText('Telegram is holding 4 updates for this bot'),
      ).toBeInTheDocument();
      expect(screen.getByText(/this deployment is refusing them/i)).toBeInTheDocument();
    });

    it("shows Telegram's last error when there is one", async () => {
      healthWith(northernTenant, (health) => ({
        ...health,
        bot: {
          ...health.bot,
          lastErrorMessage: 'Wrong response from the webhook: 502 Bad Gateway',
          lastErrorDate: new Date().toISOString(),
        },
      }));

      renderPlain(<TenantOperations tenant={northernTenant} />, platformAdmin);

      expect(
        await screen.findByText('Wrong response from the webhook: 502 Bad Gateway'),
      ).toBeInTheDocument();
    });
  });

  describe('the command menus', () => {
    it('reports how many commands were set', async () => {
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click((await screen.findAllByRole('button', { name: 'Push command menus' }))[0]!);

      expect(
        await screen.findByText(
          '7 commands pushed, in these scopes: default, all_private_chats, chat_administrators.',
        ),
      ).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('7 commands set in the bot’s menu');
    });
  });

  describe('a shared Ichancy agent', () => {
    it('stays quiet when this operator has the agent to itself', async () => {
      renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      expect(
        await screen.findByText(/no other operator is pointed at this ichancy agent/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/is shared with/i)).not.toBeInTheDocument();
    });

    it('names the operators sharing the session when there are any', async () => {
      healthWith(homeTenant, (health) => ({
        ...health,
        ichancy: { ...health.ichancy, sharesAgentWith: ['northern-branch', 'pilot-operator'] },
      }));

      renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      const notice = await screen.findByText('This Ichancy agent is shared with 2 other operators');
      expect(notice).toBeInTheDocument();
      expect(screen.getByText('northern-branch')).toBeInTheDocument();
      expect(screen.getByText('pilot-operator')).toBeInTheDocument();
      expect(screen.getByText(/signing in for one signs in for all of them/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/no other operator is pointed at this ichancy agent/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('editing the Ichancy credentials', () => {
    it('surfaces the refusal to move an agent id under live players, as the API worded it', async () => {
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Edit credentials' }));

      const agentId = await screen.findByLabelText('Ichancy agent id');
      await user.clear(agentId);
      await user.type(agentId, '99999');
      await user.click(screen.getByRole('button', { name: 'Save and verify' }));

      expect(await screen.findByText('The API refused this change')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This operator has linked players, so its Ichancy agent id cannot be changed.',
        ),
      ).toBeInTheDocument();
      // The form stays open on top of the refusal: the value that was refused is still editable.
      expect(screen.getByLabelText('Ichancy agent id')).toHaveValue('99999');
    });

    it('warns about the agent id before anybody types in it', async () => {
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Edit credentials' }));

      expect(
        await screen.findByText(/cannot be changed once this operator has players/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/leave empty to keep the stored password/i)).toBeInTheDocument();
    });
  });

  describe('replacing the bot token', () => {
    it('refuses a token that is not shaped like one, without asking Telegram', async () => {
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Replace bot token' }));
      await user.type(await screen.findByLabelText('Bot token'), 'not-a-token');
      await user.click(screen.getByRole('button', { name: 'Replace token' }));

      expect(await screen.findByText(/a bot token looks like 123456789:AA/i)).toBeInTheDocument();
    });

    it('shows the refusal as Telegram worded it, and keeps the form open', async () => {
      server.use(
        http.patch(`${config.apiBaseUrl}/v1/admin/tenants/:id/bot`, () =>
          failure(400, 'TELEGRAM_REJECTED', 'Telegram rejected this bot token: Unauthorized.'),
        ),
      );

      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Replace bot token' }));
      await user.type(
        await screen.findByLabelText('Bot token'),
        '123456789:AAHkLmNoPqRsTuVwXyZ0123456789abcdef',
      );
      await user.click(screen.getByRole('button', { name: 'Replace token' }));

      expect(
        await screen.findByText('Telegram rejected this bot token: Unauthorized.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Bot token')).toBeInTheDocument();
    });

    it('warns that the new bot receives nothing until its webhook is registered', async () => {
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Replace bot token' }));

      expect(
        await screen.findByText('The new bot will receive nothing until you register its webhook'),
      ).toBeInTheDocument();
      expect(screen.getByText(/one webhook URL per bot/i)).toBeInTheDocument();
    });
  });

  describe('the float and the counts', () => {
    it('shows the float against the watermark and the operator’s counts', async () => {
      renderPlain(<TenantOperations tenant={northernTenant} />, platformAdmin);

      expect(await screen.findByText('380,000.00 NSP')).toBeInTheDocument();
      expect(screen.getByText('The agent float is below the low watermark')).toBeInTheDocument();

      const counts = screen.getByText('What this operator holds').closest('div')!.parentElement!;
      expect(within(counts).getByText('312')).toBeInTheDocument();
      expect(within(counts).getByText('1,188')).toBeInTheDocument();
    });
  });

  describe('the states around the data', () => {
    it('shows a failed health read with a way to try it again', async () => {
      let calls = 0;
      server.use(
        http.get(HEALTH_PATH, ({ params }) => {
          calls += 1;
          return calls === 1
            ? failure(503, 'TELEGRAM_UNREACHABLE', 'Telegram did not answer in 15s.')
            : envelope(tenantHealth(mockTenants.find((row) => row.id === String(params.id))!));
        }),
      );

      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      expect(await screen.findByText('Telegram did not answer in 15s.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /try again/i }));

      expect(
        await screen.findByText('Telegram is delivering to this deployment'),
      ).toBeInTheDocument();
    });
  });

  describe('roles', () => {
    it('shows nothing at all to a role that cannot manage operators', async () => {
      renderPlain(<TenantOperations tenant={homeTenant} />, { auth: { role: 'SUPER_ADMIN' } });

      await waitFor(() => {
        expect(screen.queryByText('Setup and health')).not.toBeInTheDocument();
      });
      for (const label of [
        'Register webhook',
        'Unregister',
        'Push command menus',
        'Replace bot token',
        'Edit credentials',
        'Test connection',
        'Check again',
        'Import players from Ichancy',
      ]) {
        expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
      }
      expect(screen.queryByText('Setup checklist')).not.toBeInTheDocument();
    });
  });

  describe('importing the old players', () => {
    it('says it has not run yet, then reports the counts once it has', async () => {
      const { user } = renderPlain(<TenantOperations tenant={northernTenant} />, platformAdmin);

      expect(await screen.findByText('Old players')).toBeInTheDocument();
      expect(screen.getByText('Not run in this session.')).toBeInTheDocument();
      expect(screen.getByText(/Safe to repeat/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Import players from Ichancy' }));

      expect(await screen.findByText('Import finished')).toBeInTheDocument();
      expect(screen.getByText('3 scanned, 2 created, 1 already known.')).toBeInTheDocument();
      expect(screen.queryByText('Not run in this session.')).not.toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith(
        '2 players imported from Ichancy',
        expect.objectContaining({ description: '3 scanned, 2 created, 1 already known.' }),
      );
    });

    it('shows the Ichancy failure the import reports, beside the counts it managed', async () => {
      const { user } = renderPlain(<TenantOperations tenant={stalledTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Import players from Ichancy' }));

      expect(await screen.findByText('Ichancy did not finish the import')).toBeInTheDocument();
      expect(
        screen.getAllByText(
          'Ichancy sign-in failed for agent_pilot: the agent did not answer (504 after 15s).',
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText('0 scanned, 0 created, 0 already known.')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith(
        'Ichancy did not finish the import',
        expect.objectContaining({
          description:
            'Ichancy sign-in failed for agent_pilot: the agent did not answer (504 after 15s).',
        }),
      );
    });

    it('reports a refused request as the API worded it', async () => {
      server.use(
        http.post(`${config.apiBaseUrl}/v1/admin/tenants/:id/import-players`, () =>
          failure(409, 'IMPORT_ALREADY_RUNNING', 'An import is already running for this operator.'),
        ),
      );
      const { user } = renderPlain(<TenantOperations tenant={homeTenant} />, platformAdmin);

      await user.click(await screen.findByRole('button', { name: 'Import players from Ichancy' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Could not import players',
          expect.objectContaining({
            description: 'An import is already running for this operator.',
          }),
        );
      });
      expect(screen.getByText('Not run in this session.')).toBeInTheDocument();
    });
  });

  describe('in Arabic', () => {
    it('offers the import in Arabic', async () => {
      renderPlain(<TenantOperations tenant={northernTenant} />, {
        ...platformAdmin,
        locale: 'ar',
      });

      expect(await screen.findByText('اللاعبون القدامى')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'استيراد اللاعبين من Ichancy' }),
      ).toBeInTheDocument();
    });

    it('states the silence and counts the backlog with Arabic plurals', async () => {
      renderPlain(<TenantOperations tenant={northernTenant} />, {
        ...platformAdmin,
        locale: 'ar',
      });

      expect(await screen.findByText('الإعداد والحالة')).toBeInTheDocument();
      // Four takes Arabic's `few` form, which is a different word shape from the singular.
      expect(await screen.findByText('يحتفظ Telegram بـ4 تحديثات لهذا البوت')).toBeInTheDocument();
      expect(screen.getByText('رصيد الوكيل تحت الحد الأدنى')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'تسجيل الـ webhook' })).toBeInTheDocument();
    });
  });
});
