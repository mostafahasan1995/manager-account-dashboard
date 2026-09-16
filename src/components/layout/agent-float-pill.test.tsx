import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import type { Locale } from '@/lib/i18n/locales';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types';

import { AgentFloatPill } from './agent-float-pill';

/**
 * The float pill is the console's answer to a failure operators used to discover second-hand.
 *
 * When the Ichancy agent balance runs out, the backend refuses the credit and the deposit dies at
 * the Ichancy step — on a player who has already sent their money. Nothing in this console showed
 * the float, so the first sign of an empty one was that failure. This pill exists so the warning
 * arrives before the deposit does, which is why it is in the chrome and not on a page.
 *
 * Two of the four cases below are about it staying out of the way. It renders above every route in
 * the app, so a pill that throws takes the whole console with it — and the endpoint behind it does
 * not exist on the backend yet, so "the request failed" is the state it is in TODAY, on every
 * screen, for everybody.
 */

const url = `${config.apiBaseUrl}/v1/admin/reconciliation/agent-float`;

const envelope = (data: unknown) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'c', timestamp: '2026-08-26T10:00:00.000Z' },
});

const floatBody = (overrides: Record<string, unknown> = {}) => ({
  currencyCode: 'NSP',
  balanceMinor: '443750000',
  balance: '4437500.00',
  lowWatermarkMinor: '100000000',
  isLow: false,
  checkedAt: '2026-08-26T10:00:00.000Z',
  ...overrides,
});

const render = (options: { body?: unknown; role?: AdminRole; locale?: Locale } = {}) => {
  if (options.body !== undefined) {
    server.use(http.get(url, () => HttpResponse.json(envelope(options.body))));
  }
  return renderWithProviders(<AgentFloatPill />, {
    auth: { role: options.role ?? 'FINANCE_ADMIN' },
    ...(options.locale === undefined ? {} : { locale: options.locale }),
  });
};

describe('AgentFloatPill', () => {
  it('shows the balance players are being credited out of', async () => {
    render();

    // Grouped and in Western digits, as every amount in this console is: a float read at a glance
    // is only read correctly if the thousands are separated.
    expect(await screen.findByText('4,437,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('Agent float')).toBeInTheDocument();
  });

  it('raises the alarm when the float is low, rather than waiting for a deposit to fail', async () => {
    render({ body: floatBody({ balanceMinor: '62500000', balance: '625000.00', isLow: true }) });

    // A live region ONLY in this state. The balance ticking down is not worth interrupting anyone
    // for; crossing the floor is the one change somebody has to act on.
    const pill = await screen.findByRole('status');

    expect(pill).toHaveTextContent('625,000.00 NSP');
    expect(pill).toHaveTextContent('Low');
    // Pinned deliberately: a pill that says "Low" in the same grey as the three badges beside it is
    // a pill nobody's eye stops on, which is the entire failure this component was built to fix.
    expect(pill.querySelector('[class*="--danger"]')).not.toBeNull();
  });

  it('says nothing at all when the read fails, because it renders above every screen', async () => {
    server.use(http.get(url, () => HttpResponse.error()));
    const { container } = render();

    // Waiting for the query to settle, so this cannot pass merely by being early.
    await expect(screen.findByText('Agent float')).rejects.toThrow();
    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing when the balance is not a figure it can trust', async () => {
    // `parseResponse` warns on a shape it does not recognise and passes the value through, so a
    // malformed amount reaches this component — where BigInt would throw and blank the top bar.
    render({ body: floatBody({ balanceMinor: '4437500.00' }) });

    await expect(screen.findByText('Agent float')).rejects.toThrow();
  });

  it('still shows the balance when only the watermark is unreadable', async () => {
    // The floor is context for the tooltip; the balance is the reason the pill exists. Losing the
    // first must never cost the second.
    render({ body: floatBody({ lowWatermarkMinor: 'not-a-number' }) });

    expect(await screen.findByText('4,437,500.00 NSP')).toBeInTheDocument();
  });

  it('is hidden from a role that cannot see the operator money', async () => {
    // SUPPORT answers players. The agent float is the operator's own position, and the capability
    // that governs it is the same one that gates the float sync and the breaks.
    const { container } = render({ role: 'SUPPORT' });

    await expect(screen.findByText('Agent float')).rejects.toThrow();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AgentFloatPill in Arabic', () => {
  it('keeps the balance in Western digits inside a bar that reads right to left', async () => {
    render({ locale: 'ar' });

    expect(await screen.findByText('رصيد الوكيل')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    /*
     * The document mirrors. The amount does not, and `dir="ltr"` on it is what says so: an amount
     * is one Latin numeric run, and the bidi algorithm reorders such a run against the surrounding
     * paragraph — a leading minus lands at the visual end. Nothing here is negative today, but the
     * float pill is the one figure on screen at all times in both languages, and the direction it
     * is read in is not something to leave to whichever text happens to sit beside it.
     */
    expect(screen.getByText('4,437,500.00 NSP')).toHaveAttribute('dir', 'ltr');
  });

  it('raises the same alarm in Arabic, in the same danger token', async () => {
    render({
      body: floatBody({ balanceMinor: '62500000', balance: '625000.00', isLow: true }),
      locale: 'ar',
    });

    const pill = await screen.findByRole('status');

    expect(pill).toHaveTextContent('منخفض');
    expect(pill).toHaveTextContent('625,000.00 NSP');
    // Arabic is not a translation layer over an English console: the alarm has to be as loud here.
    expect(pill.querySelector('[class*="--danger"]')).not.toBeNull();
  });
});
