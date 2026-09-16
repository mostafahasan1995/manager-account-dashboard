import type { ShamCashBalance } from '@/types';
import type { ShamCashDevTransaction, ShamCashHome } from '@/types/shamcash-dev';

/**
 * The parser half of the Sham Cash bench, reproduced closely enough to be a useful oracle.
 *
 * ══ WHY IT PARSES RATHER THAN RETURNING A FIXTURE ═════════════════════════════════════════════
 * The whole value of that endpoint is that it is deterministic and depends only on the text you
 * paste — it is the thing that tells "the credentials were refused" apart from "the page changed".
 * A mock that answered the same object whatever it was given would make the one test that matters
 * unwritable: paste text the parser cannot read, and see it report nothing.
 *
 * ══ IT IS A SIMPLIFICATION, AND SAYS SO ═══════════════════════════════════════════════════════
 * The real `parseShamCashHome` handles Arabic numerals, both locales' currency labels and a
 * multi-line transfer layout. This handles the shapes the console's own fixtures use. It is a
 * stand-in for a screen test, never a second implementation to keep in step — the contract it has
 * to honour is the RESPONSE SHAPE, and that is what the page is built against.
 */

/** The real home-page shape (synthetic values), matching the backend's own reader fixture. */
export const MOCK_SHAM_PAGE = [
  'Home',
  '1,500',
  'EURO',
  '0',
  '0',
  'USD',
  '0',
  '250,000',
  'SYRIAN POUND',
  '10,000',
  'Send',
].join('\n');

const CURRENCY_LABELS: readonly { code: string; label: string }[] = [
  { code: 'SYP', label: 'SYRIAN POUND' },
  { code: 'USD', label: 'USD' },
  { code: 'EUR', label: 'EURO' },
];

/**
 * Balances read the way the real parser does: a currency LABEL, with the available figure on the
 * line before it and the reserved figure on the line after.
 */
function parseBalances(lines: readonly string[]): ShamCashBalance[] {
  const balances: ShamCashBalance[] = [];

  lines.forEach((line, index) => {
    const match = CURRENCY_LABELS.find((entry) => entry.label === line.toUpperCase());
    if (match === undefined) return;

    const available = lines[index - 1];
    const locked = lines[index + 1];
    if (available === undefined || locked === undefined) return;

    balances.push({ currency: match.code, available, locked });
  });

  return balances;
}

/** A transfer line: `#<id>` then a date, an amount with its sign, a name and a masked card. */
function parseTransactions(lines: readonly string[]): ShamCashDevTransaction[] {
  const transactions: ShamCashDevTransaction[] = [];

  lines.forEach((line, index) => {
    const id = /^#(\d+)$/.exec(line);
    if (id === null) return;

    const date = lines[index + 1];
    const amount = lines[index + 2];
    const username = lines[index + 3];
    const maskedCard = lines[index + 4];
    if (date === undefined || amount === undefined) return;

    const signed = /^([+-])\s*([\d,.]+)\s*(\w+)$/.exec(amount);
    if (signed === null) return;

    transactions.push({
      transactionId: id[1] ?? '',
      date,
      amount: signed[2] ?? '',
      currency: signed[3] ?? '',
      direction: signed[1] === '+' ? 'in' : 'out',
      username: username ?? '',
      maskedCard: maskedCard ?? '',
    });
  });

  return transactions;
}

export function mockParseShamCashText(text: string): ShamCashHome {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { balances: parseBalances(lines), transactions: parseTransactions(lines) };
}

// ── The QR pairing ─────────────────────────────────────────────────────────────────────────────

/** The id every mock pairing gets. Real ones are UUIDs because the route parses them as such. */
export const MOCK_PAIRING_ID = '3f6d1a2e-8b1c-4d2a-9f0e-5c7a1b2d3e4f';

/** Ask for this id to get the unhappy branch without waiting for a clock. */
export const MOCK_PAIRING_EXPIRED = '00000000-0000-4000-8000-000000000000';

/**
 * A 1x1 transparent PNG standing in for the QR.
 *
 * The screen only ever puts this in an `<img src>`, so its CONTENT is irrelevant to every assertion
 * — what matters is that it is a real data URL, because a test that asserted on a fake string would
 * pass against a component that had stopped rendering an image at all.
 */
export const MOCK_QR_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * How many times each pairing has been polled, so the mock can answer `pending` first and `linked`
 * second. Module state, reset by `POST /qr` — the same shape the rest of `db.ts` uses, and the
 * reason a test that starts a pairing always sees the sequence from the beginning.
 */
export const mockPairingPolls = new Map<string, number>();

// ── The linked account ─────────────────────────────────────────────────────────────────────────

/**
 * The account, as module state, so the screen can be driven end to end in a test: it begins
 * unlinked, a successful QR poll links it, and Refresh produces numbers.
 *
 * Stateful rather than fixed because the whole screen IS a sequence — link, read, re-read, unlink —
 * and a mock that answered the same thing to every call would test none of the transitions.
 */
interface MockAccount {
  linked: boolean;
  snapshot: { balances: unknown[]; transactions: unknown[]; checkedAt: string } | null;
}

const account: MockAccount = { linked: false, snapshot: null };

/** Called by the QR poll when it hands a session over — the API keeps the browser, so it is linked. */
export function mockAccountLink(): void {
  account.linked = true;
}

export function mockAccountStatus(): MockAccount {
  return { linked: account.linked, snapshot: account.snapshot };
}

/** `null` means "nothing linked", which the handler turns into the 503 the real API answers. */
export function mockAccountRefresh(): MockAccount['snapshot'] {
  if (!account.linked) return null;

  account.snapshot = {
    ...mockParseShamCashText(MOCK_SHAM_PAGE),
    checkedAt: new Date().toISOString(),
  };
  return account.snapshot;
}

export function mockAccountUnlink(): void {
  account.linked = false;
  account.snapshot = null;
}

/** Test-only reset, so one spec's linked account is not the next spec's starting state. */
export function resetMockAccount(): void {
  account.linked = false;
  account.snapshot = null;
  mockPairingPolls.clear();
}
