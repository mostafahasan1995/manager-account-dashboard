import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { tenantSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { mockPlatformDefaults, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { TenantsPage } from './tenants-page';

const ROUTE_PATH = '/tenants';

const validateSearch = (search: Record<string, unknown>) => tenantSearchSchema.parse(search);

const renderPage = (
  route = ROUTE_PATH,
  role: 'PLATFORM_ADMIN' | 'REVIEWER' = 'PLATFORM_ADMIN',
  locale: Locale = 'en',
) =>
  renderWithProviders(<TenantsPage />, {
    route,
    routePath: ROUTE_PATH,
    validateSearch,
    auth: { role },
    locale,
  });

const listEnvelope = (tenants: unknown[]) =>
  HttpResponse.json(
    {
      success: true,
      data: { tenants },
      error: null,
      meta: { correlationId: 'test', timestamp: '' },
    },
    { status: 200 },
  );

describe('TenantsPage', () => {
  it('lists every tenant the platform has', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /main operation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /northern branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pilot operator/i })).toBeInTheDocument();
  });

  it('says what this screen is for, and where the operator picker lives', async () => {
    renderPage();

    expect(await screen.findByText('Every operator on the platform')).toBeInTheDocument();
    expect(screen.getByText(/operator picker in the top bar/i)).toBeInTheDocument();
  });

  it('handles a tenant the backend sent without counts', async () => {
    const { counts: _counts, ...uncounted } = mockTenants[0]!;
    server.use(http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () => listEnvelope([uncounted])));

    renderPage();

    expect(await screen.findByRole('button', { name: /main operation/i })).toBeInTheDocument();
    expect(screen.getAllByText('not counted')).toHaveLength(2);
  });

  it('filters by the status in the URL', async () => {
    renderPage(`${ROUTE_PATH}?status=SUSPENDED`);

    expect(await screen.findByRole('button', { name: /pilot operator/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /main operation/i })).not.toBeInTheDocument();
  });

  it('puts a chosen status filter into the URL and clears it again', async () => {
    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Suspended' }));

    await waitFor(() => {
      expect(location()).toContain('status=SUSPENDED');
    });
    expect(screen.queryByRole('button', { name: /main operation/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expect(location()).not.toContain('status=');
    });
    expect(screen.getByRole('button', { name: /main operation/i })).toBeInTheDocument();
  });

  it('offers a way back when the filter hides everything', async () => {
    const { user, location } = renderPage(`${ROUTE_PATH}?status=CLOSED`);

    expect(await screen.findByText('No tenants with that status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all tenants' }));

    await waitFor(() => {
      expect(location()).not.toContain('status=');
    });
    expect(screen.getByRole('button', { name: /main operation/i })).toBeInTheDocument();
  });

  it('says there is nothing here rather than showing an empty table', async () => {
    server.use(http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () => listEnvelope([])));

    renderPage();

    expect(await screen.findByText('No tenants yet')).toBeInTheDocument();
    expect(screen.getByText(/one Telegram bot, one Ichancy agent/i)).toBeInTheDocument();
  });

  it('shows the failure and offers a retry when the list does not load', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The platform database is unreachable.' },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(await screen.findByText('The platform database is unreachable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('retries the list when asked', async () => {
    let calls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                success: false,
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'The platform database is unreachable.' },
                meta: { correlationId: 'test', timestamp: '' },
              },
              { status: 500 },
            )
          : listEnvelope(mockTenants);
      }),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('button', { name: /main operation/i })).toBeInTheDocument();
  });

  it('starts the first tenant from the empty state', async () => {
    server.use(http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () => listEnvelope([])));

    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: /new tenant/i }));

    await waitFor(() => {
      expect(location()).toContain('create=true');
    });
    expect(await screen.findByRole('heading', { name: 'New tenant' })).toBeInTheDocument();
  });

  it('forgets the selection when the panel is closed', async () => {
    const { user, location } = renderPage(`${ROUTE_PATH}?selected=${mockTenants[0]!.id}`);

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(location()).not.toContain('selected=');
    });
  });

  it('edits from the panel and comes back to the tenant it just saved', async () => {
    const { user, location } = renderPage(`${ROUTE_PATH}?selected=${mockTenants[0]!.id}`);

    await user.click(await screen.findByRole('button', { name: /edit settings/i }));

    const displayName = await screen.findByLabelText('Display name');
    await user.clear(displayName);
    await user.type(displayName, 'Main operation (east)');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(location()).toContain(`selected=${mockTenants[0]!.id}`);
    });
    expect(
      await screen.findByRole('heading', { name: 'Main operation (east)' }),
    ).toBeInTheDocument();
  });

  it('opens the tenant in a panel and puts it in the URL', async () => {
    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: /northern branch/i }));

    await waitFor(() => {
      expect(location()).toContain(`selected=${mockTenants[1]!.id}`);
    });
    expect(await screen.findByText('agent_north')).toBeInTheDocument();
  });

  it('opens the create form straight from the URL', async () => {
    renderPage(`${ROUTE_PATH}?create=true`);

    expect(await screen.findByRole('heading', { name: 'New tenant' })).toBeInTheDocument();
    expect(screen.getByText('This tenant will be created suspended')).toBeInTheDocument();
  });

  it('opens the create form from the header button', async () => {
    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: /new tenant/i }));

    await waitFor(() => {
      expect(location()).toContain('create=true');
    });
    expect(await screen.findByRole('heading', { name: 'New tenant' })).toBeInTheDocument();
  });

  /**
   * The create form asks for four fields; the server resolves the other nine and answers with the
   * full row. This is the case that proves the console reads the answer rather than echoing the
   * form: nothing asserted below was typed into it.
   */
  it('creates an operator from four fields and shows what the server filled in', async () => {
    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: /new tenant/i }));
    expect(await screen.findByRole('heading', { name: 'New tenant' })).toBeInTheDocument();

    for (const [label, value] of Object.entries({
      'Display name': 'Harbour kiosk',
      'Bot token': '8123456789:AAG7hZ2q-Xk_9pLmN4rTvBcD1eFgHiJkLmN',
      'Ichancy username': 'agent_harbour',
      'Ichancy password': 'never-returned',
    })) {
      await user.click(screen.getByLabelText(label));
      await user.paste(value);
    }
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    // The panel opens on the row that was just written, with the resolved values on it.
    expect(await screen.findByRole('heading', { name: 'Harbour kiosk' })).toBeInTheDocument();
    const panel = within(screen.getByRole('dialog', { name: /harbour kiosk/i }));
    expect(panel.getByText('Slug harbour-kiosk')).toBeInTheDocument();
    // No staff group was named, so none was invented: the panel says so in red (2026-09-15).
    expect(panel.getByText('No staff group yet')).toBeInTheDocument();
    expect(panel.getByText('Not bound')).toBeInTheDocument();
    expect(panel.getByText(mockPlatformDefaults.currencyCode)).toBeInTheDocument();
    expect(panel.getByText('500,000.00 NSP')).toBeInTheDocument();
    expect(panel.getByText('30 minutes')).toBeInTheDocument();
    await waitFor(() => {
      expect(location()).toContain('selected=');
    });

    // What provisioning managed, read out of the create response — including the old players.
    // The mock cannot activate (no Ichancy), so the import never ran, and the report says so
    // instead of claiming zero players were found.
    const title = await screen.findByText(/Harbour kiosk was created/);
    const report = within(title.closest('[role="status"]')!);
    expect(report.getByText('Webhook registered with Telegram.')).toBeInTheDocument();
    expect(report.getByText('4 payment methods provisioned.')).toBeInTheDocument();
    expect(
      report.getByText(
        /Players were not imported: Players were not imported: the operator was not activated/,
      ),
    ).toBeInTheDocument();
    expect(report.getByText(/still points at a placeholder account/)).toBeInTheDocument();

    // The detail panel opened on the new row is modal; the report waits behind it until it closes.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Harbour kiosk was created/)).not.toBeInTheDocument();
  });

  it('hides the create button from a role that cannot manage tenants', async () => {
    renderPage(ROUTE_PATH, 'REVIEWER');

    expect(await screen.findByRole('button', { name: /main operation/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new tenant/i })).not.toBeInTheDocument();
  });
});

/**
 * Arabic is not a skin over an English screen: the strings change, the document mirrors, and a
 * count of two takes a form English has no word for. Each of those is a different way this screen
 * could ship half-translated, so each gets its own case.
 */
describe('TenantsPage in Arabic', () => {
  it('renders its own strings in Arabic, not only the shared chrome', async () => {
    renderPage(ROUTE_PATH, 'PLATFORM_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'المشغّلون' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مشغّل جديد' })).toBeInTheDocument();
    expect(screen.getByText('كل المشغّلين على المنصّة')).toBeInTheDocument();
    // The status filters come from the shared enum table, so the two halves must agree on screen.
    expect(screen.getByRole('button', { name: 'موقوف' })).toBeInTheDocument();
  });

  it('mirrors the document in Arabic and leaves it reading left to right in English', async () => {
    const { unmount } = renderPage(ROUTE_PATH, 'PLATFORM_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'المشغّلون' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    unmount();

    renderPage(ROUTE_PATH, 'PLATFORM_ADMIN', 'en');

    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it("counts two rows with Arabic's dual, which English has no form for", async () => {
    // Two of the three fixtures are ACTIVE, and two is the count a filtered table lands on most.
    renderPage(`${ROUTE_PATH}?status=ACTIVE`, 'PLATFORM_ADMIN', 'ar');

    expect(await screen.findByText(/مشغّلان/)).toBeInTheDocument();
    expect(screen.queryByText(/2 مشغّل/)).not.toBeInTheDocument();
  });
});
