import { describe, expect, it } from 'vitest';

import { tenantsApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

import { TENANT_IDS } from './fixtures';

/**
 * The mock backend's operator operations, tested for the failure modes rather than the happy path.
 *
 * The screens above this are being built before the real endpoints exist, so the mock is the only
 * thing telling them what a broken operator looks like. If it answered "healthy" for an operator
 * Telegram has never heard of, every panel built against it would be wrong on the day it meets the
 * real backend — which is exactly the gap docs/TENANT-OPERATIONS.md section 5 describes.
 */

const A_REAL_LOOKING_BOT_TOKEN = '8123456789:AAG7hZ2q-Xk_9pLmN4rTvBcD1eFgHiJkLmN';
const NO_SUCH_TENANT_ID = '11111111-0000-4000-8000-000000000999';

describe('operator health', () => {
  it('reports a dead bot for an operator whose webhook was never registered', async () => {
    const health = await tenantsApi.health(TENANT_IDS.suspended);

    expect(health.bot.webhookUrl).toBeNull();
    expect(health.bot.webhookMatches).toBe(false);
    expect(health.bot.ok).toBe(false);
  });

  it('reports the Ichancy agent that never answered, which is why that operator is suspended', async () => {
    const health = await tenantsApi.health(TENANT_IDS.suspended);

    expect(health.ichancy.ok).toBe(false);
    expect(health.ichancy.error).toContain('did not answer');
    // No signin, no float: reporting a number here would be inventing one.
    expect(health.ichancy.floatMinor).toBeNull();
    expect(health.ichancy.belowWatermark).toBe(false);
  });

  it('reports a registered operator as healthy, warnings included', async () => {
    const health = await tenantsApi.health(TENANT_IDS.second);

    expect(health.bot.ok).toBe(true);
    expect(health.bot.webhookMatches).toBe(true);
    expect(health.bot.webhookUrl).toContain('/telegram/webhook/');
    expect(health.ichancy.ok).toBe(true);
    // A float under the watermark is a warning, not an outage: `ok` stays true.
    expect(health.ichancy.belowWatermark).toBe(true);
    expect(health.counts.players).toBeGreaterThan(0);
  });

  it('registers and unregisters a webhook, and health follows both ways', async () => {
    const removed = await tenantsApi.removeWebhook(TENANT_IDS.second);
    expect(removed.registered).toBe(false);
    expect(removed.url).toBeNull();
    expect((await tenantsApi.health(TENANT_IDS.second)).bot.webhookMatches).toBe(false);

    const registered = await tenantsApi.registerWebhook(TENANT_IDS.second);
    expect(registered.registered).toBe(true);
    expect(registered.url).toContain('/telegram/webhook/');
    expect((await tenantsApi.health(TENANT_IDS.second)).bot.webhookMatches).toBe(true);
  });

  it('gives a newly created operator a webhook nobody has registered', async () => {
    const created = await tenantsApi.create({
      slug: 'harbour-kiosk',
      displayName: 'Harbour kiosk',
      botToken: A_REAL_LOOKING_BOT_TOKEN,
      adminChatId: '-1003333333333',
      ichancyBaseUrl: 'https://agent.ichancy.example',
      ichancyUsername: 'agent_harbour',
      ichancyPassword: 'never-returned',
      ichancyAgentId: '10777',
      currencyCode: 'NSP',
      dualApprovalThresholdMinor: '10000000',
      agentFloatLowWatermarkMinor: '20000000',
      depositExpiryMinutes: 30,
    });

    const health = await tenantsApi.health(created.id);
    expect(health.bot.webhookUrl).toBeNull();
    expect(health.bot.ok).toBe(false);
    expect(health.counts).toEqual({ players: 0, deposits: 0 });
  });
});

describe('agent sharing', () => {
  it('finds nobody while every operator has its own Ichancy login', async () => {
    const health = await tenantsApi.health(TENANT_IDS.zero);
    expect(health.ichancy.sharesAgentWith).toEqual([]);
  });

  it('pairs the operators that share one Ichancy session, in both directions', async () => {
    const home = await tenantsApi.byId(TENANT_IDS.zero);
    // Same base URL and username: one Ichancy token pair, two operators using it.
    await tenantsApi.updateIchancy(TENANT_IDS.suspended, {
      ichancyBaseUrl: home.ichancyBaseUrl,
      ichancyUsername: home.ichancyUsername,
      ichancyPassword: 'shared-agent-password',
    });

    expect((await tenantsApi.health(TENANT_IDS.zero)).ichancy.sharesAgentWith).toEqual([
      'pilot-operator',
    ]);
    expect((await tenantsApi.health(TENANT_IDS.suspended)).ichancy.sharesAgentWith).toEqual([
      'tenant-zero',
    ]);
    // A different agent id on the same login does not separate them, which is the trap.
    expect((await tenantsApi.health(TENANT_IDS.second)).ichancy.sharesAgentWith).toEqual([]);
  });
});

describe('changing an operator Ichancy configuration', () => {
  it('refuses a new agent id once the operator has players', async () => {
    await expect(
      tenantsApi.updateIchancy(TENANT_IDS.second, { ichancyAgentId: '10200' }),
    ).rejects.toMatchObject({ status: 422, code: 'TENANT_AGENT_HAS_PLAYERS' });

    // Refused means unchanged, not partly applied.
    expect((await tenantsApi.byId(TENANT_IDS.second)).ichancyAgentId).toBe('10099');
  });

  it('applies the other fields to an operator that has players', async () => {
    const updated = await tenantsApi.updateIchancy(TENANT_IDS.second, {
      ichancyUsername: 'agent_north_v2',
      ichancyPassword: 'rotated',
    });

    expect(updated.ichancyUsername).toBe('agent_north_v2');
    expect(updated.ichancyAgentId).toBe('10099');
  });

  it('allows the agent id to move while the operator has no players', async () => {
    const updated = await tenantsApi.updateIchancy(TENANT_IDS.suspended, {
      ichancyAgentId: '10321',
    });

    expect(updated.ichancyAgentId).toBe('10321');
  });
});

describe('replacing an operator bot', () => {
  it('rejects a token that is not the shape BotFather hands out', async () => {
    const caught = await tenantsApi
      .updateBot(TENANT_IDS.second, { botToken: 'definitely-not-a-token' })
      .then(() => null)
      .catch((error: unknown) => error);

    if (!isApiError(caught)) throw new Error('expected the mock to refuse the token');
    expect(caught.status).toBe(400);
    expect(caught.code).toBe('VALIDATION_FAILED');
    expect(caught.fieldErrors.join(' ')).toContain('botToken');
  });

  it('clears the webhook on success, because the new bot was never told where to deliver', async () => {
    const before = await tenantsApi.health(TENANT_IDS.second);
    expect(before.bot.webhookMatches).toBe(true);

    const updated = await tenantsApi.updateBot(TENANT_IDS.second, {
      botToken: A_REAL_LOOKING_BOT_TOKEN,
    });
    expect(updated.botUsername).not.toBe(before.bot.username);

    const after = await tenantsApi.health(TENANT_IDS.second);
    expect(after.bot.webhookUrl).toBeNull();
    expect(after.bot.ok).toBe(false);
  });
});

describe('bot setup', () => {
  it('reports how many commands were pushed and to which scopes', async () => {
    const result = await tenantsApi.setupBot(TENANT_IDS.zero);

    expect(result.commandsSet).toBeGreaterThan(0);
    expect(result.scopes).toContain('all_private_chats');
  });

  it('answers 404 for an operator that does not exist', async () => {
    await expect(tenantsApi.setupBot(NO_SUCH_TENANT_ID)).rejects.toMatchObject({
      status: 404,
      code: 'TENANT_NOT_FOUND',
    });
  });
});
