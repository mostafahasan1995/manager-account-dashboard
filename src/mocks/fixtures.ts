import { formatMinorToDecimal } from '@/lib/money';
import type {
  AdminDeposit,
  AdminPlayer,
  AdminUser,
  ApprovalLimit,
  MoneyView,
  PaymentDestination,
  PaymentMethod,
  ReconciliationBreak,
  Tenant,
  TenantFinanceRow,
  DiscoveredChat,
  TelegramDestination,
} from '@/types';

/**
 * The seed data behind the mock API.
 *
 * It is a realistic cashier morning rather than a tidy demo: a couple of deposits with duplicate
 * proofs, one credit that failed, one that needs reconciliation, an agent float that does not agree
 * with Ichancy, and a rail that has been holding money for three weeks. Working against pretty data
 * is how a console ends up unable to show the day it was built for.
 *
 * Timestamps are relative to load time so "4 minutes ago" stays true whenever it is opened.
 */

export const MOCK_CURRENCY = 'NSP';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const minutesAhead = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export const money = (minor: bigint, currency: string = MOCK_CURRENCY): MoneyView => ({
  minor: minor.toString(),
  amount: formatMinorToDecimal(minor),
  currency,
});

export const TENANT_ZERO_ID = '00000000-0000-0000-0000-000000000000';

const uuid = (n: number, prefix: string): string => {
  const tail = String(n).padStart(12, '0');
  return `${prefix}-0000-4000-8000-${tail}`;
};

export const ADMIN_IDS = {
  superAdmin: uuid(1, 'aaaaaaaa'),
  financeAdmin: uuid(2, 'aaaaaaaa'),
  reviewer: uuid(3, 'aaaaaaaa'),
  support: uuid(4, 'aaaaaaaa'),
  viewer: uuid(5, 'aaaaaaaa'),
  platformAdmin: uuid(6, 'aaaaaaaa'),
  deactivated: uuid(7, 'aaaaaaaa'),
} as const;

export const PLAYER_IDS = {
  linkedActive: uuid(1, 'bbbbbbbb'),
  pendingLink: uuid(2, 'bbbbbbbb'),
  suspended: uuid(3, 'bbbbbbbb'),
  selfExcluded: uuid(4, 'bbbbbbbb'),
  newcomer: uuid(5, 'bbbbbbbb'),
  closed: uuid(6, 'bbbbbbbb'),
} as const;

/**
 * The player whose balance NEVER reads, in demo mode and in tests.
 *
 * A mock where every balance succeeds would let the rule this column exists for rot unnoticed: a
 * failed read must render as a word, never as `0`. Keeping one permanently broken cell next to
 * working ones means the failure state is on screen every time anyone opens the page, instead of
 * being a branch only a test remembers.
 */
export const BALANCE_UNREADABLE_PLAYER_ID = PLAYER_IDS.suspended;

export function mockBalanceAlwaysFailsFor(playerId: string): boolean {
  return playerId === BALANCE_UNREADABLE_PLAYER_ID;
}

/**
 * A stable balance per player, in MINOR units as a string.
 *
 * Derived from the id rather than random so a demo looks the same on every reload and a test can
 * assert an exact figure. `newcomer` is deliberately 0 — a genuinely empty account, which must
 * render as `0` and is the case that would be indistinguishable from a failed read if the failure
 * were ever allowed to show a number.
 */
export function mockBalanceMinorFor(playerId: string): string {
  if (playerId === PLAYER_IDS.newcomer) return '0';
  const digits = playerId.replace(/\D/g, '').slice(-5);
  return String(1_000_00 + Number(digits || '0'));
}

export const METHOD_IDS = {
  bank: uuid(1, 'cccccccc'),
  wallet: uuid(2, 'cccccccc'),
  cash: uuid(3, 'cccccccc'),
  retired: uuid(4, 'cccccccc'),
  usdtTrc20: uuid(5, 'cccccccc'),
  usdtBep20: uuid(6, 'cccccccc'),
} as const;

export const DESTINATION_IDS = {
  bankPrimary: uuid(1, 'dddddddd'),
  bankSecondary: uuid(2, 'dddddddd'),
  walletMain: uuid(3, 'dddddddd'),
  walletRetired: uuid(4, 'dddddddd'),
  usdtTrc20Placeholder: uuid(5, 'dddddddd'),
  usdtBep20Placeholder: uuid(6, 'dddddddd'),
} as const;

export const DEPOSIT_IDS = {
  awaitingReview: uuid(1, 'eeeeeeee'),
  duplicateProof: uuid(2, 'eeeeeeee'),
  underReviewByMe: uuid(3, 'eeeeeeee'),
  claimedByOther: uuid(4, 'eeeeeeee'),
  secondApproval: uuid(5, 'eeeeeeee'),
  creditFailed: uuid(6, 'eeeeeeee'),
  needsReconciliation: uuid(7, 'eeeeeeee'),
  credited: uuid(8, 'eeeeeeee'),
  rejected: uuid(9, 'eeeeeeee'),
  largeUnclaimed: uuid(10, 'eeeeeeee'),
} as const;

export const BREAK_IDS = {
  floatMismatch: uuid(1, 'ffffffff'),
  missingCredit: uuid(2, 'ffffffff'),
  stuckDeposit: uuid(3, 'ffffffff'),
  duplicateCredit: uuid(4, 'ffffffff'),
  resolved: uuid(5, 'ffffffff'),
} as const;

export const TENANT_IDS = {
  zero: TENANT_ZERO_ID,
  second: uuid(2, '11111111'),
  suspended: uuid(3, '11111111'),
} as const;

export const LIMIT_IDS = {
  reviewerCurrent: uuid(1, '22222222'),
  reviewerPrevious: uuid(2, '22222222'),
  financeCurrent: uuid(3, '22222222'),
} as const;

// ── Admins ─────────────────────────────────────────────────────────────────────────────────────

export const mockAdmins: AdminUser[] = [
  {
    id: ADMIN_IDS.superAdmin,
    telegramUserId: '700000001',
    username: 'nour_ops',
    displayName: 'Nour Haddad',
    role: 'SUPER_ADMIN',
    isActive: true,
    lastLoginAt: minutesAgo(12),
    createdAt: minutesAgo(60 * 24 * 220),
  },
  {
    id: ADMIN_IDS.financeAdmin,
    telegramUserId: '700000002',
    username: 'sami_finance',
    displayName: 'Sami Aziz',
    role: 'FINANCE_ADMIN',
    isActive: true,
    lastLoginAt: minutesAgo(41),
    createdAt: minutesAgo(60 * 24 * 180),
  },
  {
    id: ADMIN_IDS.reviewer,
    telegramUserId: '700000003',
    username: 'lina_review',
    displayName: 'Lina Farah',
    role: 'REVIEWER',
    isActive: true,
    lastLoginAt: minutesAgo(4),
    createdAt: minutesAgo(60 * 24 * 90),
  },
  {
    id: ADMIN_IDS.support,
    telegramUserId: '700000004',
    username: null,
    displayName: 'Omar Support',
    role: 'SUPPORT',
    isActive: true,
    lastLoginAt: minutesAgo(60 * 30),
    createdAt: minutesAgo(60 * 24 * 45),
  },
  {
    id: ADMIN_IDS.viewer,
    telegramUserId: '700000005',
    username: 'audit_bot',
    displayName: 'Audit Read-only',
    role: 'VIEWER',
    isActive: true,
    lastLoginAt: null,
    createdAt: minutesAgo(60 * 24 * 30),
  },
  {
    id: ADMIN_IDS.platformAdmin,
    telegramUserId: '700000006',
    username: 'platform',
    displayName: 'Platform Operations',
    role: 'PLATFORM_ADMIN',
    isActive: true,
    lastLoginAt: minutesAgo(60 * 5),
    createdAt: minutesAgo(60 * 24 * 400),
  },
  {
    id: ADMIN_IDS.deactivated,
    telegramUserId: '700000007',
    username: 'former_staff',
    displayName: 'Rami (left)',
    role: 'REVIEWER',
    isActive: false,
    lastLoginAt: minutesAgo(60 * 24 * 70),
    createdAt: minutesAgo(60 * 24 * 300),
  },
];

export const mockApprovalLimits: ApprovalLimit[] = [
  {
    id: LIMIT_IDS.reviewerCurrent,
    adminUserId: ADMIN_IDS.reviewer,
    currencyCode: MOCK_CURRENCY,
    maxSingleApproval: '500000.00',
    maxDailyApproval: '2000000.00',
    secondApprovalAbove: '300000.00',
    effectiveFrom: minutesAgo(60 * 24 * 20),
    effectiveTo: null,
    createdAt: minutesAgo(60 * 24 * 20),
  },
  {
    id: LIMIT_IDS.reviewerPrevious,
    adminUserId: ADMIN_IDS.reviewer,
    currencyCode: MOCK_CURRENCY,
    maxSingleApproval: '200000.00',
    maxDailyApproval: '800000.00',
    secondApprovalAbove: null,
    effectiveFrom: minutesAgo(60 * 24 * 90),
    effectiveTo: minutesAgo(60 * 24 * 20),
    createdAt: minutesAgo(60 * 24 * 90),
  },
  {
    id: LIMIT_IDS.financeCurrent,
    adminUserId: ADMIN_IDS.financeAdmin,
    currencyCode: MOCK_CURRENCY,
    maxSingleApproval: '5000000.00',
    maxDailyApproval: '25000000.00',
    secondApprovalAbove: '2000000.00',
    effectiveFrom: minutesAgo(60 * 24 * 150),
    effectiveTo: null,
    createdAt: minutesAgo(60 * 24 * 150),
  },
];

// ── Players ────────────────────────────────────────────────────────────────────────────────────

export const mockPlayers: AdminPlayer[] = [
  {
    id: PLAYER_IDS.linkedActive,
    telegramUserId: '512340001',
    telegramUsername: 'karim_play',
    firstName: 'Karim',
    lastName: 'Nasser',
    languageCode: 'ar',
    status: 'ACTIVE',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: true,
    createdAt: minutesAgo(60 * 24 * 40),
    lastSeenAt: minutesAgo(6),
    ichancyPlayerId: '99001',
    ichancyLogin: 'tg512340001',
    ichancyRegisteredAt: minutesAgo(60 * 24 * 40),
    phone: '+963900000001',
  },
  {
    id: PLAYER_IDS.pendingLink,
    telegramUserId: '512340002',
    telegramUsername: null,
    firstName: 'Maya',
    lastName: null,
    languageCode: 'ar',
    status: 'PENDING_ICHANCY',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: false,
    createdAt: minutesAgo(90),
    lastSeenAt: minutesAgo(22),
    ichancyPlayerId: null,
    ichancyLogin: null,
    ichancyRegisteredAt: null,
    phone: null,
  },
  {
    id: PLAYER_IDS.suspended,
    telegramUserId: '512340003',
    telegramUsername: 'blocked_user',
    firstName: 'Fadi',
    lastName: 'Rahal',
    languageCode: 'en',
    status: 'SUSPENDED',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: true,
    createdAt: minutesAgo(60 * 24 * 120),
    lastSeenAt: minutesAgo(60 * 24 * 3),
    ichancyPlayerId: '99003',
    ichancyLogin: 'tg512340003',
    ichancyRegisteredAt: minutesAgo(60 * 24 * 119),
    phone: '+963900000003',
  },
  {
    id: PLAYER_IDS.selfExcluded,
    telegramUserId: '512340004',
    telegramUsername: 'takingabreak',
    firstName: 'Hala',
    lastName: 'Saad',
    languageCode: 'ar',
    status: 'SELF_EXCLUDED',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: true,
    createdAt: minutesAgo(60 * 24 * 200),
    lastSeenAt: minutesAgo(60 * 24 * 14),
    ichancyPlayerId: '99004',
    ichancyLogin: 'tg512340004',
    ichancyRegisteredAt: minutesAgo(60 * 24 * 199),
    phone: null,
  },
  {
    id: PLAYER_IDS.newcomer,
    telegramUserId: '512340005',
    telegramUsername: 'first_time',
    firstName: 'Ziad',
    lastName: 'Mansour',
    languageCode: 'ar',
    status: 'ACTIVE',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: true,
    createdAt: minutesAgo(55),
    lastSeenAt: minutesAgo(2),
    ichancyPlayerId: '99005',
    ichancyLogin: 'tg512340005',
    ichancyRegisteredAt: minutesAgo(54),
    phone: '+963900000005',
  },
  {
    id: PLAYER_IDS.closed,
    telegramUserId: '512340006',
    telegramUsername: null,
    firstName: 'Old',
    lastName: 'Account',
    languageCode: null,
    status: 'CLOSED',
    currencyCode: MOCK_CURRENCY,
    ichancyLinked: false,
    createdAt: minutesAgo(60 * 24 * 500),
    lastSeenAt: minutesAgo(60 * 24 * 400),
    ichancyPlayerId: null,
    ichancyLogin: null,
    ichancyRegisteredAt: null,
    phone: null,
  },
];

/**
 * What Ichancy holds for each player, in minor units, keyed by player id.
 *
 * Strings rather than bigints: the mock state is cloned through JSON on every reset and a bigint
 * does not survive that. Players with no Ichancy account are ABSENT rather than zero — no account
 * is a different answer from an empty one, and the debit endpoint has to tell them apart.
 */
export const mockPlayerBalances: Record<string, string> = {
  [PLAYER_IDS.linkedActive]: '320000',
  [PLAYER_IDS.suspended]: '1500000',
  [PLAYER_IDS.selfExcluded]: '875025',
  [PLAYER_IDS.newcomer]: '25000',
};

/**
 * The one player whose debit Ichancy will not answer for.
 *
 * A self-excluded player is exactly who gets debited in real life — the operator pulls the
 * remaining chips back and settles in cash — so that is the fixture carrying the ending nobody
 * wants: a call that times out, a balance re-read that proves nothing, and a row a human has to go
 * and check by hand. Without it the console only ever gets built against the happy path.
 */
export const MOCK_DEBIT_TIMEOUT_PLAYER_ID: string = PLAYER_IDS.selfExcluded;

// ── Payment methods ────────────────────────────────────────────────────────────────────────────

export const mockPaymentMethods: PaymentMethod[] = [
  {
    id: METHOD_IDS.bank,
    code: 'BANK_SYR',
    displayName: 'Bank transfer',
    rail: 'BANK_TRANSFER',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'MANUAL_PROOF',
    minAmount: '50000.00',
    maxAmount: '5000000.00',
    feeFixed: '0.00',
    feeBps: 0,
    requiresReference: true,
    requiresProof: true,
    referencePattern: '^[0-9]{6,20}$',
    instructions: 'Transfer to the account shown, then upload the receipt from your banking app.',
    isActive: true,
    sortOrder: 1,
    createdAt: minutesAgo(60 * 24 * 300),
    updatedAt: minutesAgo(60 * 24 * 20),
    requiredProofFields: [],
  },
  {
    id: METHOD_IDS.wallet,
    code: 'MOBILE_WALLET',
    displayName: 'Mobile wallet',
    rail: 'MOBILE_WALLET',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'REFERENCE_MATCH',
    minAmount: '10000.00',
    maxAmount: '1000000.00',
    feeFixed: '500.00',
    feeBps: 150,
    requiresReference: true,
    requiresProof: true,
    referencePattern: null,
    instructions: 'Send to the wallet number, then paste the transaction reference.',
    isActive: true,
    sortOrder: 2,
    createdAt: minutesAgo(60 * 24 * 200),
    updatedAt: minutesAgo(60 * 24 * 5),
    requiredProofFields: [],
  },
  {
    id: METHOD_IDS.cash,
    code: 'CASH_OFFICE',
    displayName: 'Cash office',
    rail: 'CASH_OFFICE',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'MANUAL_PROOF',
    minAmount: '20000.00',
    maxAmount: '2000000.00',
    feeFixed: '0.00',
    feeBps: 0,
    requiresReference: false,
    requiresProof: true,
    referencePattern: null,
    instructions: 'Pay at any listed office and photograph the stamped slip.',
    isActive: true,
    sortOrder: 3,
    createdAt: minutesAgo(60 * 24 * 100),
    updatedAt: minutesAgo(60 * 24 * 100),
    requiredProofFields: [],
  },
  {
    id: METHOD_IDS.retired,
    code: 'OLD_CRYPTO',
    displayName: 'Crypto (retired)',
    rail: 'CRYPTO',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'NONE',
    minAmount: '100000.00',
    maxAmount: '10000000.00',
    feeFixed: '0.00',
    feeBps: 0,
    requiresReference: false,
    requiresProof: true,
    referencePattern: null,
    instructions: null,
    isActive: false,
    sortOrder: 9,
    createdAt: minutesAgo(60 * 24 * 400),
    updatedAt: minutesAgo(60 * 24 * 60),
    requiredProofFields: [],
  },
  /*
   * ── THE TWO USDT RAILS, EXACTLY AS A NEW OPERATOR RECEIVES THEM ──────────────────────────────
   * APPENDED, never inserted: several tests reach for `mockPaymentMethods[0]` and friends, and a
   * fixture that renumbered itself would break them for no reason anybody could see.
   *
   * They mirror `provisionDefaultPaymentMethods` on the backend, down to the two things that make
   * the financial screen worth having: the rail arrives INACTIVE, because a rail that cannot be
   * priced must not be on the menu, and it arrives with an ACTIVE placeholder destination — which
   * is what makes an unconfigured rail look configured. Without these the demo had no USDT rail at
   * all, so the screen an operator was told to look for showed them nothing to find.
   */
  {
    id: METHOD_IDS.usdtTrc20,
    code: 'USDT_TRC20',
    displayName: 'USDT — TRC20 (Tron)',
    rail: 'CRYPTO',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'MANUAL_PROOF',
    minAmount: '25000.00',
    maxAmount: '5000000.00',
    feeFixed: '0.00',
    feeBps: 0,
    // The attribution mechanism, not a convenience: every player pays into the same wallet, so the
    // transaction hash is the only thing tying an incoming transfer to whoever sent it.
    requiresReference: true,
    requiresProof: true,
    referencePattern: '^[A-Fa-f0-9]{64}$',
    instructions:
      'أرسل USDT على شبكة TRC20 فقط إلى العنوان الظاهر، ثم أرسل رقم العملية (hash) هنا.',
    isActive: false,
    sortOrder: 5,
    createdAt: minutesAgo(60 * 24 * 30),
    updatedAt: minutesAgo(60 * 24 * 30),
    requiredProofFields: [],
  },
  {
    id: METHOD_IDS.usdtBep20,
    code: 'USDT_BEP20',
    displayName: 'USDT — BEP20 (BNB Smart Chain)',
    rail: 'CRYPTO',
    currencyCode: MOCK_CURRENCY,
    verificationMode: 'MANUAL_PROOF',
    minAmount: '25000.00',
    maxAmount: '5000000.00',
    feeFixed: '0.00',
    feeBps: 0,
    requiresReference: true,
    requiresProof: true,
    referencePattern: '^0x[A-Fa-f0-9]{64}$',
    instructions:
      'أرسل USDT على شبكة BEP20 فقط إلى العنوان الظاهر، ثم أرسل رقم العملية (hash) هنا.',
    isActive: false,
    sortOrder: 6,
    createdAt: minutesAgo(60 * 24 * 30),
    updatedAt: minutesAgo(60 * 24 * 30),
    requiredProofFields: [],
  },
];

/** No hand-typed balance recorded — the default for every account until an operator sets one. */
const noDeclaredBalance = {
  declaredBalance: null,
  declaredBalanceMinor: null,
  declaredBalanceCurrency: null,
  declaredBalanceUpdatedAt: null,
  declaredBalanceSetByAdminId: null,
} as const;

export const mockDestinations: PaymentDestination[] = [
  {
    id: DESTINATION_IDS.bankPrimary,
    ...noDeclaredBalance,
    paymentMethodId: METHOD_IDS.bank,
    label: 'Main branch account',
    accountIdentifier: 'SY84 0000 0000 0001 2345',
    accountHolder: 'Cashier Holdings LLC',
    notes: 'Use for amounts above 500,000.',
    isActive: true,
    priority: 1,
    dailyCap: '20000000.00',
    createdAt: minutesAgo(60 * 24 * 300),
    updatedAt: minutesAgo(60 * 24 * 10),
  },
  {
    id: DESTINATION_IDS.bankSecondary,
    ...noDeclaredBalance,
    paymentMethodId: METHOD_IDS.bank,
    label: 'Overflow account',
    accountIdentifier: 'SY84 0000 0000 0009 8765',
    accountHolder: 'Cashier Holdings LLC',
    notes: null,
    isActive: true,
    priority: 2,
    dailyCap: '5000000.00',
    createdAt: minutesAgo(60 * 24 * 150),
    updatedAt: minutesAgo(60 * 24 * 150),
  },
  {
    id: DESTINATION_IDS.walletMain,
    ...noDeclaredBalance,
    declaredBalance: '200.00',
    declaredBalanceMinor: '20000',
    declaredBalanceCurrency: 'USD',
    declaredBalanceUpdatedAt: minutesAgo(180),
    declaredBalanceSetByAdminId: 'mock-admin',
    paymentMethodId: METHOD_IDS.wallet,
    label: 'Primary wallet',
    accountIdentifier: '0999-000-111',
    accountHolder: null,
    notes: null,
    isActive: true,
    priority: 1,
    dailyCap: null,
    createdAt: minutesAgo(60 * 24 * 200),
    updatedAt: minutesAgo(60 * 24 * 200),
  },
  {
    id: DESTINATION_IDS.walletRetired,
    ...noDeclaredBalance,
    paymentMethodId: METHOD_IDS.wallet,
    label: 'Old wallet (closed)',
    accountIdentifier: '0999-000-222',
    accountHolder: null,
    notes: 'Closed by the provider in March.',
    isActive: false,
    priority: 5,
    dailyCap: null,
    createdAt: minutesAgo(60 * 24 * 250),
    updatedAt: minutesAgo(60 * 24 * 30),
  },
  /*
   * The seeded placeholders — the state every operator actually starts in, and the reason the
   * financial screen exists. Active, priority 0, holder "REPLACE ME": the rotation hands them out
   * ahead of anything an operator adds later, and the string they name is not a wallet.
   */
  {
    id: DESTINATION_IDS.usdtTrc20Placeholder,
    ...noDeclaredBalance,
    paymentMethodId: METHOD_IDS.usdtTrc20,
    label: 'USDT TRC20',
    accountIdentifier: 'SEED-PLACEHOLDER-USDT-TRC20-0000',
    accountHolder: 'REPLACE ME',
    notes: 'Created automatically. Replace with a real account before taking deposits.',
    isActive: true,
    priority: 0,
    dailyCap: null,
    createdAt: minutesAgo(60 * 24 * 30),
    updatedAt: minutesAgo(60 * 24 * 30),
  },
  {
    id: DESTINATION_IDS.usdtBep20Placeholder,
    ...noDeclaredBalance,
    paymentMethodId: METHOD_IDS.usdtBep20,
    label: 'USDT BEP20',
    accountIdentifier: 'SEED-PLACEHOLDER-USDT-BEP20-0000',
    accountHolder: 'REPLACE ME',
    notes: 'Created automatically. Replace with a real account before taking deposits.',
    isActive: true,
    priority: 0,
    dailyCap: null,
    createdAt: minutesAgo(60 * 24 * 30),
    updatedAt: minutesAgo(60 * 24 * 30),
  },
];

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

const bankDestination = {
  methodCode: 'BANK_SYR',
  methodName: 'Bank transfer',
  instructions: 'Transfer to the account shown, then upload the receipt.',
  requiresReference: true,
  label: 'Main branch account',
  accountIdentifier: 'SY84 0000 0000 0001 2345',
  accountHolder: 'Cashier Holdings LLC',
};

const walletDestination = {
  methodCode: 'MOBILE_WALLET',
  methodName: 'Mobile wallet',
  instructions: 'Send to the wallet number, then paste the reference.',
  requiresReference: true,
  label: 'Primary wallet',
  accountIdentifier: '0999-000-111',
  accountHolder: null,
};

const proof = (id: string, minutes: number, sha: string) => ({
  id,
  source: 'TELEGRAM_PHOTO',
  mimeType: 'image/jpeg',
  sizeBytes: 284_913,
  sha256: sha,
  width: 1080,
  height: 1920,
  createdAt: minutesAgo(minutes),
});

export const mockDeposits: AdminDeposit[] = [
  {
    id: DEPOSIT_IDS.awaitingReview,
    shortId: 'K7QP42',
    status: 'SUBMITTED',
    claimed: money(15_000_00n),
    verified: null,
    credited: null,
    fee: money(0n),
    externalReference: '884512309',
    senderAccount: 'Karim Nasser',
    proofCount: 1,
    createdAt: minutesAgo(4),
    expiresAt: minutesAhead(26),
    submittedAt: minutesAgo(3),
    decidedAt: null,
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.linkedActive,
    playerTelegramUserId: '512340001',
    playerTelegramUsername: 'karim_play',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: null,
    decidedByAdminId: null,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: [],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(1, '33333333'),
        3,
        'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef0123456789abcdef01',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.duplicateProof,
    shortId: 'M2WX88',
    status: 'SUBMITTED',
    claimed: money(75_000_00n),
    verified: null,
    credited: null,
    fee: money(0n),
    externalReference: '884512309',
    senderAccount: 'Ziad Mansour',
    proofCount: 2,
    createdAt: minutesAgo(11),
    expiresAt: minutesAhead(19),
    submittedAt: minutesAgo(9),
    decidedAt: null,
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.newcomer,
    playerTelegramUserId: '512340005',
    playerTelegramUsername: 'first_time',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: null,
    decidedByAdminId: null,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: ['DUPLICATE_PROOF_EXACT', 'REFERENCE_REUSED', 'NEW_PLAYER'],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(2, '33333333'),
        9,
        'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef0123456789abcdef01',
      ),
      proof(
        uuid(3, '33333333'),
        8,
        'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.underReviewByMe,
    shortId: 'R9TT10',
    status: 'UNDER_REVIEW',
    claimed: money(120_000_00n),
    verified: null,
    credited: null,
    fee: money(1_800_00n),
    externalReference: 'WLT-77123',
    senderAccount: '0999-555-444',
    proofCount: 1,
    createdAt: minutesAgo(19),
    expiresAt: minutesAhead(11),
    submittedAt: minutesAgo(17),
    decidedAt: null,
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: walletDestination,
    playerId: PLAYER_IDS.linkedActive,
    playerTelegramUserId: '512340001',
    playerTelegramUsername: 'karim_play',
    paymentMethodId: METHOD_IDS.wallet,
    reviewStartedAt: minutesAgo(6),
    decidedByAdminId: ADMIN_IDS.reviewer,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: ['LARGE_AMOUNT'],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(4, '33333333'),
        17,
        '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.claimedByOther,
    shortId: 'B4LM63',
    status: 'UNDER_REVIEW',
    claimed: money(45_000_00n),
    verified: null,
    credited: null,
    fee: money(0n),
    externalReference: '884512777',
    senderAccount: 'Maya',
    proofCount: 1,
    createdAt: minutesAgo(24),
    expiresAt: minutesAhead(6),
    submittedAt: minutesAgo(23),
    decidedAt: null,
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.pendingLink,
    playerTelegramUserId: '512340002',
    playerTelegramUsername: null,
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: minutesAgo(2),
    decidedByAdminId: ADMIN_IDS.financeAdmin,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: [],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(5, '33333333'),
        23,
        '0f0e0d0c0b0a09080706050403020100f0e0d0c0b0a090807060504030201000',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.secondApproval,
    shortId: 'X8ZZ01',
    status: 'PENDING_SECOND_APPROVAL',
    claimed: money(850_000_00n),
    verified: money(850_000_00n),
    credited: null,
    fee: money(0n),
    externalReference: '884599001',
    senderAccount: 'Fadi Rahal',
    proofCount: 1,
    createdAt: minutesAgo(38),
    expiresAt: null,
    submittedAt: minutesAgo(36),
    decidedAt: minutesAgo(5),
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.suspended,
    playerTelegramUserId: '512340003',
    playerTelegramUsername: 'blocked_user',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: minutesAgo(9),
    decidedByAdminId: ADMIN_IDS.reviewer,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: ['LARGE_AMOUNT'],
    requiresSecondApproval: true,
    proofs: [
      proof(
        uuid(6, '33333333'),
        36,
        'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.creditFailed,
    shortId: 'C1FF77',
    status: 'CREDIT_FAILED',
    claimed: money(60_000_00n),
    verified: money(60_000_00n),
    credited: null,
    fee: money(0n),
    externalReference: '884512400',
    senderAccount: 'Karim Nasser',
    proofCount: 1,
    createdAt: minutesAgo(95),
    expiresAt: null,
    submittedAt: minutesAgo(93),
    decidedAt: minutesAgo(74),
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.linkedActive,
    playerTelegramUserId: '512340001',
    playerTelegramUsername: 'karim_play',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: minutesAgo(80),
    decidedByAdminId: ADMIN_IDS.financeAdmin,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 3,
    creditKeyEpoch: 1,
    riskFlags: [],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(7, '33333333'),
        93,
        '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.needsReconciliation,
    shortId: 'N5RR22',
    status: 'NEEDS_RECONCILIATION',
    claimed: money(200_000_00n),
    verified: money(200_000_00n),
    credited: null,
    fee: money(0n),
    externalReference: 'WLT-77900',
    senderAccount: '0999-777-333',
    proofCount: 1,
    createdAt: minutesAgo(160),
    expiresAt: null,
    submittedAt: minutesAgo(158),
    decidedAt: minutesAgo(140),
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: walletDestination,
    playerId: PLAYER_IDS.newcomer,
    playerTelegramUserId: '512340005',
    playerTelegramUsername: 'first_time',
    paymentMethodId: METHOD_IDS.wallet,
    reviewStartedAt: minutesAgo(150),
    decidedByAdminId: ADMIN_IDS.superAdmin,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 2,
    creditKeyEpoch: 0,
    riskFlags: [],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(8, '33333333'),
        158,
        'aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.credited,
    shortId: 'D3OK55',
    status: 'CREDITED',
    claimed: money(30_000_00n),
    verified: money(30_000_00n),
    credited: money(30_000_00n),
    fee: money(0n),
    externalReference: '884511111',
    senderAccount: 'Karim Nasser',
    proofCount: 1,
    createdAt: minutesAgo(210),
    expiresAt: null,
    submittedAt: minutesAgo(208),
    decidedAt: minutesAgo(200),
    creditedAt: minutesAgo(199),
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.linkedActive,
    playerTelegramUserId: '512340001',
    playerTelegramUsername: 'karim_play',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: minutesAgo(205),
    decidedByAdminId: ADMIN_IDS.reviewer,
    secondApproverAdminId: null,
    creditVerifiedBy: 'API_OK',
    creditAttempts: 1,
    creditKeyEpoch: 0,
    riskFlags: [],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(9, '33333333'),
        208,
        '1234123412341234123412341234123412341234123412341234123412341234',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.rejected,
    shortId: 'J6NO09',
    status: 'REJECTED',
    claimed: money(25_000_00n),
    verified: null,
    credited: null,
    fee: money(0n),
    externalReference: null,
    senderAccount: null,
    proofCount: 1,
    createdAt: minutesAgo(320),
    expiresAt: null,
    submittedAt: minutesAgo(318),
    decidedAt: minutesAgo(300),
    creditedAt: null,
    rejectionCode: 'PROOF_UNREADABLE',
    rejectionNote: 'Screenshot was cropped; amount not visible.',
    destination: walletDestination,
    playerId: PLAYER_IDS.pendingLink,
    playerTelegramUserId: '512340002',
    playerTelegramUsername: null,
    paymentMethodId: METHOD_IDS.wallet,
    reviewStartedAt: minutesAgo(310),
    decidedByAdminId: ADMIN_IDS.support,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: ['PROOF_UNREADABLE'],
    requiresSecondApproval: false,
    proofs: [
      proof(
        uuid(10, '33333333'),
        318,
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ),
    ],
  },
  {
    id: DEPOSIT_IDS.largeUnclaimed,
    shortId: 'P0BB31',
    status: 'SUBMITTED',
    claimed: money(1_400_000_00n),
    verified: null,
    credited: null,
    fee: money(0n),
    externalReference: '884588888',
    senderAccount: 'Hala Saad',
    proofCount: 1,
    createdAt: minutesAgo(28),
    expiresAt: minutesAhead(2),
    submittedAt: minutesAgo(27),
    decidedAt: null,
    creditedAt: null,
    rejectionCode: null,
    rejectionNote: null,
    destination: bankDestination,
    playerId: PLAYER_IDS.selfExcluded,
    playerTelegramUserId: '512340004',
    playerTelegramUsername: 'takingabreak',
    paymentMethodId: METHOD_IDS.bank,
    reviewStartedAt: null,
    decidedByAdminId: null,
    secondApproverAdminId: null,
    creditVerifiedBy: null,
    creditAttempts: 0,
    creditKeyEpoch: 0,
    riskFlags: ['LARGE_AMOUNT'],
    requiresSecondApproval: true,
    proofs: [
      proof(
        uuid(11, '33333333'),
        27,
        'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
      ),
    ],
  },
];

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────────

const breakMoney = (minor: bigint) => ({
  minor: minor.toString(),
  amount: formatMinorToDecimal(minor),
});

export const mockBreaks: ReconciliationBreak[] = [
  {
    id: BREAK_IDS.floatMismatch,
    category: 'AGENT_FLOAT_MISMATCH',
    status: 'OPEN',
    severity: 4,
    currencyCode: MOCK_CURRENCY,
    expected: breakMoney(4_500_000_00n),
    actual: breakMoney(4_437_500_00n),
    delta: breakMoney(-62_500_00n),
    depositRequestId: null,
    playerId: null,
    ledgerAccountId: uuid(1, '44444444'),
    ichancyCallId: uuid(1, '55555555'),
    detail: { source: 'getAgentAllWallets', checkedAt: minutesAgo(30) },
    dedupeKey: 'float:NSP:2026-08-21',
    detectedAt: minutesAgo(30),
    assignedToAdminId: null,
    resolvedAt: null,
    resolvedByAdminId: null,
    resolutionNote: null,
    resolutionTxId: null,
  },
  {
    id: BREAK_IDS.missingCredit,
    category: 'MISSING_CREDIT',
    status: 'INVESTIGATING',
    severity: 5,
    currencyCode: MOCK_CURRENCY,
    expected: breakMoney(200_000_00n),
    actual: breakMoney(0n),
    delta: breakMoney(-200_000_00n),
    depositRequestId: DEPOSIT_IDS.needsReconciliation,
    playerId: PLAYER_IDS.newcomer,
    ledgerAccountId: null,
    ichancyCallId: uuid(2, '55555555'),
    detail: { note: 'depositToPlayer answered ambiguously twice; balance unchanged.' },
    dedupeKey: `credit:${DEPOSIT_IDS.needsReconciliation}`,
    detectedAt: minutesAgo(120),
    assignedToAdminId: ADMIN_IDS.financeAdmin,
    resolvedAt: null,
    resolvedByAdminId: null,
    resolutionNote: null,
    resolutionTxId: null,
  },
  {
    id: BREAK_IDS.stuckDeposit,
    category: 'STUCK_DEPOSIT',
    status: 'OPEN',
    severity: 3,
    currencyCode: MOCK_CURRENCY,
    expected: breakMoney(60_000_00n),
    actual: breakMoney(0n),
    delta: breakMoney(-60_000_00n),
    depositRequestId: DEPOSIT_IDS.creditFailed,
    playerId: PLAYER_IDS.linkedActive,
    ledgerAccountId: null,
    ichancyCallId: null,
    detail: { attempts: 3, lastError: 'REJECTED' },
    dedupeKey: `stuck:${DEPOSIT_IDS.creditFailed}`,
    detectedAt: minutesAgo(70),
    assignedToAdminId: null,
    resolvedAt: null,
    resolvedByAdminId: null,
    resolutionNote: null,
    resolutionTxId: null,
  },
  {
    id: BREAK_IDS.duplicateCredit,
    category: 'DUPLICATE_CREDIT',
    status: 'OPEN',
    severity: 5,
    currencyCode: MOCK_CURRENCY,
    expected: breakMoney(30_000_00n),
    actual: breakMoney(60_000_00n),
    delta: breakMoney(30_000_00n),
    depositRequestId: DEPOSIT_IDS.credited,
    playerId: PLAYER_IDS.linkedActive,
    ledgerAccountId: null,
    ichancyCallId: uuid(3, '55555555'),
    detail: { note: 'Two successful depositToPlayer calls with the same amount, 40s apart.' },
    dedupeKey: `dup:${DEPOSIT_IDS.credited}`,
    detectedAt: minutesAgo(190),
    assignedToAdminId: null,
    resolvedAt: null,
    resolvedByAdminId: null,
    resolutionNote: null,
    resolutionTxId: null,
  },
  {
    id: BREAK_IDS.resolved,
    category: 'UNIDENTIFIED_RECEIPT',
    status: 'RESOLVED',
    severity: 2,
    currencyCode: MOCK_CURRENCY,
    expected: null,
    actual: breakMoney(12_000_00n),
    delta: breakMoney(12_000_00n),
    depositRequestId: null,
    playerId: null,
    ledgerAccountId: uuid(2, '44444444'),
    ichancyCallId: null,
    detail: { statementLine: 'INCOMING 12000 REF 77123' },
    dedupeKey: 'unident:77123',
    detectedAt: minutesAgo(60 * 24 * 2),
    assignedToAdminId: ADMIN_IDS.financeAdmin,
    resolvedAt: minutesAgo(60 * 24),
    resolvedByAdminId: ADMIN_IDS.financeAdmin,
    resolutionNote: 'Matched to deposit D3OK55 after the player sent the correct reference.',
    resolutionTxId: uuid(1, '66666666'),
  },
];

export const mockRailAgeing = {
  generatedAt: new Date().toISOString(),
  rows: [
    {
      accountId: uuid(1, '44444444'),
      accountCode: 'RAIL_CLEARING:BANK_SYR',
      currencyCode: MOCK_CURRENCY,
      paymentMethodId: METHOD_IDS.bank,
      balanceMinor: '18500000',
      oldestUnsettledAt: minutesAgo(60 * 24 * 22),
      buckets: [
        {
          label: '0-1d',
          fromDays: 0,
          toDays: 1,
          debitMinor: '9000000',
          creditMinor: '8200000',
          netMinor: '800000',
          entryCount: 34,
        },
        {
          label: '1-3d',
          fromDays: 1,
          toDays: 3,
          debitMinor: '4000000',
          creditMinor: '3800000',
          netMinor: '200000',
          entryCount: 12,
        },
        {
          label: '3-7d',
          fromDays: 3,
          toDays: 7,
          debitMinor: '2000000',
          creditMinor: '1500000',
          netMinor: '500000',
          entryCount: 6,
        },
        {
          label: '7-30d',
          fromDays: 7,
          toDays: 30,
          debitMinor: '3500000',
          creditMinor: '1000000',
          netMinor: '2500000',
          entryCount: 4,
        },
        {
          label: '30d+',
          fromDays: 30,
          toDays: null,
          debitMinor: '1450000',
          creditMinor: '0',
          netMinor: '1450000',
          entryCount: 2,
        },
      ],
    },
    {
      accountId: uuid(3, '44444444'),
      accountCode: 'RAIL_CLEARING:MOBILE_WALLET',
      currencyCode: MOCK_CURRENCY,
      paymentMethodId: METHOD_IDS.wallet,
      balanceMinor: '250000',
      oldestUnsettledAt: minutesAgo(60 * 20),
      buckets: [
        {
          label: '0-1d',
          fromDays: 0,
          toDays: 1,
          debitMinor: '1200000',
          creditMinor: '950000',
          netMinor: '250000',
          entryCount: 18,
        },
        {
          label: '1-3d',
          fromDays: 1,
          toDays: 3,
          debitMinor: '0',
          creditMinor: '0',
          netMinor: '0',
          entryCount: 0,
        },
        {
          label: '3-7d',
          fromDays: 3,
          toDays: 7,
          debitMinor: '0',
          creditMinor: '0',
          netMinor: '0',
          entryCount: 0,
        },
        {
          label: '7-30d',
          fromDays: 7,
          toDays: 30,
          debitMinor: '0',
          creditMinor: '0',
          netMinor: '0',
          entryCount: 0,
        },
        {
          label: '30d+',
          fromDays: 30,
          toDays: null,
          debitMinor: '0',
          creditMinor: '0',
          netMinor: '0',
          entryCount: 0,
        },
      ],
    },
  ],
  staleAccountCodes: ['RAIL_CLEARING:BANK_SYR'],
};

// ── Platform defaults ──────────────────────────────────────────────────────────────────────────

/**
 * The single settings row `POST /v1/admin/tenants` resolves an omitted field against.
 *
 * The backend seeds this from the deployment's env values on first run and reads it through ONE
 * service afterwards, so tenant creation stops depending on what `.env` happened to hold at the
 * moment somebody filled in the form. The mock keeps one copy for the same reason: every default a
 * screen can see comes from here, not from a literal scattered through a handler.
 *
 * `ichancyAgentId` is nullable on purpose — it is the one value with no safe default. Ichancy
 * `signin()` answers with a token pair and nothing else, so an agent id can never be derived from
 * the credentials; the fallback chain is supplied → this row → tenant zero's → 400.
 */
export interface PlatformDefaults {
  ichancyBaseUrl: string;
  ichancyAgentId: string | null;
  currencyCode: string;
  dualApprovalThresholdMinor: string;
  agentFloatLowWatermarkMinor: string;
  depositExpiryMinutes: number;
}

export const mockPlatformDefaults: PlatformDefaults = {
  ichancyBaseUrl: 'https://agent.ichancy.example',
  ichancyAgentId: '10500',
  currencyCode: MOCK_CURRENCY,
  dualApprovalThresholdMinor: '50000000',
  agentFloatLowWatermarkMinor: '100000000',
  depositExpiryMinutes: 30,
};

// ── Tenants ────────────────────────────────────────────────────────────────────────────────────

export const mockTenants: Tenant[] = [
  {
    id: TENANT_IDS.zero,
    slug: 'tenant-zero',
    displayName: 'Main operation',
    status: 'ACTIVE',
    hasWebhookPath: true,
    adminChatId: '-1001234567890',
    feedChatId: '-1009876543210',
    botUsername: 'main_cashier_bot',
    ichancyBaseUrl: 'https://agent.ichancy.example',
    ichancyUsername: 'agent_main',
    ichancyAgentId: '10045',
    currencyCode: MOCK_CURRENCY,
    dualApprovalThresholdMinor: '50000000',
    agentFloatLowWatermarkMinor: '100000000',
    depositExpiryMinutes: 30,
    createdAt: minutesAgo(60 * 24 * 400),
    updatedAt: minutesAgo(60 * 24 * 3),
    counts: { players: 1284, deposits: 9417 },
  },
  {
    id: TENANT_IDS.second,
    slug: 'northern-branch',
    displayName: 'Northern branch',
    status: 'ACTIVE',
    hasWebhookPath: true,
    adminChatId: '-1001111111111',
    feedChatId: null,
    botUsername: 'northern_cashier_bot',
    ichancyBaseUrl: 'https://agent.ichancy.example',
    ichancyUsername: 'agent_north',
    ichancyAgentId: '10099',
    currencyCode: MOCK_CURRENCY,
    dualApprovalThresholdMinor: '30000000',
    agentFloatLowWatermarkMinor: '50000000',
    depositExpiryMinutes: 45,
    createdAt: minutesAgo(60 * 24 * 60),
    updatedAt: minutesAgo(60 * 24 * 6),
    counts: { players: 312, deposits: 1188 },
  },
  {
    id: TENANT_IDS.suspended,
    slug: 'pilot-operator',
    displayName: 'Pilot operator',
    status: 'SUSPENDED',
    hasWebhookPath: true,
    adminChatId: '-1002222222222',
    feedChatId: null,
    botUsername: null,
    ichancyBaseUrl: 'https://agent.ichancy.example',
    ichancyUsername: 'agent_pilot',
    ichancyAgentId: '10123',
    currencyCode: MOCK_CURRENCY,
    dualApprovalThresholdMinor: '10000000',
    agentFloatLowWatermarkMinor: '20000000',
    depositExpiryMinutes: 30,
    createdAt: minutesAgo(60 * 24 * 2),
    updatedAt: minutesAgo(60 * 24 * 2),
    counts: { players: 0, deposits: 0 },
  },
];

// ── Platform finance overview ──────────────────────────────────────────────────────────────────

/**
 * The seed behind `GET /v1/admin/finance/balances`, and the whole reason each cell carries a status.
 *
 * It is DELIBERATELY a book with holes in it, because the one rule this screen exists for — a failed
 * read must never render as `0` — can only be proved by data that fails. Between the three operators
 * every non-ok state is on screen the moment the page opens: an agent float that is UNAVAILABLE (a
 * suspended operator whose Ichancy agent does not answer), a USDT wallet that is UNAVAILABLE (its
 * chain node down), a Sham Cash session that is EXPIRED and one that is NOT_LINKED, and one operator
 * whose expensive columns are ENTIRELY NOT_LOADED — the un-fetched state a Refresh fills in.
 *
 * Northern branch's float is genuinely low (below its watermark) rather than unreadable: `isLow`
 * with a real figure is a different claim from `unavailable`, and both have to be visible.
 */

/** USDT carries six decimals on both chains — the scale the wallet figures are rendered at. */
const USDT_MINOR_SCALE = 6;

const usdtWalletOk = (label: string, network: string, minor: string, checkedAt: string) => ({
  status: 'ok' as const,
  label,
  network,
  balanceMinor: minor,
  balance: formatMinorToDecimal(BigInt(minor), USDT_MINOR_SCALE),
  checkedAt,
});

/** A well-formed wallet whose chain node did not answer: unknown, never zero. */
const usdtWalletUnavailable = (label: string, network: string, checkedAt: string) => ({
  status: 'unavailable' as const,
  label,
  network,
  problem: 'CHAIN_NODE_UNAVAILABLE',
  detail: `The ${network} node did not answer in time, so what this wallet holds is unknown — not zero.`,
  checkedAt,
});

/** The USDT column an operator's rails read once loaded, with one healthy wallet. */
export const mockLoadedUsdt = (checkedAt: string) => ({
  status: 'loaded' as const,
  checkedAt,
  wallets: [usdtWalletOk('USDT TRC20', 'TRC20', '12500000000', checkedAt)],
});

/** A plausible Sham Cash read: SYP holds funds, and the last two transfers are the +/-10 test moves. */
export const mockShamCashOk = (checkedAt: string) => ({
  status: 'ok' as const,
  balances: [
    { currency: 'SYP' as const, available: '250,000', locked: '10,000' },
    { currency: 'USD' as const, available: '0', locked: '0' },
    { currency: 'EUR' as const, available: '0', locked: '0' },
  ],
  transactions: [
    {
      transactionId: '100000001',
      date: '2026-08-26 - 16:10:31',
      amount: '10',
      currency: 'SYP',
      direction: 'out' as const,
      username: 'Counterparty One',
      maskedCard: '**** **** **** 0000',
    },
    {
      transactionId: '100000002',
      date: '2026-08-26 - 16:08:45',
      amount: '10',
      currency: 'SYP',
      direction: 'in' as const,
      username: 'Counterparty Two',
      maskedCard: '**** **** **** 1111',
    },
  ],
  checkedAt,
});

/** Fresh finance rows for the three mock operators. A function, so each seed gets its own objects. */
export const mockTenantFinance = (): TenantFinanceRow[] => [
  {
    tenantId: TENANT_IDS.zero,
    slug: 'tenant-zero',
    agentFloat: {
      status: 'ok',
      currencyCode: MOCK_CURRENCY,
      balanceMinor: '443750000',
      balance: '4437500.00',
      lowWatermarkMinor: '100000000',
      isLow: false,
      checkedAt: minutesAgo(2),
    },
    usdt: {
      status: 'loaded',
      checkedAt: minutesAgo(3),
      wallets: [
        usdtWalletOk('USDT TRC20', 'TRC20', '12500000000', minutesAgo(3)),
        usdtWalletUnavailable('USDT BEP20', 'BEP20', minutesAgo(3)),
      ],
    },
    // Linked externally elsewhere, but no Sham Cash session on this operator.
    shamCash: { status: 'not_linked' },
  },
  {
    tenantId: TENANT_IDS.second,
    slug: 'northern-branch',
    agentFloat: {
      status: 'ok',
      currencyCode: MOCK_CURRENCY,
      // Below its own 500,000.00 watermark: a real, low figure — not an outage.
      balanceMinor: '38000000',
      balance: '380000.00',
      lowWatermarkMinor: '50000000',
      isLow: true,
      checkedAt: minutesAgo(4),
    },
    usdt: mockLoadedUsdt(minutesAgo(4)),
    shamCash: { status: 'expired' },
  },
  {
    tenantId: TENANT_IDS.suspended,
    slug: 'pilot-operator',
    // The agent does not answer — the same reason this operator sits SUSPENDED. Never a zero float.
    agentFloat: {
      status: 'unavailable',
      detail: 'Ichancy sign-in failed for agent_pilot: the agent did not answer (504 after 15s).',
    },
    // Never fetched: the expensive columns start here and a Refresh fills them in.
    usdt: { status: 'not_loaded' },
    shamCash: { status: 'not_loaded' },
  },
];

/**
 * Where the demo operator's bot publishes.
 *
 * THREE ROWS, ONE PER STATE THE SCREEN HAS TO RENDER DIFFERENTLY, because a fixture set where
 * everything is healthy proves only that the happy path draws:
 *   1. a working supergroup — verified recently, publishing;
 *   2. a channel that has never been verified since it was bound (a state, not an error);
 *   3. a group the bot has been removed from — `lastError` set, which is the row the whole screen
 *      exists to make visible, and which looks identical to a healthy one in every other column.
 */
export const mockTelegramDestinations: TelegramDestination[] = [
  {
    id: 'a1f0c2d3-0000-4000-8000-000000000001',
    chatId: '-1001234567890',
    chatType: 'SUPERGROUP',
    telegramUrl: 'https://t.me/cashier_ops',
    title: 'Cashier ops',
    username: 'cashier_ops',
    displayName: null,
    categories: ['DEPOSIT', 'WITHDRAWAL', 'NEW_PLAYER', 'SYSTEM_ALERT'],
    isActive: true,
    lastVerifiedAt: minutesAgo(20),
    lastError: null,
    lastPublishedAt: minutesAgo(6),
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: minutesAgo(6),
  },
  {
    id: 'a1f0c2d3-0000-4000-8000-000000000002',
    chatId: '-1009876543210',
    chatType: 'CHANNEL',
    telegramUrl: 'https://t.me/cashier_reports',
    title: 'Cashier reports',
    username: 'cashier_reports',
    displayName: 'Daily reports',
    categories: ['REPORT'],
    isActive: true,
    lastVerifiedAt: null,
    lastError: null,
    lastPublishedAt: null,
    createdAt: '2026-08-20T11:30:00.000Z',
    updatedAt: '2026-08-20T11:30:00.000Z',
  },
  {
    id: 'a1f0c2d3-0000-4000-8000-000000000003',
    chatId: '-1005555000111',
    chatType: 'GROUP',
    telegramUrl: null,
    title: 'Old finance group',
    username: null,
    displayName: null,
    categories: ['DEPOSIT'],
    isActive: true,
    lastVerifiedAt: '2026-08-10T08:00:00.000Z',
    // Telegram's own words, verbatim — never our paraphrase.
    lastError: 'Forbidden: bot was kicked from the group chat',
    lastPublishedAt: '2026-08-10T08:00:00.000Z',
    createdAt: '2026-07-15T07:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
  },
];

/**
 * The chats the demo operator's bot has been added to — the pick-list.
 *
 * FOUR ROWS, one per situation the picker renders differently, and the FIRST is the whole reason
 * this feature exists:
 *   1. a PRIVATE supergroup — no username at all, so there is no link an operator could paste and
 *      no way to bind it except from this list;
 *   2. a public group already bound as a destination, which must be marked rather than offered;
 *   3. a group where the bot is only a member — bindable, and annotated with what to fix;
 *   4. a channel the bot was removed from, kept rather than hidden because "the bot was kicked" is
 *      the answer to the question the operator is about to ask.
 */
export const mockDiscoveredChats: DiscoveredChat[] = [
  {
    chatId: '-1002233445566',
    chatType: 'SUPERGROUP',
    title: 'Night shift (private)',
    // The point of the fixture: nothing to paste, nothing to resolve, only this row.
    username: null,
    status: 'ADMINISTRATOR',
    isAdministrator: true,
    isPresent: true,
    canPost: true,
    alreadyBound: false,
    firstSeenAt: '2026-08-28T12:00:00.000Z',
    lastSeenAt: minutesAgo(12),
  },
  {
    chatId: '-1001234567890',
    chatType: 'SUPERGROUP',
    title: 'Cashier ops',
    username: 'cashier_ops',
    status: 'ADMINISTRATOR',
    isAdministrator: true,
    isPresent: true,
    canPost: true,
    // Matches mockTelegramDestinations[0]; the handler recomputes this, the value is the default.
    alreadyBound: true,
    firstSeenAt: '2026-08-01T08:55:00.000Z',
    lastSeenAt: minutesAgo(40),
  },
  {
    chatId: '-1007788990011',
    chatType: 'GROUP',
    title: 'Support escalations',
    username: null,
    status: 'MEMBER',
    isAdministrator: false,
    isPresent: true,
    canPost: true,
    alreadyBound: false,
    firstSeenAt: '2026-08-25T15:20:00.000Z',
    lastSeenAt: '2026-08-25T15:20:00.000Z',
  },
  {
    chatId: '-1005555000111',
    chatType: 'CHANNEL',
    title: 'Old finance group',
    username: null,
    status: 'KICKED',
    isAdministrator: false,
    isPresent: false,
    canPost: false,
    alreadyBound: false,
    firstSeenAt: '2026-07-15T06:55:00.000Z',
    lastSeenAt: '2026-08-10T08:00:00.000Z',
  },
];

export { MOCK_LOGIN_CODE, MOCK_SESSION_TTL_MINUTES } from './demo';
