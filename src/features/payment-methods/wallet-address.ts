/**
 * Whether a pasted wallet address belongs to a chain at all, and to which one.
 *
 * ══ THE CHAIN IS READ OFF THE ADDRESS, NEVER OFF THE METHOD CODE ══════════════════════════════
 * This file used to key a table on `USDT_TRC20` and `USDT_BEP20` — the codes this SYSTEM seeds. It
 * worked for rails the system created for itself and for nothing else. The first real operator to
 * configure a USDT rail called it `USDT`, so the lookup answered null: their rail vanished from the
 * financial screen entirely, and the address form applied no address check to the one field in this
 * console where a mistake cannot be undone. A code is a name somebody types; it cannot be a lookup
 * key.
 *
 * An address cannot lie about its chain the way a name can. `T…` base58 is Tron and `0x…` hex is an
 * EVM chain, and the two formats have no overlap — so the string the operator pasted answers the
 * question exactly, whatever they called the rail. The backend was fixed the same way and for the
 * same reason; see `networkFor` in modules/deposit/services/deposit-chain-check.service.ts.
 *
 * ══ WHY THE CONSOLE CHECKS SOMETHING THE BACKEND ALSO CHECKS ══════════════════════════════════
 * The backend refuses a malformed address on `POST /destinations`, and that refusal is the control —
 * a curl with a token skips this file entirely. What this adds is TIMING and LANGUAGE: the operator
 * learns before pressing Save, in Arabic if that is what they read, at the moment the clipboard is
 * still one paste away from the right value.
 *
 * That matters more here than on any other field. This address is where every player on the rail is
 * told to send money. A wrong one does not bounce — the transfer succeeds, into a stranger's wallet,
 * and succeeds again for every deposit after it, and `accountIdentifier` cannot be edited afterwards
 * by design. Saving is the irreversible step, so the warning has to come before it.
 *
 * ══ WHAT IT CATCHES, AND WHAT IT CANNOT ═══════════════════════════════════════════════════════
 * It catches a string that is not a chain address on a rail that pays on a chain: the seeded
 * `SEED-PLACEHOLDER-…`, an IBAN pasted into the wrong rail, an address truncated by a bad copy.
 *
 * It does NOT decide that a well-formed address is on the wrong chain, because after the fix above
 * nothing here knows which chain a rail is "supposed" to be on — and the backend no longer needs it
 * to: every deposit is verified against the chain of ITS OWN destination address, so a TRC20 and a
 * BEP20 account can sit on one method and each still be checked correctly. What the form does
 * instead is show the operator, in words, which chain the string they just pasted belongs to, next
 * to the tick that asks them to read it back — the wrong-clipboard paste is caught by the human who
 * sees "BEP20" on a rail they think of as TRC20, not by a table of names.
 *
 * It also does not verify a checksum, and so cannot tell a well-formed address of yours from a
 * well-formed address of somebody else's. Addresses are pasted rather than typed, and a paste fails
 * by being the WRONG address, not a corrupted one — which is why the field asks for the read-back.
 * Mirrors core/payments/wallet-address.ts on the backend.
 */

/** The chains a rail can pay on. Mirrors ChainNetwork in the backend. */
export type WalletNetwork = 'TRC20' | 'BEP20';

/**
 * Base58 with no `0`, `O`, `I` or `l` — excluded from the alphabet precisely because those are the
 * characters a human misreads. Tron addresses are 34 characters and always start `T`.
 */
const TRC20_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/** Twenty bytes of hex behind `0x`. Case carries an EIP-55 checksum that is not verified here. */
const BEP20_ADDRESS = /^0x[A-Fa-f0-9]{40}$/;

export const isWalletAddress = (network: WalletNetwork, value: string): boolean =>
  (network === 'TRC20' ? TRC20_ADDRESS : BEP20_ADDRESS).test(value);

/**
 * The chain this string belongs to, or null when it belongs to none.
 *
 * The single source of truth for "is this a chain address": the financial screen asks it to decide
 * whether an account has an on-chain balance worth reading, and the destination form asks it to
 * decide whether what was pasted is an address at all.
 */
export function detectWalletNetwork(value: string): WalletNetwork | null {
  if (isWalletAddress('TRC20', value)) return 'TRC20';
  if (isWalletAddress('BEP20', value)) return 'BEP20';
  return null;
}

/**
 * What is wrong with an account identifier on a rail that pays on a chain — as a message KEY, or
 * null when nothing is.
 *
 * A key rather than a sentence because the sentence has to exist in both languages, and a validator
 * that built English text would quietly make half the console monolingual at exactly the point
 * where being understood matters most.
 *
 * Only ever called for a CRYPTO rail. Every other rail takes an account number whose shape this
 * console has no business asserting — a rule that rejected a valid Syriatel number would be a worse
 * bug than the one it was added to prevent.
 */
export type WalletAddressProblem = 'rails.validation.walletShape';

export function chainAddressProblem(raw: string): WalletAddressProblem | null {
  // Trimmed, not rejected: this arrives from a phone's clipboard, and a trailing newline is not a
  // mistake anybody should be told about.
  const value = raw.trim();
  // An empty field is the blank-check rule's to report. Two messages about one empty box is one
  // message too many, and the other one is clearer.
  if (value === '' || detectWalletNetwork(value) !== null) return null;
  return 'rails.validation.walletShape';
}
