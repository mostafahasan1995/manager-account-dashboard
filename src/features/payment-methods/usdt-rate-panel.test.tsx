import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types';

import { UsdtRatePanel } from './usdt-rate-panel';

/**
 * The rate is one number that multiplies every deposit on the USDT rails, so most of this file is
 * about the thing that stops it being wrong.
 *
 * The server refuses a rate more than 20% from the one it replaces. That catches a misplaced decimal
 * and it catches the Syrian redenomination confusion — the same site quotes 132 and 13,200 for a
 * dollar on the same page, and choosing wrong credits every player a hundred times too much.
 *
 * It cannot catch the FIRST rate, because there is nothing to compare against, and every later rate
 * anchors to whatever the first one was. The worked example is the guard for that one, which is why
 * it has more tests than anything else here: it is the only protection the first rate has, and it
 * only works if it is exactly right.
 */

const url = `${config.apiBaseUrl}/v1/admin/exchange-rates/usdt`;

const envelope = (data: unknown) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'c', timestamp: '2026-08-26T10:00:00.000Z' },
});

const rateBody = (overrides: Record<string, unknown> = {}) => ({
  quoteAsset: 'USDT',
  currencyCode: 'NSP',
  rate: '13200.00',
  rateMinor: '1320000',
  source: 'MANUAL',
  sourceNote: 'sp-today.com',
  setByAdminId: null,
  effectiveFrom: new Date().toISOString(),
  isStale: false,
  maxAgeHours: 24,
  ...overrides,
});

const render = (options: { rate?: unknown; role?: AdminRole } = {}) => {
  server.use(
    http.get(url, () =>
      HttpResponse.json(envelope(options.rate === undefined ? rateBody() : options.rate)),
    ),
  );
  return renderWithProviders(<UsdtRatePanel currency="NSP" />, {
    auth: { role: options.role ?? 'FINANCE_ADMIN' },
  });
};

const field = () => screen.findByLabelText(/one usdt is worth/i);
/**
 * The preview lines are assembled from several interpolations, so each renders as its own text
 * node. `getByText` matches a node, which would be one fragment of one line; `toHaveTextContent`
 * reads the whole subtree, which is what a person actually sees.
 */

describe('the worked example', () => {
  it('shows what a real deposit would credit, at the rate being typed', async () => {
    const { user, container } = render({ rate: null });

    await user.type(await field(), '13200.00');

    // The whole point, in one assertion: a hundred-fold error is invisible in "13200" and
    // unmissable in "1,320,000.00".
    expect(container).toHaveTextContent('100 USDT → 1,320,000.00 NSP');
  });

  it('moves by exactly a factor of a hundred when the denomination is wrong', async () => {
    // The two numbers the same site publishes for a dollar, side by side. If an operator types the
    // wrong one, this line is where they see it.
    const { user, container } = render({ rate: null });
    const input = await field();

    await user.type(input, '13200');
    expect(container).toHaveTextContent('100 USDT → 1,320,000.00 NSP');

    await user.clear(input);
    await user.type(input, '132');
    expect(container).toHaveTextContent('100 USDT → 13,200.00 NSP');
  });

  it('updates as the operator types, not after saving', async () => {
    // A preview of the SAVED rate would confirm the number already in force and catch nothing.
    const { user, container } = render();
    const input = await screen.findByDisplayValue('13200.00');

    await user.clear(input);
    await user.type(input, '15000');

    expect(container).toHaveTextContent('100 USDT → 1,500,000.00 NSP');
  });

  it('shows one USDT crediting exactly the rate, which is the check done in the head', async () => {
    // The line an operator verifies without arithmetic: if "one USDT" does not read like the
    // number they just typed, they have typed the wrong number. Flooring itself is exercised
    // exhaustively in the backend's exchange-rate spec, where fractions of a minor unit exist.
    const { user, container } = render({ rate: null });

    await user.type(await field(), '13200.00');

    expect(container).toHaveTextContent('1 USDT → 13,200.00 NSP');
  });

  it('says nothing rather than zero when the rate is not a number yet', async () => {
    // "This credits nothing" and "this is not a rate" are different statements, and showing the
    // first for the second is how somebody saves a rate of zero.
    const { user } = render({ rate: null });

    await user.type(await field(), 'abc');

    expect(screen.getByText(/enter a rate to see what it would credit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save rate/i })).toBeDisabled();
  });

  it('refuses a negative rate', async () => {
    const { user } = render({ rate: null });

    await user.type(await field(), '-13200');

    expect(screen.getByRole('button', { name: /save rate/i })).toBeDisabled();
  });
});

describe('when no rate has been set', () => {
  it('says the rails cannot price anything, which is why they are off', async () => {
    render({ rate: null });

    expect(await screen.findByText(/no rate is set/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot price a deposit/i)).toBeInTheDocument();
  });
});

describe('when the rate is too old', () => {
  it('says the rails are refusing deposits, and how long a rate lasts', async () => {
    // Not just "stale": the operator needs to know the rail is DOWN and what fixes it.
    render({ rate: rateBody({ isStale: true }) });

    expect(await screen.findByText(/too old to use/i)).toBeInTheDocument();
    expect(screen.getByText(/refusing deposits/i)).toBeInTheDocument();
    expect(screen.getByText(/24 hours/i)).toBeInTheDocument();
  });

  it('still shows the rate itself, because a refusal nobody can diagnose is worse', async () => {
    render({ rate: rateBody({ isStale: true }) });

    // `findByDisplayValue`, not `getByLabelText().toHaveValue()`: the label exists before the
    // query resolves, so the field is briefly empty and the assertion would race it.
    expect(await screen.findByDisplayValue('13200.00')).toBeInTheDocument();
  });
});

describe('a rate far from the current one', () => {
  const refuseJump = (): void => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'RATE_IMPLAUSIBLE_JUMP',
              message: 'That rate is 9900.0% away from the current one.',
            },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 422 },
        ),
      ),
    );
  };

  it('asks whether the operator meant it, rather than reporting a failure', async () => {
    const { user } = render();
    refuseJump();
    const input = await screen.findByDisplayValue('13200.00');

    await user.clear(input);
    await user.type(input, '132');
    await user.click(screen.getByRole('button', { name: /save rate/i }));

    expect(await screen.findByText(/long way from the current rate/i)).toBeInTheDocument();
    // And it names the specific confusion, because that is the one worth naming here.
    expect(screen.getByText(/factor of a hundred/i)).toBeInTheDocument();
  });

  it('needs a second, deliberate press before it will go through', async () => {
    const { user } = render();
    refuseJump();
    const input = await screen.findByDisplayValue('13200.00');

    await user.clear(input);
    await user.type(input, '132');
    await user.click(screen.getByRole('button', { name: /save rate/i }));

    // The button changes what it says, so confirming is never the same act as saving.
    expect(await screen.findByRole('button', { name: /yes, save this rate/i })).toBeInTheDocument();
  });

  it('withdraws the confirmation the moment the number is edited again', async () => {
    // A confirmation given for one number must never carry over to a different one.
    const { user } = render();
    refuseJump();
    const input = await screen.findByDisplayValue('13200.00');

    await user.clear(input);
    await user.type(input, '132');
    await user.click(screen.getByRole('button', { name: /save rate/i }));
    await screen.findByRole('button', { name: /yes, save this rate/i });

    await user.type(input, '5');

    expect(screen.getByRole('button', { name: /save rate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /yes, save this rate/i })).not.toBeInTheDocument();
  });
});

describe('who may change it', () => {
  it('lets a finance admin set it', async () => {
    render({ role: 'FINANCE_ADMIN' });

    expect(await screen.findByRole('button', { name: /save rate/i })).toBeInTheDocument();
  });

  it('lets a platform admin change the rate — it configures the operator rails', async () => {
    // The rate is payment config, which a platform admin sets on the operator it is viewing — its own
    // home tenant, or another selected in the switcher. The switcher decides WHICH operator's rate is
    // touched, not whether the control is offered at all.
    render({ role: 'PLATFORM_ADMIN' });

    expect(await field()).toBeEnabled();
    expect(screen.getByRole('button', { name: /save rate/i })).toBeInTheDocument();
  });

  it('shows a support user nothing at all', () => {
    const { container } = render({ role: 'SUPPORT' });

    // SUPPORT can read rails, so the panel renders; what it must not do is offer the control.
    expect(container.querySelector('button[type="submit"]')).toBeNull();
  });
});
