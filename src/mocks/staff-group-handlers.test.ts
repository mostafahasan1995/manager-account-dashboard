import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { configureApiClient } from '@/lib/api/client';
import { adminsApi, reconciliationApi, tenantsApi } from '@/lib/api/endpoints';
import { isApiError, type ApiError } from '@/lib/api/errors';

import {
  AGENT_PRINCIPAL_LINK_MESSAGE,
  ICHANCY_FAKE_MODE_MESSAGE,
  PLATFORM_BOT_LOCKED_MESSAGE,
  PLATFORM_HAS_NO_AGENT_MESSAGE,
  PLATFORM_LINK_MESSAGE,
  PLATFORM_SUSPEND_LOCKED_MESSAGE,
  STAFF_GROUP_REQUIRED_MESSAGE,
  TENANT_PLATFORM_LOCKED_MESSAGE,
  completeBindLink,
  db,
  redeemStaffLinkCode,
} from './db';
import { ADMIN_IDS, TENANT_IDS, mockTenantChats } from './fixtures';

/**
 * The mock backend's staff and feed groups, staff Telegram links and Ichancy fake mode, held to the
 * backend commits they mirror (Telegram-mini-app 6e11e5c, 747f471, d1d96ac) and to
 * docs/API-CONTRACT.md. The screens are built against these handlers, so each refusal the backend
 * answers is asserted here with its code and its `details`, not only the happy path.
 */

const A_REAL_LOOKING_BOT_TOKEN = '8123456789:AAG7hZ2q-Xk_9pLmN4rTvBcD1eFgHiJkLmN';

const PILOT_PRIVATE_STAFF = '-1002233445566';
const PILOT_MEMBER_ONLY = '-1007788990011';
const PILOT_OLD_GROUP = '-4455667788';
const PILOT_CHANNEL = '-1005555000222';
const NORTHERN_STAFF = '-1001111111111';

const caught = (promise: Promise<unknown>): Promise<ApiError> =>
  promise.then(
    () => {
      throw new Error('expected the request to be refused');
    },
    (error: unknown) => {
      if (!isApiError(error)) throw error;
      return error;
    },
  );

const pilot = () => db.tenants.find((row) => row.id === TENANT_IDS.suspended)!;

/** An operator's agent principal: its sign-in finds it by the reserved Telegram id "0". */
const AGENT_PRINCIPAL_ID = 'aaaaaaaa-0000-4000-8000-000000000099';

describe('an operator created without a staff group', () => {
  it('is created with adminChatId null, stays suspended, and says why it was not activated', async () => {
    const created = await tenantsApi.create({
      displayName: 'Harbour kiosk',
      botToken: A_REAL_LOOKING_BOT_TOKEN,
      ichancyUsername: 'agent_harbour',
      ichancyPassword: 'never-returned',
    });

    expect(created.adminChatId).toBeNull();
    expect(created.status).toBe('SUSPENDED');
    expect(created.ichancyFake).toBe(false);
    expect(created.provisioning).toMatchObject({
      activated: false,
      activationError: STAFF_GROUP_REQUIRED_MESSAGE,
      ichancyFake: false,
    });
  });

  it('refuses activation with TENANT_STAFF_GROUP_REQUIRED before any sign-in', async () => {
    const error = await caught(tenantsApi.activate(TENANT_IDS.suspended));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TENANT_STAFF_GROUP_REQUIRED');
    expect(error.message).toBe(STAFF_GROUP_REQUIRED_MESSAGE);
    expect(pilot().status).toBe('SUSPENDED');
  });

  it('activates once a staff group is bound', async () => {
    await tenantsApi.bindChat(TENANT_IDS.suspended, 'STAFF', { chatId: PILOT_PRIVATE_STAFF });

    const activated = await tenantsApi.activate(TENANT_IDS.suspended);

    expect(activated.status).toBe('ACTIVE');
    expect(activated.adminChatId).toBe(PILOT_PRIVATE_STAFF);
  });
});

describe('the operator chat directory', () => {
  it('lists one operator’s groups with who added the bot and nothing bound yet', async () => {
    const chats = await tenantsApi.chats(TENANT_IDS.suspended);

    expect(chats.map((chat) => chat.chatId)).toEqual(
      mockTenantChats[TENANT_IDS.suspended]!.map((chat) => chat.chatId),
    );
    const staff = chats.find((chat) => chat.chatId === PILOT_PRIVATE_STAFF)!;
    expect(staff).toMatchObject({
      boundAs: [],
      alreadyBound: false,
      lastChangedByUsername: 'pilot_owner',
      migratedToChatId: null,
    });
    expect(chats.find((chat) => chat.chatId === PILOT_OLD_GROUP)?.migratedToChatId).toBe(
      PILOT_PRIVATE_STAFF,
    );
  });

  it('marks the groups bound as this operator’s staff and feed group, computed from the row', async () => {
    const chats = await tenantsApi.chats(TENANT_IDS.zero);

    expect(chats.find((chat) => chat.chatId === '-1001234567890')).toMatchObject({
      boundAs: ['STAFF'],
      alreadyBound: true,
    });
    expect(chats.find((chat) => chat.chatId === '-1009876543210')).toMatchObject({
      boundAs: ['FEED'],
      alreadyBound: true,
    });
  });

  it('never shows another operator’s groups', async () => {
    const chats = await tenantsApi.chats(TENANT_IDS.second);

    expect(chats.map((chat) => chat.chatId)).toEqual(['-1001111111111']);
  });
});

describe('binding a staff or feed group', () => {
  it.each([
    [PILOT_MEMBER_ONLY, 'BOT_NOT_ADMIN'],
    [PILOT_CHANNEL, 'CHANNEL_NOT_ALLOWED'],
    ['-1009999999999', 'NOT_FOUND'],
    ['700000001', 'PRIVATE_CHAT'],
  ])('refuses %s with 400 TELEGRAM_CHAT_REJECTED %s and saves nothing', async (chatId, reason) => {
    const error = await caught(tenantsApi.bindChat(TENANT_IDS.suspended, 'STAFF', { chatId }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TELEGRAM_CHAT_REJECTED');
    expect(error.message).toMatch(/Nothing was saved\.$/);
    expect(error.details).toMatchObject({ reason, purpose: 'STAFF', field: 'chatId' });
    expect(pilot().adminChatId).toBeNull();
  });

  it('binds the new id when the picked group had become a supergroup', async () => {
    const bound = await tenantsApi.bindChat(TENANT_IDS.suspended, 'STAFF', {
      chatId: PILOT_OLD_GROUP,
    });

    expect(bound.adminChatId).toBe(PILOT_PRIVATE_STAFF);
  });

  it('binds a feed group without touching the staff group, and health reports both', async () => {
    const bound = await tenantsApi.bindChat(TENANT_IDS.second, 'FEED', {
      chatId: NORTHERN_STAFF,
    });

    expect(bound.adminChatId).toBe(NORTHERN_STAFF);
    expect(bound.feedChatId).toBe(NORTHERN_STAFF);
    const health = await tenantsApi.health(TENANT_IDS.second);
    expect(health.chats.staff).toMatchObject({ chatId: NORTHERN_STAFF, title: 'Northern staff' });
    expect(health.chats.feed).toMatchObject({ chatId: NORTHERN_STAFF, isPresent: true });
  });

  it('verifies a CHANGED chat on PATCH, and leaves an unchanged one alone', async () => {
    const error = await caught(
      tenantsApi.update(TENANT_IDS.suspended, { adminChatId: PILOT_MEMBER_ONLY }),
    );
    expect(error.code).toBe('TELEGRAM_CHAT_REJECTED');
    expect(error.details).toMatchObject({ reason: 'BOT_NOT_ADMIN', field: 'adminChatId' });

    // Tenant zero's staff group sent back unchanged with a rename: no verification, no refusal.
    const renamed = await tenantsApi.update(TENANT_IDS.zero, {
      displayName: 'Main operation (renamed)',
      adminChatId: '-1001234567890',
    });
    expect(renamed.displayName).toBe('Main operation (renamed)');
  });

  it('refuses to remove an active operator’s staff group, and removes a feed group', async () => {
    const error = await caught(tenantsApi.unbindChat(TENANT_IDS.second, 'STAFF'));
    expect(error.status).toBe(422);
    expect(error.code).toBe('TENANT_STAFF_GROUP_REQUIRED');

    await tenantsApi.bindChat(TENANT_IDS.second, 'FEED', { chatId: NORTHERN_STAFF });
    const withoutFeed = await tenantsApi.unbindChat(TENANT_IDS.second, 'FEED');
    expect(withoutFeed.feedChatId).toBeNull();
    expect(withoutFeed.adminChatId).toBe(NORTHERN_STAFF);
  });

  it('reports the bot removed from the bound staff group without clearing the binding', async () => {
    db.tenantChats[TENANT_IDS.second]![0]!.isPresent = false;
    db.tenantChats[TENANT_IDS.second]![0]!.status = 'KICKED';

    const health = await tenantsApi.health(TENANT_IDS.second);

    expect(health.chats.staff).toMatchObject({
      chatId: '-1001111111111',
      isPresent: false,
      status: 'KICKED',
    });
    expect((await tenantsApi.byId(TENANT_IDS.second)).adminChatId).toBe('-1001111111111');
  });
});

describe('tenant zero, the platform', () => {
  const zero = () => db.tenants.find((row) => row.id === TENANT_IDS.zero)!;

  it.each([
    ['issuing a link', () => tenantsApi.issueBindLink(TENANT_IDS.zero, 'STAFF')],
    [
      'binding a group',
      () => tenantsApi.bindChat(TENANT_IDS.zero, 'FEED', { chatId: NORTHERN_STAFF }),
    ],
    ['removing a group', () => tenantsApi.unbindChat(TENANT_IDS.zero, 'FEED')],
    [
      'changing a group by PATCH',
      () => tenantsApi.update(TENANT_IDS.zero, { feedChatId: '-1001234567890' }),
    ],
  ])('refuses %s with 422 TENANT_PLATFORM_LOCKED and changes nothing', async (_what, call) => {
    const before = { ...zero() };

    const error = await caught(call());

    expect(error.status).toBe(422);
    expect(error.code).toBe('TENANT_PLATFORM_LOCKED');
    expect(error.message).toBe(TENANT_PLATFORM_LOCKED_MESSAGE);
    expect(zero()).toEqual(before);
  });

  /**
   * The rest of what the platform cannot be put through, each with the backend's own sentence. The
   * console hides every one of these controls for tenant zero, and this is what it is hiding.
   */
  it('refuses its suspension, its bot token, its Ichancy agent and its player import', async () => {
    const refusals: [string, () => Promise<unknown>, string][] = [
      ['suspending it', () => tenantsApi.suspend(TENANT_IDS.zero), PLATFORM_SUSPEND_LOCKED_MESSAGE],
      [
        'replacing its bot token',
        () => tenantsApi.updateBot(TENANT_IDS.zero, { botToken: A_REAL_LOOKING_BOT_TOKEN }),
        PLATFORM_BOT_LOCKED_MESSAGE,
      ],
      [
        'editing its Ichancy agent',
        () => tenantsApi.updateIchancy(TENANT_IDS.zero, { ichancyAgentId: '10500' }),
        PLATFORM_HAS_NO_AGENT_MESSAGE,
      ],
      [
        'importing its players',
        () => tenantsApi.importPlayers(TENANT_IDS.zero),
        PLATFORM_HAS_NO_AGENT_MESSAGE,
      ],
    ];

    for (const [what, call, message] of refusals) {
      const error = await caught(call());

      expect(error.status, what).toBe(422);
      expect(error.code, what).toBe('TENANT_PLATFORM_LOCKED');
      expect(error.message, what).toBe(message);
    }
    expect(zero().status).toBe('ACTIVE');
  });

  /**
   * Not everything is refused, and the console must not hide what is not. Activation is answered
   * for an operator that is already serving, and the chat directory is readable.
   */
  it('still activates it and still lists its chats', async () => {
    expect((await tenantsApi.activate(TENANT_IDS.zero)).status).toBe('ACTIVE');
    expect((await tenantsApi.chats(TENANT_IDS.zero)).length).toBeGreaterThan(0);
  });
});

describe('the "Add bot to group" link', () => {
  it('refuses an operator whose bot has no known username', async () => {
    const error = await caught(tenantsApi.issueBindLink(TENANT_IDS.suspended, 'STAFF'));

    expect(error.status).toBe(422);
    expect(error.code).toBe('TENANT_BOT_UNAVAILABLE');
  });

  it('answers a one-time startgroup link that asks for the bot’s admin rights', async () => {
    const link = await tenantsApi.issueBindLink(TENANT_IDS.second, 'FEED');

    expect(link.purpose).toBe('FEED');
    expect(link.botUsername).toBe('northern_cashier_bot');
    expect(link.url).toMatch(
      /^https:\/\/t\.me\/northern_cashier_bot\?startgroup=[A-Za-z0-9_-]{16,64}&admin=post_messages\+delete_messages\+pin_messages\+manage_chat$/,
    );
    expect(link.adminRights).toEqual([
      'post_messages',
      'delete_messages',
      'pin_messages',
      'manage_chat',
    ]);
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('binds the group Telegram reports it was opened in, exactly once', async () => {
    pilot().botUsername = 'pilot_cashier_bot';
    await tenantsApi.issueBindLink(TENANT_IDS.suspended, 'STAFF');
    const chat = mockTenantChats[TENANT_IDS.suspended]![0]!;

    expect(completeBindLink(TENANT_IDS.suspended, 'STAFF', chat)).toBe(true);
    expect((await tenantsApi.byId(TENANT_IDS.suspended)).adminChatId).toBe(PILOT_PRIVATE_STAFF);
    // Used up: the same link does nothing a second time.
    expect(completeBindLink(TENANT_IDS.suspended, 'STAFF', chat)).toBe(false);
  });
});

describe('Ichancy in fake mode', () => {
  it('reports health as not ok, with the fake flag and the backend’s sentence, and no float', async () => {
    db.ichancyFake = true;

    const health = await tenantsApi.health(TENANT_IDS.second);

    expect(health.ichancy).toMatchObject({
      ok: false,
      fake: true,
      error: ICHANCY_FAKE_MODE_MESSAGE,
      floatMinor: null,
      belowWatermark: false,
      agentId: '10099',
    });
    expect((await tenantsApi.byId(TENANT_IDS.second)).ichancyFake).toBe(true);
  });

  it('labels a tenant import and a float sync as fake, and opens no break', async () => {
    db.ichancyFake = true;

    expect((await tenantsApi.importPlayers(TENANT_IDS.second)).ichancyFake).toBe(true);
    expect(await reconciliationApi.syncFloat()).toMatchObject({
      ichancyFake: true,
      ichancyMinor: null,
      deltaMinor: null,
      breakId: null,
    });
  });

  it('is off in real mode, everywhere it is reported', async () => {
    expect((await tenantsApi.health(TENANT_IDS.second)).ichancy.fake).toBe(false);
    expect((await reconciliationApi.syncFloat()).ichancyFake).toBe(false);
  });
});

describe('linking a staff account to Telegram', () => {
  it('issues a one-time code with the exact command and the bot to send it to', async () => {
    const code = await adminsApi.issueTelegramLinkCode(ADMIN_IDS.noTelegram);

    expect(code.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code.command).toBe(`/link ${code.code}`);
    expect(code.ttlSeconds).toBe(600);
    expect(code.botUsername).toBe('main_cashier_bot');
    expect(code.botUrl).toBe('https://t.me/main_cashier_bot');
  });

  it('links on redemption, refuses a second code while linked, and unlinks', async () => {
    const { code } = await adminsApi.issueTelegramLinkCode(ADMIN_IDS.noTelegram);
    expect(redeemStaffLinkCode(code.toLowerCase().replace('-', ''), '700000099')).toBe(true);
    // One use.
    expect(redeemStaffLinkCode(code, '700000099')).toBe(false);

    const linked = await adminsApi.byId(ADMIN_IDS.noTelegram);
    expect(linked).toMatchObject({ telegramLinked: true, telegramUserId: '700000099' });

    const conflict = await caught(adminsApi.issueTelegramLinkCode(ADMIN_IDS.noTelegram));
    expect(conflict.status).toBe(409);
    expect(conflict.code).toBe('ADMIN_TELEGRAM_ALREADY_LINKED');

    const unlinked = await adminsApi.unlinkTelegram(ADMIN_IDS.noTelegram);
    expect(unlinked).toMatchObject({ telegramLinked: false, telegramUserId: null });
  });

  it('refuses a code and an unlink for the agent principal, whose reserved id is not a person', async () => {
    const agent = {
      ...db.admins.find((row) => row.id === ADMIN_IDS.superAdmin)!,
      id: AGENT_PRINCIPAL_ID,
      telegramUserId: '0',
      telegramLinked: false,
      username: null,
      displayName: 'Main operation agent',
    };
    db.admins.push(agent);

    for (const call of [
      () => adminsApi.issueTelegramLinkCode(AGENT_PRINCIPAL_ID),
      () => adminsApi.unlinkTelegram(AGENT_PRINCIPAL_ID),
    ]) {
      const error = await caught(call());
      expect(error.status).toBe(422);
      expect(error.code).toBe('ADMIN_TELEGRAM_LINK_NOT_ALLOWED');
      expect(error.message).toBe(AGENT_PRINCIPAL_LINK_MESSAGE);
      expect(error.details).toMatchObject({ reason: 'AGENT_PRINCIPAL' });
    }
    expect(agent.telegramUserId).toBe('0');
  });

  it('refuses a deactivated account with the INACTIVE reason', async () => {
    const error = await caught(adminsApi.issueTelegramLinkCode(ADMIN_IDS.deactivated));

    expect(error.status).toBe(422);
    expect(error.code).toBe('ADMIN_TELEGRAM_LINK_NOT_ALLOWED');
    expect(error.details).toMatchObject({ reason: 'INACTIVE' });
  });

  it('refuses a code for every row while the caller is working in tenant zero', async () => {
    // The platform has no bot, so the backend answers this before it even reads the row — which is
    // why the console offers no "Link Telegram" at all while it is working there.
    configureApiClient({ getToken: () => 'mock:PLATFORM_ADMIN:token' });

    const error = await caught(adminsApi.issueTelegramLinkCode(ADMIN_IDS.noTelegram));

    expect(error.status).toBe(422);
    expect(error.code).toBe('ADMIN_TELEGRAM_LINK_NOT_ALLOWED');
    expect(error.message).toBe(PLATFORM_LINK_MESSAGE);
    expect(error.details).toMatchObject({ reason: 'PLATFORM' });
  });

  it('names the bot of the operator the request is pointed at, not the caller’s home', async () => {
    // The code is redeemed in THAT operator's bot, so that is the bot the console must name. The
    // backend reads it off the effective tenant; X-Tenant-Id is honoured only for a platform admin,
    // and only while this deployment sends the header at all.
    vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(true);
    configureApiClient({
      getToken: () => 'mock:PLATFORM_ADMIN:token',
      getTenantId: () => TENANT_IDS.second,
    });

    const code = await adminsApi.issueTelegramLinkCode(ADMIN_IDS.noTelegram);

    expect(code.botUsername).toBe('northern_cashier_bot');
    expect(code.botUrl).toBe('https://t.me/northern_cashier_bot');
  });

  it('does NOT refuse an unlink there, which is why the console keeps that button', async () => {
    configureApiClient({ getToken: () => 'mock:PLATFORM_ADMIN:token' });

    expect((await adminsApi.unlinkTelegram(ADMIN_IDS.reviewer)).telegramLinked).toBe(false);
  });

  it('refuses a super admin a code for somebody else, and lets them remove a link', async () => {
    configureApiClient({ getToken: () => 'mock:SUPER_ADMIN:token' });

    const error = await caught(adminsApi.issueTelegramLinkCode(ADMIN_IDS.reviewer));
    expect(error.status).toBe(403);
    expect(error.code).toBe('ADMIN_TELEGRAM_LINK_FORBIDDEN');

    expect((await adminsApi.unlinkTelegram(ADMIN_IDS.reviewer)).telegramLinked).toBe(false);
  });

  it('refuses a super admin the unlink of a platform admin, and lets a platform admin do it', async () => {
    configureApiClient({ getToken: () => 'mock:SUPER_ADMIN:token' });

    const error = await caught(adminsApi.unlinkTelegram(ADMIN_IDS.platformAdmin));
    expect(error.status).toBe(403);
    expect(error.code).toBe('ADMIN_TELEGRAM_LINK_FORBIDDEN');
    expect(db.admins.find((row) => row.id === ADMIN_IDS.platformAdmin)?.telegramLinked).toBe(true);

    configureApiClient({ getToken: () => 'mock:PLATFORM_ADMIN:token' });
    expect((await adminsApi.unlinkTelegram(ADMIN_IDS.platformAdmin)).telegramLinked).toBe(false);
  });
});
