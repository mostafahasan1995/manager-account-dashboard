import { z } from 'zod';

/**
 * Every enum the backend can send, kept in one place with its display label and its semantic tone.
 *
 * The literal arrays are the single source of truth: the zod schemas, the TypeScript unions and the
 * filter dropdowns are all derived from them, so adding a status to the backend is a one-line change
 * here that the compiler then chases through every screen that switches on it.
 */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

// ── Admin roles ────────────────────────────────────────────────────────────────────────────────

export const ADMIN_ROLES = [
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
  'REVIEWER',
  'SUPPORT',
  'VIEWER',
] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLES);
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  PLATFORM_ADMIN: 'Platform admin',
  SUPER_ADMIN: 'Super admin',
  FINANCE_ADMIN: 'Finance admin',
  REVIEWER: 'Reviewer',
  SUPPORT: 'Support',
  VIEWER: 'Viewer',
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  PLATFORM_ADMIN:
    'Runs the platform: creates, configures and suspends tenants. Sees no tenant data.',
  SUPER_ADMIN: 'Top of one tenant. Everything inside it, including staff and approval limits.',
  FINANCE_ADMIN: 'Decides deposits, manages payment rails, and works reconciliation breaks.',
  REVIEWER: 'Reviews and decides deposits. Cannot change rails or staff.',
  SUPPORT: 'Reads players, deposits and rails to answer questions. Decides nothing.',
  VIEWER: 'Read-only on the deposit queue and reconciliation.',
};

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

export const DEPOSIT_STATUSES = [
  'DRAFT',
  'AWAITING_PROOF',
  'SUBMITTED',
  'UNDER_REVIEW',
  'PENDING_SECOND_APPROVAL',
  'APPROVED',
  'CREDITING',
  'CREDITED',
  'CREDIT_FAILED',
  'NEEDS_RECONCILIATION',
  'REJECTED',
  'EXPIRED',
  'REVERSED',
] as const;
export const depositStatusSchema = z.enum(DEPOSIT_STATUSES);
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/** What the backend's REVIEWABLE_STATUSES means for the queue's default filter. */
export const REVIEWABLE_DEPOSIT_STATUSES: readonly DepositStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'PENDING_SECOND_APPROVAL',
];

/** Statuses that mean money is stuck and somebody has to look. */
export const ATTENTION_DEPOSIT_STATUSES: readonly DepositStatus[] = [
  'CREDIT_FAILED',
  'NEEDS_RECONCILIATION',
];

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_PROOF: 'Awaiting proof',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  PENDING_SECOND_APPROVAL: 'Second approval',
  APPROVED: 'Approved',
  CREDITING: 'Crediting',
  CREDITED: 'Credited',
  CREDIT_FAILED: 'Credit failed',
  NEEDS_RECONCILIATION: 'Needs reconciliation',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  REVERSED: 'Reversed',
};

export const DEPOSIT_STATUS_TONES: Record<DepositStatus, Tone> = {
  DRAFT: 'muted',
  AWAITING_PROOF: 'muted',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  PENDING_SECOND_APPROVAL: 'warning',
  APPROVED: 'info',
  CREDITING: 'info',
  CREDITED: 'success',
  CREDIT_FAILED: 'danger',
  NEEDS_RECONCILIATION: 'danger',
  REJECTED: 'neutral',
  EXPIRED: 'muted',
  REVERSED: 'neutral',
};

export const REJECTION_CODES = [
  'DUPLICATE_PROOF',
  'PROOF_UNREADABLE',
  'PROOF_MISSING',
  'AMOUNT_MISMATCH',
  'REFERENCE_NOT_FOUND',
  'WRONG_DESTINATION',
  'SENDER_MISMATCH',
  'SUSPECTED_FRAUD',
  'LIMIT_EXCEEDED',
  'PLAYER_INELIGIBLE',
  'EXPIRED',
  'OTHER',
] as const;
export const rejectionCodeSchema = z.enum(REJECTION_CODES);
export type RejectionCode = (typeof REJECTION_CODES)[number];

export const REJECTION_CODE_LABELS: Record<RejectionCode, string> = {
  DUPLICATE_PROOF: 'Duplicate proof',
  PROOF_UNREADABLE: 'Proof unreadable',
  PROOF_MISSING: 'Proof missing',
  AMOUNT_MISMATCH: 'Amount mismatch',
  REFERENCE_NOT_FOUND: 'Reference not found',
  WRONG_DESTINATION: 'Wrong destination',
  SENDER_MISMATCH: 'Sender mismatch',
  SUSPECTED_FRAUD: 'Suspected fraud',
  LIMIT_EXCEEDED: 'Limit exceeded',
  PLAYER_INELIGIBLE: 'Player ineligible',
  EXPIRED: 'Expired',
  OTHER: 'Other',
};

/** The reasons a reviewer should have to explain in writing. */
export const REJECTION_CODES_REQUIRING_NOTE: readonly RejectionCode[] = [
  'SUSPECTED_FRAUD',
  'OTHER',
];

export const DEPOSIT_SORTS = ['newest', 'oldest', 'amount_desc', 'amount_asc'] as const;
export const depositSortSchema = z.enum(DEPOSIT_SORTS);
export type DepositSort = (typeof DEPOSIT_SORTS)[number];

export const DEPOSIT_SORT_LABELS: Record<DepositSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_desc: 'Largest amount',
  amount_asc: 'Smallest amount',
};

export const PROOF_SOURCES = [
  'PLAYER_UPLOAD',
  'ADMIN_UPLOAD',
  'TELEGRAM_PHOTO',
  'TELEGRAM_DOCUMENT',
  'SYSTEM_IMPORT',
] as const;
export const proofSourceSchema = z.enum(PROOF_SOURCES);
export type ProofSource = (typeof PROOF_SOURCES)[number];

export const CREDIT_VERIFIED_BY = ['API_OK', 'BALANCE_DELTA', 'MANUAL'] as const;
export const creditVerifiedBySchema = z.enum(CREDIT_VERIFIED_BY);
export type CreditVerifiedBy = (typeof CREDIT_VERIFIED_BY)[number];

export const CREDIT_VERIFIED_BY_LABELS: Record<CreditVerifiedBy, string> = {
  API_OK: 'Ichancy confirmed',
  BALANCE_DELTA: 'Proved by balance re-read',
  MANUAL: 'Confirmed by a human',
};

// ── Players ────────────────────────────────────────────────────────────────────────────────────

/**
 * `BLOCKED` is the operator's own lock, not an Ichancy state: a blocked player can do nothing in
 * this tenant's bot — no deposit, no withdrawal, no menu — while their casino account is untouched.
 * It is set and cleared from this console (`players.block`), and it carries a reason.
 */
export const PLAYER_STATUSES = [
  'PENDING_ICHANCY',
  'ACTIVE',
  'SUSPENDED',
  'SELF_EXCLUDED',
  'CLOSED',
  'BLOCKED',
] as const;
export const playerStatusSchema = z.enum(PLAYER_STATUSES);
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  PENDING_ICHANCY: 'Pending Ichancy',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  SELF_EXCLUDED: 'Self-excluded',
  CLOSED: 'Closed',
  BLOCKED: 'Blocked',
};

export const PLAYER_STATUS_TONES: Record<PlayerStatus, Tone> = {
  PENDING_ICHANCY: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  SELF_EXCLUDED: 'danger',
  CLOSED: 'muted',
  BLOCKED: 'danger',
};

/**
 * Where a player row came from.
 *
 * `TELEGRAM` is the ordinary case — the player pressed Start. `ICHANCY_IMPORT` is an account that
 * already existed under the operator's Ichancy agent before the bot did, pulled in when the tenant
 * was created (the "old players"); it has no Telegram id until somebody attaches one. `ADMIN` is a
 * row registered from this console.
 */
export const PLAYER_SOURCES = ['TELEGRAM', 'ICHANCY_IMPORT', 'ADMIN'] as const;
export const playerSourceSchema = z.enum(PLAYER_SOURCES);
export type PlayerSource = (typeof PLAYER_SOURCES)[number];

export const PLAYER_SOURCE_LABELS: Record<PlayerSource, string> = {
  TELEGRAM: 'Telegram',
  ICHANCY_IMPORT: 'Imported from Ichancy',
  ADMIN: 'Registered by an admin',
};

// ── Manual player debits ───────────────────────────────────────────────────────────────────────

/**
 * How a manual debit ended. Three endings, because taking chips back out of a live casino account
 * has three, and a console that only knows about the happy one is how a player gets debited twice.
 *
 * `REJECTED` is Ichancy refusing — almost always because the balance is no longer there. Nothing
 * moved and nothing was posted to the ledger.
 *
 * `NEEDS_RECONCILIATION` is the same word, and the same condition, the credit path uses: Ichancy
 * neither confirmed nor denied, and re-reading the balance did not settle it either. It is NOT a
 * failure the console may retry — Ichancy has no idempotency key, so a repeat is a second debit of
 * a real person's money. A human checks Ichancy first.
 */
export const PLAYER_DEBIT_STATUSES = ['DEBITED', 'REJECTED', 'NEEDS_RECONCILIATION'] as const;
export const playerDebitStatusSchema = z.enum(PLAYER_DEBIT_STATUSES);
export type PlayerDebitStatus = (typeof PLAYER_DEBIT_STATUSES)[number];

export const PLAYER_DEBIT_STATUS_LABELS: Record<PlayerDebitStatus, string> = {
  DEBITED: 'Debited',
  REJECTED: 'Refused by Ichancy',
  NEEDS_RECONCILIATION: 'Needs reconciliation',
};

export const PLAYER_DEBIT_STATUS_TONES: Record<PlayerDebitStatus, Tone> = {
  DEBITED: 'success',
  REJECTED: 'warning',
  NEEDS_RECONCILIATION: 'danger',
};

// ── Withdrawals (player cash-out) ──────────────────────────────────────────────────────────────

/**
 * The life of a withdrawal request, mirrored from the backend's `WithdrawalStatus`.
 *
 * Two of these are easy to misread:
 *
 *   - `DEBITED` is NOT paid. The player's casino balance has been taken (so it cannot be spent
 *     twice), the payout wallet has been checked, and a HUMAN still has to send the money and press
 *     "mark paid". No payout rail here can send money over an API — Sham Cash is read-only — so
 *     this is the state a withdrawal waits in for a person, in AUTO mode as much as in MANUAL.
 *   - `NEEDS_RECONCILIATION` is the same word, and the same condition, the debit path uses: Ichancy
 *     neither confirmed nor denied the debit. Nothing here may be retried; a human checks Ichancy.
 */
export const WITHDRAWAL_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'DEBITING',
  'DEBITED',
  'PAID',
  'DEBIT_FAILED',
  'NEEDS_RECONCILIATION',
  'REJECTED',
  'CANCELLED',
] as const;
export const withdrawalStatusSchema = z.enum(WITHDRAWAL_STATUSES);
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** Still moving: somebody, or the worker, has something left to do. The queue's default view. */
export const OPEN_WITHDRAWAL_STATUSES: readonly WithdrawalStatus[] = [
  'REQUESTED',
  'APPROVED',
  'DEBITING',
  'DEBITED',
];

/** Money was taken, or may have been, and nobody was paid. Somebody has to look. */
export const ATTENTION_WITHDRAWAL_STATUSES: readonly WithdrawalStatus[] = [
  'DEBIT_FAILED',
  'NEEDS_RECONCILIATION',
];

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  DEBITING: 'Debiting',
  DEBITED: 'Ready to pay',
  PAID: 'Paid',
  DEBIT_FAILED: 'Debit failed',
  NEEDS_RECONCILIATION: 'Needs reconciliation',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const WITHDRAWAL_STATUS_TONES: Record<WithdrawalStatus, Tone> = {
  REQUESTED: 'info',
  APPROVED: 'info',
  DEBITING: 'info',
  DEBITED: 'warning',
  PAID: 'success',
  DEBIT_FAILED: 'danger',
  NEEDS_RECONCILIATION: 'danger',
  REJECTED: 'neutral',
  CANCELLED: 'muted',
};

/**
 * How an operator's bot answers a cash-out.
 *
 * `MANUAL`: a human approves first; nothing moves until then. `AUTO`: the platform approves, debits
 * the player's casino balance and checks the payout wallet by itself — and a human STILL performs
 * the transfer and marks it paid, because no payout rail here can send money over an API.
 */
export const WITHDRAWAL_MODES = ['AUTO', 'MANUAL'] as const;
export const withdrawalModeSchema = z.enum(WITHDRAWAL_MODES);
export type WithdrawalMode = (typeof WITHDRAWAL_MODES)[number];

export const WITHDRAWAL_MODE_LABELS: Record<WithdrawalMode, string> = {
  AUTO: 'Automatic',
  MANUAL: 'Manual',
};

/**
 * How an operator's bot answers a submitted deposit.
 *
 * `MANUAL`: a human decides every deposit. `AUTO`: the platform attempts to match the player's
 * claim against the rail's own records (a Sham Cash statement line, a confirmed on-chain transfer)
 * before a human sees the card, and approves ONLY on that evidence — never on the claim alone. Not
 * to be confused with a legacy DEPOSIT_AUTO_APPROVE env flag, which approved with no evidence at
 * all and is refused outright on any real deployment.
 */
export const DEPOSIT_MODES = ['AUTO', 'MANUAL'] as const;
export const depositModeSchema = z.enum(DEPOSIT_MODES);
export type DepositMode = (typeof DEPOSIT_MODES)[number];

export const DEPOSIT_MODE_LABELS: Record<DepositMode, string> = {
  AUTO: 'Automatic',
  MANUAL: 'Manual',
};

export const WITHDRAWAL_SORTS = ['newest', 'oldest'] as const;
export const withdrawalSortSchema = z.enum(WITHDRAWAL_SORTS);
export type WithdrawalSort = (typeof WITHDRAWAL_SORTS)[number];

export const WITHDRAWAL_SORT_LABELS: Record<WithdrawalSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
};

/**
 * What the payout wallet held when the debit landed.
 *
 * `not_configured` is a rail with no readable wallet (a placeholder address, a cash office) and
 * `unknown` is the chain or Sham Cash not answering — neither is `insufficient`, and neither may be
 * rendered as a zero. The same never-0 rule as every other balance on this console.
 */
export const WALLET_CHECK_STATUSES = ['ok', 'insufficient', 'unknown', 'not_configured'] as const;
export const walletCheckStatusSchema = z.enum(WALLET_CHECK_STATUSES);
export type WalletCheckStatus = (typeof WALLET_CHECK_STATUSES)[number];

export const WALLET_CHECK_STATUS_LABELS: Record<WalletCheckStatus, string> = {
  ok: 'Wallet covers it',
  insufficient: 'Wallet short',
  unknown: 'Wallet unknown',
  not_configured: 'No wallet to check',
};

export const WALLET_CHECK_STATUS_TONES: Record<WalletCheckStatus, Tone> = {
  ok: 'success',
  insufficient: 'danger',
  unknown: 'warning',
  not_configured: 'muted',
};

// ── Payment methods ────────────────────────────────────────────────────────────────────────────

export const PAYMENT_RAILS = [
  'BANK_TRANSFER',
  'MOBILE_WALLET',
  'CASH_OFFICE',
  'CRYPTO',
  'INTERNAL',
] as const;
export const paymentRailSchema = z.enum(PAYMENT_RAILS);
export type PaymentRail = (typeof PAYMENT_RAILS)[number];

export const PAYMENT_RAIL_LABELS: Record<PaymentRail, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MOBILE_WALLET: 'Mobile wallet',
  CASH_OFFICE: 'Cash office',
  CRYPTO: 'Crypto',
  INTERNAL: 'Internal',
};

export const VERIFICATION_MODES = [
  'MANUAL_PROOF',
  'REFERENCE_MATCH',
  'AUTO_STATEMENT',
  'NONE',
] as const;
export const verificationModeSchema = z.enum(VERIFICATION_MODES);
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

export const VERIFICATION_MODE_LABELS: Record<VerificationMode, string> = {
  MANUAL_PROOF: 'Manual proof',
  REFERENCE_MATCH: 'Reference match',
  AUTO_STATEMENT: 'Auto statement',
  NONE: 'None',
};

export const VERIFICATION_MODE_DESCRIPTIONS: Record<VerificationMode, string> = {
  MANUAL_PROOF: 'A reviewer reads the uploaded receipt.',
  REFERENCE_MATCH: 'The player types the rail reference and it is matched against a statement.',
  AUTO_STATEMENT: 'Statements are ingested automatically (future rails).',
  NONE: 'No verification step.',
};

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────────

export const BREAK_CATEGORIES = [
  'AGENT_FLOAT_MISMATCH',
  'PLAYER_BALANCE_MISMATCH',
  'MISSING_CREDIT',
  'DUPLICATE_CREDIT',
  'UNIDENTIFIED_RECEIPT',
  'LEDGER_IMBALANCE',
  'ORPHAN_ICHANCY_CALL',
  'STUCK_DEPOSIT',
] as const;
export const breakCategorySchema = z.enum(BREAK_CATEGORIES);
export type BreakCategory = (typeof BREAK_CATEGORIES)[number];

export const BREAK_CATEGORY_LABELS: Record<BreakCategory, string> = {
  AGENT_FLOAT_MISMATCH: 'Agent float mismatch',
  PLAYER_BALANCE_MISMATCH: 'Player balance mismatch',
  MISSING_CREDIT: 'Missing credit',
  DUPLICATE_CREDIT: 'Duplicate credit',
  UNIDENTIFIED_RECEIPT: 'Unidentified receipt',
  LEDGER_IMBALANCE: 'Ledger imbalance',
  ORPHAN_ICHANCY_CALL: 'Orphan Ichancy call',
  STUCK_DEPOSIT: 'Stuck deposit',
};

export const BREAK_STATUSES = [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'WRITTEN_OFF',
  'FALSE_POSITIVE',
] as const;
export const breakStatusSchema = z.enum(BREAK_STATUSES);
export type BreakStatus = (typeof BREAK_STATUSES)[number];

/** The only three the backend accepts as a closing status. */
export const TERMINAL_BREAK_STATUSES = ['RESOLVED', 'WRITTEN_OFF', 'FALSE_POSITIVE'] as const;
export type TerminalBreakStatus = (typeof TERMINAL_BREAK_STATUSES)[number];

export const BREAK_STATUS_LABELS: Record<BreakStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  RESOLVED: 'Resolved',
  WRITTEN_OFF: 'Written off',
  FALSE_POSITIVE: 'False positive',
};

export const BREAK_STATUS_TONES: Record<BreakStatus, Tone> = {
  OPEN: 'danger',
  INVESTIGATING: 'warning',
  RESOLVED: 'success',
  WRITTEN_OFF: 'neutral',
  FALSE_POSITIVE: 'muted',
};

export const BREAK_STATUS_DESCRIPTIONS: Record<TerminalBreakStatus, string> = {
  RESOLVED: 'The difference was explained and corrected.',
  WRITTEN_OFF: 'Real money is missing and we are accepting the loss.',
  FALSE_POSITIVE: 'There was never a difference; the check was wrong.',
};

export const SEVERITY_TONES: Record<number, Tone> = {
  1: 'muted',
  2: 'info',
  3: 'warning',
  4: 'danger',
  5: 'danger',
};

// ── Tenants ────────────────────────────────────────────────────────────────────────────────────

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export const tenantStatusSchema = z.enum(TENANT_STATUSES);
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
};

export const TENANT_STATUS_TONES: Record<TenantStatus, Tone> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'muted',
};

// ── Risk flags ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the backend's `RiskFlags` and `RISK_FLAG_SEVERITY`. Typed as an open lookup with a
 * fallback rather than an exhaustive Record, because the wire type is `string[]` and a flag added
 * to the backend tomorrow must still render — as itself, not as a blank.
 */
export const RISK_FLAG_LABELS: Record<string, string> = {
  DUPLICATE_PROOF_EXACT: 'Identical proof already seen',
  DUPLICATE_PROOF_SIMILAR: 'Near-identical proof already seen',
  DUPLICATE_PROOF_SAME_PLAYER: 'Player reused their own proof',
  REFERENCE_REUSED: 'Reference used before',
  LARGE_AMOUNT: 'Unusually large amount',
  NEW_PLAYER: 'New player',
  RAPID_RESUBMISSION: 'Resubmitted very quickly',
  PROOF_UNREADABLE: 'Proof could not be read',
};

/** 1 (note it) to 5 (do not approve without checking). Unknown flags sort as 3. */
export const RISK_FLAG_SEVERITY: Record<string, number> = {
  DUPLICATE_PROOF_EXACT: 5,
  DUPLICATE_PROOF_SIMILAR: 4,
  REFERENCE_REUSED: 4,
  DUPLICATE_PROOF_SAME_PLAYER: 3,
  RAPID_RESUBMISSION: 2,
  LARGE_AMOUNT: 2,
  NEW_PLAYER: 1,
  PROOF_UNREADABLE: 1,
};

export const UNKNOWN_RISK_FLAG_SEVERITY = 3;

export function riskFlagLabel(flag: string): string {
  return RISK_FLAG_LABELS[flag] ?? flag.toLowerCase().replace(/_/g, ' ');
}

export function riskFlagSeverity(flag: string): number {
  return RISK_FLAG_SEVERITY[flag] ?? UNKNOWN_RISK_FLAG_SEVERITY;
}

/** Highest severity across a deposit's flags, or 0 when it has none. Drives the queue's risk dot. */
export function highestRiskSeverity(flags: readonly string[]): number {
  return flags.reduce((max, flag) => Math.max(max, riskFlagSeverity(flag)), 0);
}
