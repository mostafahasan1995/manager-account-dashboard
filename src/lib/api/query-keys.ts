import type {
  AdminListQuery,
  BreakListQuery,
  DepositQueueQuery,
  PaymentMethodListQuery,
  PlayerListQuery,
  WithdrawalListQuery,
} from '@/types';

/**
 * Query keys in one place, so an invalidation can never miss a cache by spelling its key slightly
 * differently. Approving a deposit invalidates `depositKeys.all` and every list under it goes stale
 * at once, whatever filters each one is holding.
 */

export const depositKeys = {
  all: ['deposits'] as const,
  lists: () => [...depositKeys.all, 'list'] as const,
  list: (query: DepositQueueQuery) => [...depositKeys.lists(), query] as const,
  details: () => [...depositKeys.all, 'detail'] as const,
  detail: (id: string) => [...depositKeys.details(), id] as const,
  proof: (depositId: string, proofId: string) =>
    [...depositKeys.all, 'proof', depositId, proofId] as const,
};

/**
 * The on-chain verdict for one deposit. OUTSIDE `depositKeys.all` on purpose, and this is the whole
 * reason it has a root of its own.
 *
 * `useDepositMutation` invalidates `depositKeys.all` after EVERY claim, release, approve, reject
 * and retry — see it in queries.ts. Nested under there, claiming a deposit you are about to read
 * would spend a chain call, and releasing it would spend another; a reviewer who claims, looks and
 * releases would bill three. The chain's answer about a transfer that already happened does not
 * change because somebody in this console pressed a button, so nothing about a review action should
 * refetch it. Same argument as `walletBalanceKeys` and `tenantHealthKeys`: related in meaning,
 * unrelated in cache lifetime.
 */
export const depositChainCheckKeys = {
  all: ['deposit-chain-checks'] as const,
  detail: (depositId: string) => [...depositChainCheckKeys.all, depositId] as const,
};

export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: (query: PlayerListQuery) => [...playerKeys.lists(), query] as const,
  details: () => [...playerKeys.all, 'detail'] as const,
  detail: (id: string) => [...playerKeys.details(), id] as const,
  /**
   * Ichancy balances, one key per player.
   *
   * They sit under `players` so that moving money invalidates them along with everything else about
   * that player — a credit or a debit makes the number in the table wrong the instant it lands.
   * `balances()` is the prefix the page's own "refresh" control invalidates, which refetches the
   * rows currently on screen and nothing else: every entry under it costs an upstream call.
   */
  balances: () => [...playerKeys.all, 'balance'] as const,
  balance: (id: string) => [...playerKeys.balances(), id] as const,
};

/**
 * The withdrawal queue. Its own root beside `depositKeys`, not under it: the two queues are read by
 * different screens and moved by different actions, and approving a deposit has nothing to say to
 * a list of cash-outs. What a withdrawal action DOES change outside this prefix — a player's
 * balance, and the agent float — is named by the mutation itself, see `useWithdrawalMutation`.
 */
export const withdrawalKeys = {
  all: ['withdrawals'] as const,
  lists: () => [...withdrawalKeys.all, 'list'] as const,
  list: (query: WithdrawalListQuery) => [...withdrawalKeys.lists(), query] as const,
  details: () => [...withdrawalKeys.all, 'detail'] as const,
  detail: (id: string) => [...withdrawalKeys.details(), id] as const,
};

export const paymentMethodKeys = {
  all: ['payment-methods'] as const,
  lists: () => [...paymentMethodKeys.all, 'list'] as const,
  list: (query: PaymentMethodListQuery) => [...paymentMethodKeys.lists(), query] as const,
  detail: (id: string) => [...paymentMethodKeys.all, 'detail', id] as const,
  destinations: (methodId: string, includeInactive: boolean) =>
    [...paymentMethodKeys.all, 'destinations', methodId, { includeInactive }] as const,
};

/**
 * A payout wallet's on-chain balance, one key per destination.
 *
 * OUTSIDE `paymentMethodKeys` on purpose, and for the same reason `tenantHealthKeys` sits outside
 * `tenantKeys`: every other key under payment methods reads this console's own database and is
 * invalidated by anything that edits a rail, while this one costs a round trip to a third-party
 * chain explorer that is rate-limited and answers the same number either way. Renaming a
 * destination must not spend a chain read, and a chain read must not look like reading a rail.
 */
export const walletBalanceKeys = {
  all: ['wallet-balances'] as const,
  detail: (destinationId: string) => [...walletBalanceKeys.all, destinationId] as const,
};

export const adminKeys = {
  all: ['admins'] as const,
  lists: () => [...adminKeys.all, 'list'] as const,
  list: (query: AdminListQuery) => [...adminKeys.lists(), query] as const,
  detail: (id: string) => [...adminKeys.all, 'detail', id] as const,
  approvalLimits: (adminUserId: string) =>
    [...adminKeys.all, 'approval-limits', adminUserId] as const,
};

export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  breaks: () => [...reconciliationKeys.all, 'breaks'] as const,
  breakList: (query: BreakListQuery) => [...reconciliationKeys.breaks(), query] as const,
  breakDetail: (id: string) => [...reconciliationKeys.breaks(), 'detail', id] as const,
  railAgeing: () => [...reconciliationKeys.all, 'rail-ageing'] as const,
};

/**
 * The platform's own defaults. OUTSIDE `tenantKeys` on purpose: creating or editing an operator
 * must not invalidate this row, and editing this row must not refetch every operator. They are
 * related in meaning and unrelated in cache lifetime.
 */
/**
 * The crypto rate. Its own key: setting it must not refetch every payment method, and editing a
 * method must not refetch it. They are related in meaning and unrelated in cache lifetime.
 */
export const shamCashKeys = {
  all: ['shamcash'] as const,
  status: () => [...shamCashKeys.all, 'status'] as const,
};

export const exchangeRateKeys = {
  all: ['exchange-rates'] as const,
  usdt: () => [...exchangeRateKeys.all, 'usdt'] as const,
};

export const platformDefaultsKeys = {
  all: ['platform-defaults'] as const,
};

/**
 * The platform finance overview. Its own root: the cheap overview and the per-operator refresh both
 * live under it, and a refresh invalidates `overview()` so the freshened figure lands on the table.
 * `tenant(id)` is here for a future per-operator drill-in; the table refreshes through the overview.
 */
export const platformFinanceKeys = {
  all: ['platform-finance'] as const,
  overview: () => [...platformFinanceKeys.all, 'overview'] as const,
  tenant: (id: string) => [...platformFinanceKeys.all, 'tenant', id] as const,
};

/**
 * The window is PART of the key, so switching from "this month" to "today" is a different query
 * rather than a refetch of the same one. Without it the screen would show last window's figures
 * under the new window's heading for as long as the request took — which is exactly the moment
 * somebody screenshots it.
 */
/**
 * The bench is all MUTATIONS — nothing about it is a cacheable read. A check is an act with a cost
 * (a browser, ~90 seconds, a live session in the body), so it happens when somebody presses the
 * button and never because a component mounted or a window regained focus.
 */

/**
 * A QR pairing, which is the one thing on the bench that IS a read: "has it been scanned yet?",
 * asked every couple of seconds. Keyed by the pairing id so two attempts never share an answer.
 */
export const shamCashPairingKeys = {
  all: ['shamcash-pairing'] as const,
  detail: (id: string) => [...shamCashPairingKeys.all, id] as const,
};

/** The linked Sham Cash account. One key per tenant is unnecessary — the API scopes it already. */
export const shamCashAccountKeys = {
  all: ['shamcash-account'] as const,
  status: () => [...shamCashAccountKeys.all, 'status'] as const,
};

export const statsKeys = {
  all: ['stats'] as const,
  mine: (period: string) => [...statsKeys.all, 'mine', period] as const,
  tenants: (period: string) => [...statsKeys.all, 'tenants', period] as const,
};

export const tenantKeys = {
  all: ['tenants'] as const,
  list: () => [...tenantKeys.all, 'list'] as const,
  detail: (id: string) => [...tenantKeys.all, 'detail', id] as const,
};

/**
 * An operator's health sits OUTSIDE `tenantKeys.all` on purpose.
 *
 * Answering it costs the server a real Ichancy signin and a Telegram round trip, so renaming an
 * operator must not drag a health check along behind it. The operations that genuinely change what
 * health reports — webhook, bot, Ichancy credentials — invalidate this key by name instead.
 */
export const tenantHealthKeys = {
  all: ['tenant-health'] as const,
  detail: (tenantId: string) => [...tenantHealthKeys.all, tenantId] as const,
};

/**
 * One operator's chat directory, keyed BY THAT OPERATOR — the staff and feed group picker.
 *
 * Deliberately not `telegramChatKeys`: that list follows the console's operator switcher, while this
 * one names its operator in the path. Sharing a key would let a platform admin looking at operator X
 * be shown operator Y's groups for one render — titles, and who added the bot — which is precisely the
 * leak picking the wrong group causes.
 */
export const tenantChatKeys = {
  all: ['tenant-telegram-chats'] as const,
  list: (tenantId: string) => [...tenantChatKeys.all, tenantId] as const,
};

export const healthKeys = {
  all: ['health'] as const,
  snapshot: () => [...healthKeys.all, 'snapshot'] as const,
};

export const egressKeys = {
  all: ['egress'] as const,
  status: () => [...egressKeys.all, 'status'] as const,
};

/**
 * The agent float. Its own root, deliberately OUTSIDE `reconciliationKeys`.
 *
 * The top bar holds this query open on every screen in the console, so putting it under
 * reconciliation would make assigning a break — or any other prefix invalidation on that page —
 * refetch a piece of chrome for everybody. They are related in meaning and unrelated in cache
 * lifetime, the same argument `tenantHealthKeys` makes above.
 *
 * ── THE COST OF THAT, WHICH IS REAL ───────────────────────────────────────────────────────────
 * Nothing else's prefix reaches this key, so every mutation that moves money has to name it. Four
 * families do — manual credits and debits, the deposit actions that end in a credit, and the float
 * correction — and each goes through `refreshAgentFloat` in queries.ts rather than invalidating
 * here directly, because for most of them the ledger has not moved yet when the response lands. Add
 * a fifth money mutation and it must do the same; a prefix will not do it for you.
 */
export const agentFloatKeys = {
  all: ['agent-float'] as const,
  current: () => [...agentFloatKeys.all, 'current'] as const,
};

/**
 * Where an operator's bot publishes.
 *
 * Its own root rather than a branch of `tenantKeys`: an operator manages these on their own screen,
 * and a rename on the Tenants page has nothing to say about them. `check(id)` is deliberately NOT a
 * query key — verifying a destination is an action that costs a Telegram round trip and writes to
 * the row, so it is a mutation whose result the page holds, never a cached read that a re-render
 * could re-fire.
 */
export const telegramDestinationKeys = {
  all: ['telegram-destinations'] as const,
  list: () => [...telegramDestinationKeys.all, 'list'] as const,
  detail: (id: string) => [...telegramDestinationKeys.all, 'detail', id] as const,
};

/**
 * The chats the bot has been added to — a SEPARATE key from the destinations above.
 *
 * They change for different reasons and mostly at different times: a destination changes when
 * somebody on this screen edits one, while this list changes when somebody adds the bot to a group
 * inside Telegram, which no console action causes. Sharing one key would refetch each list every
 * time the other moved.
 *
 * The one place they DO touch is `alreadyBound`, which is computed from the active destinations, so
 * binding and removing invalidate both. That is a deliberate two-line cost, not a missing merge.
 */
export const telegramChatKeys = {
  all: ['telegram-chats'] as const,
  list: () => [...telegramChatKeys.all, 'list'] as const,
};

/**
 * The bot's menu tree. ONE key for the whole graph, not one per screen.
 *
 * The editor renders edges between screens — a NAVIGATE button names its destination — so a cache
 * holding one screen without the others cannot draw itself. Every write therefore invalidates the
 * whole tree, which is also the honest thing: adding a button to screen A changes what screen B's
 * "opens" dropdown may offer.
 */
export const botMenuKeys = {
  all: ['bot-menu'] as const,
  tree: () => [...botMenuKeys.all, 'tree'] as const,
};

/**
 * The bot's two runtime settings, OUTSIDE `botMenuKeys` even though the tree carries a copy.
 *
 * A button edit invalidates the whole tree and must not re-read the settings for it; a settings
 * save invalidates both, by name, because the tree's copy is then stale. One direction, on purpose.
 */
export const botSettingsKeys = {
  all: ['bot-settings'] as const,
  current: () => [...botSettingsKeys.all, 'current'] as const,
};
