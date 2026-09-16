import type { PaymentDestination } from '@/types';

/**
 * The account number the backend writes into a rail it has just provisioned.
 *
 * ══ WHY THIS EXISTS AT ALL ════════════════════════════════════════════════════════════════════
 * `provisionDefaultPaymentMethods` gives every new operator its rails, and gives every rail one
 * ACTIVE destination — `SEED-PLACEHOLDER-USDT-TRC20-0000`, held by `REPLACE ME`. That row is what
 * makes an unconfigured rail LOOK configured: the destinations table has an entry, the entry is
 * active, and nothing on screen says the number in it is not a wallet. An operator reads that as
 * "already done" and goes looking for the setting somewhere else.
 *
 * So this console does not treat it as an address. A destination matching this prefix is a HOLE
 * where an address should be, and every surface that reads one has to say so out loud — because the
 * cost of the other reading is a player sending USDT to a string, which nobody can recover.
 *
 * Mirrors PLACEHOLDER_PREFIX in core/payments/default-payment-methods.ts.
 */
export const SEED_PLACEHOLDER_PREFIX = 'SEED-PLACEHOLDER';

export const isSeedPlaceholder = (destination: PaymentDestination): boolean =>
  destination.accountIdentifier.startsWith(SEED_PLACEHOLDER_PREFIX);
