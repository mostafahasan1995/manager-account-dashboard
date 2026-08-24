import { describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { playersApi, tenantsApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

import { db } from './db';
import {
  MOCK_DEBIT_TIMEOUT_PLAYER_ID,
  PLAYER_IDS,
  TENANT_IDS,
  mockPlatformDefaults,
  mockTenants,
} from './fixtures';

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

  it('reports the agent that never answered, which is why that operator is suspended', async () => {
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

/**
 * Creating an operator from the four fields the console now asks for.
 *
 * Everything else is resolved server-side and answered in the TenantView, which is the whole point:
 * the console shows the operator what it GOT, not what it typed, so a default that changes on the
 * platform is visible in the panel rather than baked into a form.
 */
describe('tenant creation defaults', () => {
  const REQUIRED_ONLY = {
    displayName: 'Harbour kiosk',
    botToken: A_REAL_LOOKING_BOT_TOKEN,
    ichancyUsername: 'agent_harbour',
    ichancyPassword: 'never-returned',
  };

  it('fills every omitted field from the platform settings row', async () => {
    const created = await tenantsApi.create(REQUIRED_ONLY);

    expect(created).toMatchObject({
      status: 'SUSPENDED',
      slug: 'harbour-kiosk',
      // The platform admin making the request, not a zero placeholder.
      adminChatId: db.currentAdmin.telegramUserId,
      feedChatId: null,
      ichancyBaseUrl: mockPlatformDefaults.ichancyBaseUrl,
      ichancyAgentId: mockPlatformDefaults.ichancyAgentId,
      currencyCode: mockPlatformDefaults.currencyCode,
      dualApprovalThresholdMinor: mockPlatformDefaults.dualApprovalThresholdMinor,
      agentFloatLowWatermarkMinor: mockPlatformDefaults.agentFloatLowWatermarkMinor,
      depositExpiryMinutes: mockPlatformDefaults.depositExpiryMinutes,
    });
    // Readable again by id, defaults and all — this is what the detail panel re-reads after create.
    expect(await tenantsApi.byId(created.id)).toMatchObject({ slug: 'harbour-kiosk' });
  });

  it('de-duplicates a derived slug instead of refusing the second operator', async () => {
    const first = await tenantsApi.create(REQUIRED_ONLY);
    const second = await tenantsApi.create(REQUIRED_ONLY);
    const third = await tenantsApi.create({ ...REQUIRED_ONLY, displayName: 'Harbour Kiosk!' });

    expect(first.slug).toBe('harbour-kiosk');
    expect(second.slug).toBe('harbour-kiosk-2');
    expect(third.slug).toBe('harbour-kiosk-3');
  });

  it('still refuses a slug the caller chose and somebody else already holds', async () => {
    const caught = await tenantsApi
      .create({ ...REQUIRED_ONLY, slug: 'tenant-zero' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.code).toBe('DUPLICATE_RESOURCE');
  });

  it('prefers a supplied value over the platform default, field by field', async () => {
    const created = await tenantsApi.create({
      ...REQUIRED_ONLY,
      currencyCode: 'EUR',
      depositExpiryMinutes: 45,
      feedChatId: '-1009876543210',
    });

    expect(created.currencyCode).toBe('EUR');
    expect(created.depositExpiryMinutes).toBe(45);
    expect(created.feedChatId).toBe('-1009876543210');
    // Untouched fields still come from the platform row.
    expect(created.agentFloatLowWatermarkMinor).toBe(
      mockPlatformDefaults.agentFloatLowWatermarkMinor,
    );
  });

  it('falls back to tenant zero for an agent id the platform has no default for', async () => {
    db.platformDefaults.ichancyAgentId = null;

    const created = await tenantsApi.create(REQUIRED_ONLY);

    expect(created.ichancyAgentId).toBe(mockTenants[0]!.ichancyAgentId);
  });

  it('refuses with a 400 naming the field when no agent id can be resolved at all', async () => {
    // Ichancy signin() answers with a token pair, so there is no lookup that could rescue this.
    db.platformDefaults.ichancyAgentId = null;
    db.tenants = db.tenants.filter((tenant) => tenant.id !== TENANT_IDS.zero);

    const caught = await tenantsApi.create(REQUIRED_ONLY).catch((error: unknown) => error);

    expect(isApiError(caught) && caught.code).toBe('VALIDATION_FAILED');
    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('ichancyAgentId');
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

  it('clears the webhook on success: the new bot was never told where to deliver', async () => {
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

/**
 * Manual player debits — the endpoint that takes money back OUT of a live casino account.
 *
 * Tested here rather than only through the screen because the three endings are the contract: the
 * console is being built against a mock, and a mock that only ever debits successfully would leave
 * every panel above it wrong about the two endings that actually cost somebody money.
 */
describe('manual player debit', () => {
  const REASON = 'Chargeback on the original deposit';

  it('takes the money, and moves the float it came back into with it', async () => {
    const floatBefore = db.agentFloatLedgerMinor;

    const debit = await playersApi.debit(PLAYER_IDS.linkedActive, {
      amountMinor: '150000',
      reason: REASON,
    });

    expect(debit).toMatchObject({
      status: 'DEBITED',
      amountMinor: '150000',
      playerBalanceBeforeMinor: '320000',
      playerBalanceAfterMinor: '170000',
      // Never API_OK: Ichancy's answer is not proof, re-reading the balance is.
      verifiedBy: 'BALANCE_DELTA',
      reason: REASON,
    });
    // ICHANCY_AGENT_FLOAT +A, exactly as the posting rule says.
    expect(db.agentFloatLedgerMinor - floatBefore).toBe(150_000n);
    // One call, one debit row. This is the endpoint where a second one is somebody's money.
    expect(db.playerDebits).toHaveLength(1);
  });

  it('refuses more than the account holds, and posts nothing at all', async () => {
    const floatBefore = db.agentFloatLedgerMinor;

    const debit = await playersApi.debit(PLAYER_IDS.newcomer, {
      amountMinor: '99999999',
      reason: REASON,
    });

    expect(debit).toMatchObject({
      status: 'REJECTED',
      playerBalanceBeforeMinor: '25000',
      playerBalanceAfterMinor: '25000',
      verifiedBy: null,
    });
    expect(db.agentFloatLedgerMinor).toBe(floatBefore);
  });

  it('leaves the unprovable one for a human instead of trying it again', async () => {
    const floatBefore = db.agentFloatLedgerMinor;

    const debit = await playersApi.debit(MOCK_DEBIT_TIMEOUT_PLAYER_ID, {
      amountMinor: '10000',
      reason: 'Self-exclusion settlement',
    });

    expect(debit.status).toBe('NEEDS_RECONCILIATION');
    // Nothing proved it either way, so nothing is claimed and nothing is posted.
    expect(debit.verifiedBy).toBeNull();
    expect(debit.playerBalanceAfterMinor).toBe(debit.playerBalanceBeforeMinor);
    expect(db.agentFloatLedgerMinor).toBe(floatBefore);
  });

  it('answers 403 to a role that may not decide money, and serves one that may', async () => {
    // The mock reads the role out of the bearer token, exactly as a real access token carries it.
    configureApiClient({ getToken: () => 'mock:SUPPORT:token' });
    await expect(
      playersApi.debit(PLAYER_IDS.linkedActive, { amountMinor: '1000', reason: REASON }),
    ).rejects.toMatchObject({ status: 403 });

    configureApiClient({ getToken: () => 'mock:REVIEWER:token' });
    await expect(
      playersApi.debit(PLAYER_IDS.linkedActive, { amountMinor: '1000', reason: REASON }),
    ).resolves.toMatchObject({ status: 'DEBITED' });
  });

  it('refuses a decimal amount, because the field is minor units', async () => {
    const caught = await playersApi
      .debit(PLAYER_IDS.linkedActive, { amountMinor: '1500.00', reason: REASON })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('amountMinor');
  });

  it('refuses a debit nobody explained', async () => {
    const caught = await playersApi
      .debit(PLAYER_IDS.linkedActive, { amountMinor: '1000', reason: '   ' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('reason');
  });

  it('refuses a player with no Ichancy account to debit', async () => {
    await expect(
      playersApi.debit(PLAYER_IDS.pendingLink, { amountMinor: '1000', reason: REASON }),
    ).rejects.toMatchObject({ status: 409, code: 'PLAYER_NOT_LINKED' });
  });

  it('answers 404 for a player that does not exist', async () => {
    await expect(
      playersApi.debit('bbbbbbbb-0000-4000-8000-000000009999', {
        amountMinor: '1000',
        reason: REASON,
      }),
    ).rejects.toMatchObject({ status: 404, code: 'PLAYER_NOT_FOUND' });
  });
});
