import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { reconciliationSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';

import { ReconciliationPage } from './reconciliation-page';

const validateSearch = (search: Record<string, unknown>) =>
  reconciliationSearchSchema.parse(search);

const render = (route: string, auth?: AuthOverrides) =>
  renderWithProviders(<ReconciliationPage />, {
    route,
    routePath: '/reconciliation',
    validateSearch,
    ...(auth === undefined ? {} : { auth }),
  });

const renderInArabic = (route: string) =>
  renderWithProviders(<ReconciliationPage />, {
    route,
    routePath: '/reconciliation',
    validateSearch,
    locale: 'ar',
  });

describe('ReconciliationPage', () => {
  it('opens on the breaks tab with the filters and the float panel', async () => {
    render('/reconciliation');

    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Breaks' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /sync agent float/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /agent float mismatch/i })).toBeInTheDocument();
  });

  it('puts the chosen tab in the URL so the view can be sent to somebody', async () => {
    const { user, location } = render('/reconciliation');

    await user.click(await screen.findByRole('tab', { name: 'Rail ageing' }));

    expect(location()).toContain('tab=ageing');
    expect(await screen.findByText('RAIL_CLEARING:BANK_SYR')).toBeInTheDocument();
  });

  it('opens straight onto the tab the URL names', async () => {
    render('/reconciliation?tab=ledger');

    expect(await screen.findByRole('tab', { name: 'Ledger checks' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /run ledger invariant checks/i })).toBeInTheDocument();
  });

  it('opens the detail panel for the break named in the URL', async () => {
    render('/reconciliation?selected=ffffffff-0000-4000-8000-000000000001');

    expect(
      await screen.findByRole('heading', { name: 'Agent float mismatch' }),
    ).toBeInTheDocument();
  });

  it('shows a viewer the breaks without the float sync it cannot run', async () => {
    render('/reconciliation', { role: 'VIEWER' });

    expect(await screen.findByRole('button', { name: /agent float mismatch/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync agent float/i })).not.toBeInTheDocument();
  });

  it('explains the ledger checks to a viewer without offering to run them', async () => {
    render('/reconciliation?tab=ledger', { role: 'VIEWER' });

    expect(await screen.findByText(/every transaction must balance to zero/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /run ledger invariant checks/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Arabic is not a skin over the English screen: the words come from the bundle, the backend enums
 * come from the shared one, and the document itself flips. Each of those can break on its own, so
 * each is asserted on its own.
 */
describe('ReconciliationPage in Arabic', () => {
  it('reads in Arabic, down to the backend enum the row is named by', async () => {
    renderInArabic('/reconciliation');

    expect(await screen.findByRole('heading', { name: 'التسوية' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'الفروقات' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'فحوصات الدفتر' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مزامنة رصيد الوكيل' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'عدم تطابق رصيد الوكيل' }),
    ).toBeInTheDocument();
  });

  it('flips the document itself, and flips it back for English', async () => {
    const arabic = renderInArabic('/reconciliation');

    expect(await screen.findByRole('heading', { name: 'التسوية' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');

    arabic.unmount();

    renderWithProviders(<ReconciliationPage />, {
      route: '/reconciliation',
      routePath: '/reconciliation',
      validateSearch,
      locale: 'en',
    });

    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('counts two broken invariants with the Arabic dual rather than with English plural', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/invariants/run`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ok: false,
            checkedAt: new Date().toISOString(),
            truncated: false,
            violations: [
              {
                invariant: 'I1_TRANSACTION_BALANCES',
                subject: 'tx-9001',
                currencyCode: 'NSP',
                expectedMinor: '0',
                actualMinor: '250000',
                deltaMinor: '250000',
                detail: 'Credit leg missing.',
              },
              {
                invariant: 'I2_GLOBAL_BALANCE',
                subject: 'NSP',
                currencyCode: 'NSP',
                expectedMinor: '0',
                actualMinor: '-500',
                deltaMinor: '-500',
                detail: 'Currency does not balance.',
              },
            ],
          },
          error: null,
          meta: { correlationId: 'test-dual', timestamp: new Date().toISOString() },
        }),
      ),
    );

    const { user } = renderInArabic('/reconciliation?tab=ledger');

    await user.click(await screen.findByRole('button', { name: 'شغّل فحوصات قواعد الدفتر' }));

    // Two is a form of its own in Arabic: «قاعدتان» rather than the «2 قواعد» an English bundle
    // would have produced, and two is the commonest number on a screen like this one.
    expect(await screen.findByText(/قاعدتان لم تصمدا/)).toBeInTheDocument();
    expect(screen.getByText('كل قيد يوازن إلى صفر')).toBeInTheDocument();
  });
});
