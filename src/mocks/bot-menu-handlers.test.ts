import { describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { botMenuApi, tenantsApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

import { db } from './db';
import { BOT_MENU_NODE_IDS, TENANT_IDS } from './fixtures';

/**
 * The bot's menu and its settings, tested for the refusals that ARE the contract: the root screen
 * cannot go, a screen still opened by a button cannot go, and the last active button for a
 * required action can be neither deleted nor hidden — because a bot with no way to deposit,
 * withdraw or open the profile is a bot the owner said must not exist.
 */

const asRole = (role: string): void => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

const rootButtons = async () => {
  const tree = await botMenuApi.tree();
  return tree.nodes.find((node) => node.isRoot)?.buttons ?? [];
};

const buttonFor = async (action: string) =>
  (await rootButtons()).find((button) => button.builtinAction === action);

describe('the tree', () => {
  it('carries the screens, the action catalogue with withdraw and miniapp, the gate and the settings', async () => {
    const tree = await botMenuApi.tree();

    expect(tree.nodes.map((node) => node.key).sort()).toEqual(['help', 'main']);
    expect(tree.builtinActions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['deposit', 'withdraw', 'profile', 'miniapp']),
    );
    expect(tree.gate).toEqual({ channelId: '-1003456789012', channelUsername: 'ichancy_news' });
    expect(tree.settings).toEqual({
      miniAppUrl: null,
      depositMode: 'MANUAL',
      withdrawalMode: 'MANUAL',
      chatMenuButtonSet: false,
    });
  });

  it('is readable by a reviewer and not by a viewer', async () => {
    asRole('REVIEWER');
    await expect(botMenuApi.tree()).resolves.toBeTruthy();

    asRole('VIEWER');
    await expect(botMenuApi.tree()).rejects.toMatchObject({ status: 403 });
  });
});

describe('the settings', () => {
  it('are the home operator’s own fields, seen from inside the operator', async () => {
    const settings = await botMenuApi.settings();
    expect(settings).toEqual({
      miniAppUrl: null,
      depositMode: 'MANUAL',
      withdrawalMode: 'MANUAL',
      chatMenuButtonSet: false,
    });
  });

  it('switching the withdrawal mode writes the tenant row, so the platform screen agrees', async () => {
    const updated = await botMenuApi.updateSettings({ withdrawalMode: 'AUTO' });
    expect(updated.withdrawalMode).toBe('AUTO');

    asRole('PLATFORM_ADMIN');
    expect((await tenantsApi.byId(TENANT_IDS.zero)).withdrawalMode).toBe('AUTO');
  });

  it('switching the deposit mode writes the tenant row, so the platform screen agrees', async () => {
    const updated = await botMenuApi.updateSettings({ depositMode: 'AUTO' });
    expect(updated.depositMode).toBe('AUTO');

    asRole('PLATFORM_ADMIN');
    expect((await tenantsApi.byId(TENANT_IDS.zero)).depositMode).toBe('AUTO');
  });

  it('setting an https URL points the chat menu button at it; clearing it takes the button away', async () => {
    const set = await botMenuApi.updateSettings({ miniAppUrl: 'https://app.example.ngrok.app' });
    expect(set).toMatchObject({
      miniAppUrl: 'https://app.example.ngrok.app',
      chatMenuButtonSet: true,
      // Untouched by a PATCH that did not name it.
      withdrawalMode: 'MANUAL',
    });

    const cleared = await botMenuApi.updateSettings({ miniAppUrl: null });
    expect(cleared).toMatchObject({ miniAppUrl: null, chatMenuButtonSet: false });
  });

  it('refuses an http URL and an invented mode, naming the field', async () => {
    const url = await botMenuApi
      .updateSettings({ miniAppUrl: 'http://insecure.example' })
      .catch((error: unknown) => error);
    expect(isApiError(url) && url.status).toBe(400);
    expect(isApiError(url) ? url.fieldErrors.join(' ') : '').toContain('miniAppUrl');

    const mode = await botMenuApi
      .updateSettings({ withdrawalMode: 'SOMETIMES' as never })
      .catch((error: unknown) => error);
    expect(isApiError(mode) ? mode.fieldErrors.join(' ') : '').toContain('withdrawalMode');
  });

  it('is written by a finance admin and refused to a reviewer', async () => {
    asRole('REVIEWER');
    await expect(botMenuApi.updateSettings({ withdrawalMode: 'AUTO' })).rejects.toMatchObject({
      status: 403,
    });

    asRole('FINANCE_ADMIN');
    await expect(botMenuApi.updateSettings({ withdrawalMode: 'AUTO' })).resolves.toMatchObject({
      withdrawalMode: 'AUTO',
    });
  });
});

describe('screens', () => {
  it('creates one, renames it, and refuses a second with the same key', async () => {
    const created = await botMenuApi.createNode({ key: 'promo', name: 'Promotions' });
    expect(created).toMatchObject({ key: 'promo', name: 'Promotions', isRoot: false, buttons: [] });

    const renamed = await botMenuApi.updateNode(created.id, {
      name: 'Offers',
      promptText: 'هدايا',
    });
    expect(renamed).toMatchObject({ name: 'Offers', promptText: 'هدايا' });

    await expect(botMenuApi.createNode({ key: 'promo', name: 'Again' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('never deletes the root, and never a screen a button still opens', async () => {
    await expect(botMenuApi.deleteNode(BOT_MENU_NODE_IDS.root)).rejects.toMatchObject({
      status: 409,
      code: 'BOT_MENU_ROOT_PROTECTED',
    });

    await expect(botMenuApi.deleteNode(BOT_MENU_NODE_IDS.help)).rejects.toMatchObject({
      status: 409,
      code: 'BOT_MENU_NODE_IN_USE',
    });
  });

  it('deletes a screen once nothing opens it any more', async () => {
    const navigate = (await rootButtons()).find((button) => button.kind === 'NAVIGATE');
    if (navigate === undefined) throw new Error('fixture has no NAVIGATE button');

    await botMenuApi.deleteButton(navigate.id);
    await expect(botMenuApi.deleteNode(BOT_MENU_NODE_IDS.help)).resolves.toEqual({ deleted: true });
    expect((await botMenuApi.tree()).nodes.map((node) => node.key)).toEqual(['main']);
  });

  it('answers 404 for a screen nobody has', async () => {
    await expect(
      botMenuApi.updateNode('88888888-0000-4000-8000-000000000999', {}),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('buttons', () => {
  it('adds one to a screen, on a new row, and refuses a second with the same label', async () => {
    const button = await botMenuApi.createButton({
      nodeId: BOT_MENU_NODE_IDS.help,
      label: '📞 اتصل بنا',
      kind: 'TEXT',
      bodyText: '+963 11 000 0000',
    });

    expect(button).toMatchObject({
      kind: 'TEXT',
      bodyText: '+963 11 000 0000',
      rowIndex: 2,
      isActive: true,
    });
    // Exactly one payload column, whatever was sent.
    expect(button.builtinAction).toBeNull();
    expect(button.targetNodeId).toBeNull();

    await expect(
      botMenuApi.createButton({
        nodeId: BOT_MENU_NODE_IDS.help,
        label: '📞 اتصل بنا',
        kind: 'BACK',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses an action the bot does not have — an action is a handler', async () => {
    const caught = await botMenuApi
      .createButton({
        nodeId: BOT_MENU_NODE_IDS.root,
        label: 'X',
        kind: 'BUILTIN',
        builtinAction: 'lottery',
      })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('builtinAction');
  });

  it('renames and re-kinds a button, nulling the columns the new kind does not carry', async () => {
    const about = await buttonFor('about');
    if (about === undefined) throw new Error('fixture has no about button');

    const updated = await botMenuApi.updateButton(about.id, {
      label: 'ℹ️ عن الخدمة',
      kind: 'TEXT',
      bodyText: 'الخدمة تعمل على مدار الساعة.',
    });

    expect(updated).toMatchObject({ label: 'ℹ️ عن الخدمة', kind: 'TEXT', builtinAction: null });
  });

  it('keeps the last active button for a required action: neither hidden nor deleted', async () => {
    const withdraw = await buttonFor('withdraw');
    const deposit = await buttonFor('deposit');
    if (withdraw === undefined || deposit === undefined)
      throw new Error('fixture lacks a required button');

    await expect(botMenuApi.updateButton(withdraw.id, { isActive: false })).rejects.toMatchObject({
      status: 409,
      code: 'BUTTON_REQUIRED',
    });
    await expect(botMenuApi.deleteButton(deposit.id)).rejects.toMatchObject({
      status: 409,
      code: 'BUTTON_REQUIRED',
    });

    // A second deposit button makes the first one deletable — the rule is about the LAST one.
    await botMenuApi.createButton({
      nodeId: BOT_MENU_NODE_IDS.help,
      label: '💵 شحن',
      kind: 'BUILTIN',
      builtinAction: 'deposit',
    });
    await expect(botMenuApi.deleteButton(deposit.id)).resolves.toEqual({ deleted: true });
  });

  it('deletes a button nothing requires', async () => {
    const terms = await buttonFor('terms');
    if (terms === undefined) throw new Error('fixture has no terms button');

    await expect(botMenuApi.deleteButton(terms.id)).resolves.toEqual({ deleted: true });
    expect(await buttonFor('terms')).toBeUndefined();
  });

  it('reorders a whole screen in one write', async () => {
    const before = await rootButtons();
    const [first, second] = before;
    if (first === undefined || second === undefined) throw new Error('fixture has too few buttons');

    const node = await botMenuApi.reorder(BOT_MENU_NODE_IDS.root, {
      positions: [
        { id: first.id, rowIndex: 0, sortOrder: 1 },
        { id: second.id, rowIndex: 0, sortOrder: 0 },
      ],
    });

    expect(node.buttons[0]?.id).toBe(second.id);
    expect(node.buttons[1]?.id).toBe(first.id);
  });

  it('answers 404 for a button nobody has, and 403 to a reviewer', async () => {
    await expect(
      botMenuApi.deleteButton('99990000-0000-4000-8000-000000000999'),
    ).rejects.toMatchObject({
      status: 404,
    });

    asRole('REVIEWER');
    await expect(botMenuApi.createNode({ key: 'x', name: 'X' })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('the gate', () => {
  it('sets both fields together, strips a leading @, and clears both together', async () => {
    const set = await botMenuApi.updateGate({
      channelId: '-1009999888877',
      channelUsername: '@my_channel',
    });
    expect(set).toEqual({ channelId: '-1009999888877', channelUsername: 'my_channel' });
    expect(db.botMenu.gate).toEqual(set);

    const cleared = await botMenuApi.updateGate({ channelId: null, channelUsername: null });
    expect(cleared).toEqual({ channelId: null, channelUsername: null });
  });

  it('refuses half a gate, and an id that is not a channel id', async () => {
    const half = await botMenuApi
      .updateGate({ channelId: '-1009999888877', channelUsername: null })
      .catch((error: unknown) => error);
    expect(isApiError(half) && half.status).toBe(400);
    expect(isApiError(half) ? half.fieldErrors.join(' ') : '').toContain('together');

    await expect(
      botMenuApi.updateGate({ channelId: 'not-a-number', channelUsername: 'x' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
