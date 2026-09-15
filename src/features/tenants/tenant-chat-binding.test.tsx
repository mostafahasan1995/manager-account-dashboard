import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeBindLink, db } from '@/mocks/db';
import { TENANT_IDS, mockTenantChats, mockTenants } from '@/mocks/fixtures';
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
});

const staffStep = async () => {
  const title = await screen.findByText('Staff group bound');
  return within(title.closest('li')!);
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
    expect(screen.getByText(/The group is still bound, but nothing reaches it/)).toBeInTheDocument();
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

describe('Ichancy in fake mode on the operator panel', () => {
  it('says no real connection was made, instead of reporting the agent as answering', async () => {
    db.ichancyFake = true;

    renderPlain(<TenantOperations tenant={{ ...home, ichancyFake: true }} />, platformAdmin);

    expect(await screen.findByText('Ichancy is in fake mode')).toBeInTheDocument();
    expect(screen.getByText(/No real connection to Ichancy was made/)).toBeInTheDocument();
    expect(
      screen.getByText('Ichancy is in fake mode (ICHANCY_FAKE=true): no real connection was made.'),
    ).toBeInTheDocument();
    expect(screen.getByText('not read (fake mode)')).toBeInTheDocument();
    expect(screen.getByText(/no real sign-in was made, so this agent cannot be verified/)).toBeInTheDocument();
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

    renderPlain(<TenantOperations tenant={home} />, { ...platformAdmin, locale: 'ar' });

    expect(await screen.findByText('Ichancy في الوضع الوهمي')).toBeInTheDocument();
  });
});
