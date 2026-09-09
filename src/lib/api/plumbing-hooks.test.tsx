import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { PLAYER_IDS, TENANT_IDS, WITHDRAWAL_IDS } from '@/mocks/fixtures';

import {
  agentFloatCatchUp,
  useApproveWithdrawal,
  useAttachPlayerTelegram,
  useBlockPlayer,
  useBotSettings,
  useImportPlayers,
  useImportTenantPlayers,
  useMarkWithdrawalPaid,
  useRegisterPlayer,
  useRejectWithdrawal,
  useUnblockPlayer,
  useUpdateBotSettings,
  useWithdrawal,
  useWithdrawals,
} from './queries';
import {
  agentFloatKeys,
  botMenuKeys,
  botSettingsKeys,
  playerKeys,
  tenantKeys,
  withdrawalKeys,
} from './query-keys';

/**
 * The hooks Phase 4A adds, tested for what they INVALIDATE — because that is the whole design of
 * each one, and the part nothing else would catch. A withdrawal decision that refetched the queue
 * and not the balances would show a debited player at their old figure; one that refreshed the
 * float on a rejection would spend ten reads to be told the same number; a bot-settings save that
 * forgot the tree would leave the flow editor describing a mini-app button pointing at nothing.
 */

const testClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

const providerFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

/** Seeds one cache entry per key, so "was it invalidated" is a question the cache can answer. */
const seed = (client: QueryClient, keys: readonly (readonly unknown[])[]): void => {
  for (const key of keys) client.setQueryData(key, { seeded: true });
};

const invalidated = (client: QueryClient, key: readonly unknown[]): boolean =>
  client.getQueryState(key)?.isInvalidated === true;

const WATCHED = [
  withdrawalKeys.list({}),
  withdrawalKeys.detail(WITHDRAWAL_IDS.requested),
  playerKeys.balance(PLAYER_IDS.linkedActive),
  playerKeys.list({}),
  agentFloatKeys.current(),
  botSettingsKeys.current(),
  botMenuKeys.tree(),
  tenantKeys.list(),
] as const;

async function fire<TVariables>(
  useHook: () => {
    mutate: (variables: TVariables) => void;
    isPending: boolean;
    isIdle: boolean;
    isError: boolean;
    error: unknown;
  },
  variables: TVariables,
): Promise<QueryClient> {
  const client = testClient();
  seed(client, WATCHED);
  const { result } = renderHook(useHook, { wrapper: providerFor(client) });

  act(() => {
    result.current.mutate(variables);
  });
  await waitFor(() => {
    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(false);
  });
  expect(result.current.error).toBeNull();

  return client;
}

beforeEach(() => {
  configureApiClient({
    getToken: () => 'test-token',
    getTenantId: () => null,
    onUnauthorized: () => undefined,
  });
});

afterEach(() => {
  agentFloatCatchUp.stop();
});

describe('the withdrawal decisions', () => {
  it('approving re-reads the queue, the balances on screen, and starts the float catch-up', async () => {
    const client = await fire(useApproveWithdrawal, WITHDRAWAL_IDS.requested);

    expect(invalidated(client, withdrawalKeys.list({}))).toBe(true);
    expect(invalidated(client, withdrawalKeys.detail(WITHDRAWAL_IDS.requested))).toBe(true);
    expect(invalidated(client, playerKeys.balance(PLAYER_IDS.linkedActive))).toBe(true);
    expect(invalidated(client, agentFloatKeys.current())).toBe(true);
    // The player ROW did not change, so the directory is left alone.
    expect(invalidated(client, playerKeys.list({}))).toBe(false);
  });

  it('rejecting re-reads the queue and the balances, and leaves the float alone', async () => {
    const client = await fire(useRejectWithdrawal, {
      id: WITHDRAWAL_IDS.requested,
      body: { reason: 'Wrong address.' },
    });

    expect(invalidated(client, withdrawalKeys.list({}))).toBe(true);
    expect(invalidated(client, playerKeys.balance(PLAYER_IDS.linkedActive))).toBe(true);
    expect(invalidated(client, agentFloatKeys.current())).toBe(false);
  });

  it('marking paid posts to the ledger, so the float is refreshed', async () => {
    const client = await fire(useMarkWithdrawalPaid, {
      id: WITHDRAWAL_IDS.debited,
      body: { payoutReference: 'TRX-1' },
    });

    expect(invalidated(client, withdrawalKeys.list({}))).toBe(true);
    expect(invalidated(client, agentFloatKeys.current())).toBe(true);
  });
});

describe('the withdrawal reads', () => {
  it('lists the queue with its page meta', async () => {
    const client = testClient();
    const { result } = renderHook(() => useWithdrawals({ limit: 2 }, { poll: false }), {
      wrapper: providerFor(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.meta.total).toBe(5);
  });

  it('reads one row, and asks nothing for an undefined id', async () => {
    const client = testClient();
    const { result } = renderHook(() => useWithdrawal(WITHDRAWAL_IDS.paid), {
      wrapper: providerFor(client),
    });
    await waitFor(() => {
      expect(result.current.data?.status).toBe('PAID');
    });

    const idle = renderHook(() => useWithdrawal(undefined), { wrapper: providerFor(client) });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('the player administration hooks', () => {
  it('registering re-reads the directory', async () => {
    const client = await fire(useRegisterPlayer, { firstName: 'Nadia' });
    expect(invalidated(client, playerKeys.list({}))).toBe(true);
    expect(invalidated(client, agentFloatKeys.current())).toBe(false);
  });

  it('blocking and unblocking re-read the directory', async () => {
    const blocked = await fire(useBlockPlayer, {
      playerId: PLAYER_IDS.linkedActive,
      body: { reason: 'Dispute.' },
    });
    expect(invalidated(blocked, playerKeys.list({}))).toBe(true);

    const unblocked = await fire(useUnblockPlayer, PLAYER_IDS.linkedActive);
    expect(invalidated(unblocked, playerKeys.list({}))).toBe(true);
  });

  it('attaching a Telegram id re-reads the directory', async () => {
    const client = await fire(useAttachPlayerTelegram, {
      playerId: PLAYER_IDS.imported,
      body: { telegramUserId: '512340777' },
    });
    expect(invalidated(client, playerKeys.list({}))).toBe(true);
  });

  it('importing re-reads the directory, and the platform import re-reads the operators too', async () => {
    const own = await fire(useImportPlayers, {});
    expect(invalidated(own, playerKeys.list({}))).toBe(true);
    expect(invalidated(own, tenantKeys.list())).toBe(false);

    const platform = await fire(useImportTenantPlayers, TENANT_IDS.zero);
    expect(invalidated(platform, playerKeys.list({}))).toBe(true);
    expect(invalidated(platform, tenantKeys.list())).toBe(true);
  });
});

describe('the bot settings', () => {
  it('reads them', async () => {
    const client = testClient();
    const { result } = renderHook(() => useBotSettings(), { wrapper: providerFor(client) });

    await waitFor(() => {
      expect(result.current.data?.withdrawalMode).toBe('MANUAL');
    });

    const off = renderHook(() => useBotSettings({ enabled: false }), {
      wrapper: providerFor(client),
    });
    expect(off.result.current.fetchStatus).toBe('idle');
  });

  it('saving re-reads the settings AND the tree that carries a copy of them', async () => {
    const client = await fire(useUpdateBotSettings, { withdrawalMode: 'AUTO' });

    expect(invalidated(client, botSettingsKeys.current())).toBe(true);
    expect(invalidated(client, botMenuKeys.tree())).toBe(true);
    expect(invalidated(client, withdrawalKeys.list({}))).toBe(false);
  });
});
