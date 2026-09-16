import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { TENANT_CHAT_POLL_MS } from '@/lib/api/queries';
import { completeBindLink, db } from '@/mocks/db';
import { TENANT_IDS, mockTenantChats, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantOperations } from './tenant-operations';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * The staff and feed group steps, and fake Ichancy, on the operator's setup panel.
 *
 * The pilot operator is the case owner decision 1 created: suspended, with no staff group, so the
 * checklist has to lead with the button that binds one and the list that is its fallback.
 */

const pilot = mockTenants[2]!;
const northern = mockTenants[1]!;
const home = mockTenants[0]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

/** The one poll the page waits on is every few seconds, so a find that spans it gets longer. */
const ACROSS_A_POLL = { timeout: 9000 };

afterEach(() => {
  vi.restoreAllMocks();
  server.events.removeAllListeners('request:start');
});

const staffStep = async () => {
  const title = await screen.findByText('Staff group bound');
  return within(title.closest('li')!);
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Bind links still held in TanStack's mutation cache. Each URL carries a one-time nonce. */
const heldBindLinks = (queryClient: QueryClient) =>
  queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => JSON.stringify(mutation.state.data ?? null).includes('startgroup='));

/** The pilot operator once Telegram has confirmed its bot, so a link can be issued for it. */
const renderPilotWithBot = () => {
  db.tenants.find((row) => row.id === pilot.id)!.botUsername = 'pilot_cashier_bot';
  vi.spyOn(window, 'open').mockReturnValue(null);
  return renderPlain(
    <TenantOperations tenant={{ ...pilot, botUsername: 'pilot_cashier_bot' }} />,
    platformAdmin,
  );
};

describe('the staff group step', () => {
  it('is still to do for an operator with no group, and leads with the add-bot button', async () => {
    renderPlain(<TenantOperations tenant={pilot} />, platformAdmin);

    const step = await staffStep();
    expect(step.getByText('still to do')).toBeInTheDocument();
    expect(step.getByText(/Until it is bound the operator stays suspended/)).toBeInTheDocument();
    expect(step.getByRole('button', { name: 'Add bot to staff group' })).toBeInTheDocument();
    // The feed group is optional: offered, and not counted as missing.
    const feed = within(screen.getByText('Feed group').closest('li')!);
    expect(feed.getByText('optional')).toBeInTheDocument();
    expect(feed.getByRole('button', { name: 'Add bot to feed group' })).toBeInTheDocument();
  });

  it('opens the one-time t.me link, then notices the bind Telegram made', async () => {
    db.tenants.find((row) => row.id === pilot.id)!.botUsername = 'pilot_cashier_bot';
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = renderPlain(
      <TenantOperations tenant={{ ...pilot, botUsername: 'pilot_cashier_bot' }} />,
      platformAdmin,
    );

    await user.click((await staffStep()).getByRole('button', { name: 'Add bot to staff group' }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        expect.stringMatching(
          /^https:\/\/t\.me\/pilot_cashier_bot\?startgroup=[A-Za-z0-9_-]+&admin=post_messages\+delete_messages\+pin_messages\+manage_chat$/,
        ),
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(await screen.findByText('Finish in Telegram')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the link again' })).toHaveAttribute(
      'href',
      open.mock.calls[0]![0],
    );

    // What Telegram does once the owner picks the group.
    expect(
      completeBindLink(TENANT_IDS.suspended, 'STAFF', mockTenantChats[TENANT_IDS.suspended]![0]!),
    ).toBe(true);

    expect(
      await screen.findByText('-1002233445566 is now the staff group.', {}, ACROSS_A_POLL),
    ).toBeInTheDocument();
  }, 20_000);

  it('binds a group picked from this operator’s directory, showing who added the bot', async () => {
    const { user } = renderPlain(<TenantOperations tenant={pilot} />, platformAdmin);

    await user.click(
      (await staffStep()).getByRole('button', { name: 'Pick from groups the bot is in' }),
    );

    expect(await screen.findByText('Pilot staff (private)')).toBeInTheDocument();
    expect(screen.getAllByText('Bot added by @pilot_owner').length).toBeGreaterThan(0);
    // Neither the dead pre-supergroup id nor the channel can be bound as itself.
    expect(screen.getByText('Became a supergroup: use the new one')).toBeInTheDocument();
    expect(screen.getByText('Channel: cannot be a staff or feed group')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Use this group:/ })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Use this group: Pilot staff (private)' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pilot staff (private) is now the staff group');
    });
    expect(db.tenants.find((row) => row.id === pilot.id)?.adminChatId).toBe('-1002233445566');
  });

  it('says why Telegram refused a group, in words that name the fix', async () => {
    const { user } = renderPlain(<TenantOperations tenant={pilot} />, platformAdmin);

    await user.click(
      (await staffStep()).getByRole('button', { name: 'Pick from groups the bot is in' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Use this group: Pilot support' }));

    expect(
      await screen.findByText('Telegram refused this group. Nothing was saved.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The bot is in this group but is not an administrator. Make it an administrator, then try again.',
      ),
    ).toBeInTheDocument();
    expect(db.tenants.find((row) => row.id === pilot.id)?.adminChatId).toBeNull();
  });

  it('shows that the bot was removed from a bound staff group', async () => {
    const sighting = db.tenantChats[TENANT_IDS.second]![0]!;
    sighting.isPresent = false;
    sighting.status = 'KICKED';

    renderPlain(<TenantOperations tenant={northern} />, platformAdmin);

    expect(
      await screen.findByText('The bot was removed from the staff group Northern staff'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The group is still bound, but nothing reaches it/),
    ).toBeInTheDocument();
    const step = await staffStep();
    expect(step.getByText('still to do')).toBeInTheDocument();
    expect(step.getByText(/The bot was removed from Northern staff\./)).toBeInTheDocument();
  });

  it('offers the step in Arabic', async () => {
    renderPlain(<TenantOperations tenant={pilot} />, { ...platformAdmin, locale: 'ar' });

    expect(await screen.findByText('ربط مجموعة الموظفين')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'إضافة البوت إلى مجموعة الموظفين' }),
    ).toBeInTheDocument();
  });
});

describe('a link that is out', () => {
  it('stops re-reading the operator once the link expires, and offers a new link', async () => {
    // A link with three seconds to live, so the test can watch it run out.
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/tenants/:id/telegram/bind-links`, () =>
        HttpResponse.json({
          success: true,
          data: {
            purpose: 'STAFF',
            url: 'https://t.me/pilot_cashier_bot?startgroup=ShortLivedNonce1234&admin=post_messages',
            botUsername: 'pilot_cashier_bot',
            expiresAt: new Date(Date.now() + 3_000).toISOString(),
            adminRights: ['post_messages'],
          },
          error: null,
          meta: { correlationId: 'test', timestamp: '' },
        }),
      ),
    );
    let reads = 0;
    server.events.on('request:start', ({ request }) => {
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' && path.endsWith(`/v1/admin/tenants/${pilot.id}`)) reads += 1;
    });
    const { user } = renderPilotWithBot();

    const step = await staffStep();
    await user.click(step.getByRole('button', { name: 'Add bot to staff group' }));
    expect(await step.findByText('Finish in Telegram')).toBeInTheDocument();

    expect(await step.findByText('The link expired', {}, ACROSS_A_POLL)).toBeInTheDocument();
    expect(step.queryByText('Finish in Telegram')).not.toBeInTheDocument();
    expect(step.queryByRole('link', { name: 'Open the link again' })).not.toBeInTheDocument();
    expect(step.getByRole('button', { name: 'Get a new link' })).toBeInTheDocument();

    // The one read made at expiry settles; after it, a whole poll interval passes with no read.
    await sleep(500);
    const settled = reads;
    await sleep(TENANT_CHAT_POLL_MS + 1_000);
    expect(reads).toBe(settled);
  }, 20_000);

  it('can be dismissed while it is out, and the link leaves memory at once', async () => {
    const { user, queryClient } = renderPilotWithBot();

    const step = await staffStep();
    await user.click(step.getByRole('button', { name: 'Add bot to staff group' }));
    expect(await step.findByText('Finish in Telegram')).toBeInTheDocument();
    expect(heldBindLinks(queryClient)).toHaveLength(1);

    await user.click(step.getByRole('button', { name: 'Dismiss' }));

    expect(step.queryByText('Finish in Telegram')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(heldBindLinks(queryClient)).toHaveLength(0);
    });
  });

  it('leaves memory when the step goes away, not five minutes later', async () => {
    const { user, queryClient, unmount } = renderPilotWithBot();

    const step = await staffStep();
    await user.click(step.getByRole('button', { name: 'Add bot to staff group' }));
    expect(await step.findByText('Finish in Telegram')).toBeInTheDocument();
    expect(heldBindLinks(queryClient)).toHaveLength(1);

    unmount();

    await waitFor(() => {
      expect(heldBindLinks(queryClient)).toHaveLength(0);
    });
  });

  it('says it expired in Arabic', async () => {
    db.tenants.find((row) => row.id === pilot.id)!.botUsername = 'pilot_cashier_bot';
    vi.spyOn(window, 'open').mockReturnValue(null);
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/tenants/:id/telegram/bind-links`, () =>
        HttpResponse.json({
          success: true,
          data: {
            purpose: 'STAFF',
            url: 'https://t.me/pilot_cashier_bot?startgroup=AlreadyExpired1234&admin=post_messages',
            botUsername: 'pilot_cashier_bot',
            expiresAt: new Date(Date.now() - 1_000).toISOString(),
            adminRights: ['post_messages'],
          },
          error: null,
          meta: { correlationId: 'test', timestamp: '' },
        }),
      ),
    );
    const { user } = renderPlain(
      <TenantOperations tenant={{ ...pilot, botUsername: 'pilot_cashier_bot' }} />,
      { ...platformAdmin, locale: 'ar' },
    );

    await user.click(
      await screen.findByRole('button', { name: 'إضافة البوت إلى مجموعة الموظفين' }),
    );

    expect(await screen.findByText('انتهت صلاحية الرابط')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اطلب رابطاً جديداً' })).toBeInTheDocument();
  });
});

describe('tenant zero, the platform', () => {
  it('has no group step, because every bind and every removal for it is refused', async () => {
    renderPlain(
      <TenantOperations tenant={{ ...home, adminChatId: null, feedChatId: null }} />,
      platformAdmin,
    );

    expect(await screen.findByText('Setup checklist')).toBeInTheDocument();
    expect(document.querySelector('[data-step="staff-group"]')).toBeNull();
    expect(document.querySelector('[data-step="feed-group"]')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Add bot to staff group' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add bot to feed group' })).not.toBeInTheDocument();
  });
});

describe('Ichancy in fake mode on the operator panel', () => {
  it('says no real connection was made, instead of reporting the agent as answering', async () => {
    db.ichancyFake = true;

    // An operator: the platform's Ichancy panel is not rendered at all, because every edit and
    // every check the backend offers for tenant zero is refused.
    renderPlain(<TenantOperations tenant={{ ...northern, ichancyFake: true }} />, platformAdmin);

    expect(await screen.findByText('Ichancy is in fake mode')).toBeInTheDocument();
    expect(screen.getByText(/No real connection to Ichancy was made/)).toBeInTheDocument();
    expect(
      screen.getByText('Ichancy is in fake mode (ICHANCY_FAKE=true): no real connection was made.'),
    ).toBeInTheDocument();
    expect(screen.getByText('not read (fake mode)')).toBeInTheDocument();
    expect(
      screen.getByText(/no real sign-in was made, so this agent cannot be verified/),
    ).toBeInTheDocument();
    expect(screen.queryByText('The agent answered')).not.toBeInTheDocument();
    expect(screen.queryByText('Ichancy did not accept this agent')).not.toBeInTheDocument();
  });

  it('labels an import made in fake mode', async () => {
    db.ichancyFake = true;
    const { user } = renderPlain(<TenantOperations tenant={northern} />, platformAdmin);

    await user.click(await screen.findByRole('button', { name: 'Import players from Ichancy' }));

    expect(await screen.findByText('Fake mode: these are not real players')).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    db.ichancyFake = true;

    renderPlain(<TenantOperations tenant={northern} />, { ...platformAdmin, locale: 'ar' });

    expect(await screen.findByText('Ichancy في الوضع الوهمي')).toBeInTheDocument();
  });
});
