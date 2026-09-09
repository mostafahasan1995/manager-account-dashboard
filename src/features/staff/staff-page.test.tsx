import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { staffSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { StaffPage } from './staff-page';

const STAFF_ROUTE = '/staff';

const renderStaff = (
  route = STAFF_ROUTE,
  role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' = 'SUPER_ADMIN',
  locale?: Locale,
) =>
  renderWithProviders(<StaffPage />, {
    route,
    routePath: STAFF_ROUTE,
    validateSearch: (search) => staffSearchSchema.parse(search),
    auth: { role },
    ...(locale === undefined ? {} : { locale }),
  });

describe('StaffPage', () => {
  it('lists the directory and says what a platform admin is not', async () => {
    renderStaff();

    expect(await screen.findByRole('link', { name: 'Nour Haddad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sami Aziz' })).toBeInTheDocument();
    expect(screen.getByText(/Platform admin is not a larger super admin/i)).toBeInTheDocument();
  });

  it('lets a super admin add an administrator', async () => {
    const { user } = renderStaff();

    await user.click(await screen.findByRole('button', { name: /add administrator/i }));

    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
  });

  it('gives a finance admin the whole directory and not one write control', async () => {
    renderStaff(STAFF_ROUTE, 'FINANCE_ADMIN');

    expect(await screen.findByRole('link', { name: 'Nour Haddad' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add administrator/i })).not.toBeInTheDocument();
  });

  it('flags the administrator who can decide deposits but has no limit in force', async () => {
    renderStaff();

    const table = await screen.findByRole('table');
    await waitFor(() => {
      expect(within(table).getAllByText('No approval limit')).toHaveLength(1);
    });

    const flaggedRow = within(table).getByText('No approval limit').closest('tr');
    expect(flaggedRow).not.toBeNull();
    expect(within(flaggedRow as HTMLElement).getByRole('link')).toHaveTextContent('Nour Haddad');
  });

  it('narrows the directory to the role named in the URL', async () => {
    renderStaff(`${STAFF_ROUTE}?role=REVIEWER`);

    expect(await screen.findByRole('link', { name: 'Lina Farah' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nour Haddad' })).not.toBeInTheDocument();
  });

  it('puts a filter the operator picks into the URL rather than into component state', async () => {
    const { user, location } = renderStaff();

    await screen.findByRole('table');
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Support' }));

    await waitFor(() => {
      expect(location()).toContain('role=SUPPORT');
    });
  });

  it('offers a way out when the filters match nobody', async () => {
    const { user, location } = renderStaff(`${STAFF_ROUTE}?role=PLATFORM_ADMIN&isActive=false`);

    expect(await screen.findByText('No administrator matches these filters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show the whole directory' }));
    await waitFor(() => {
      expect(location()).not.toContain('role=');
    });
  });

  it('pages through the directory by writing the offset to the URL', async () => {
    const { user, location } = renderStaff(`${STAFF_ROUTE}?limit=2`);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(location()).toContain('offset=2');
    });
  });

  it('shows a failed load as a failure, and recovers when told to try again', async () => {
    server.use(
      http.get(
        `${config.apiBaseUrl}/v1/admin/admins`,
        () =>
          HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'The directory is unavailable.' },
              meta: { correlationId: 'test-5', timestamp: new Date().toISOString() },
            },
            { status: 500 },
          ),
        { once: true },
      ),
    );

    const { user } = renderStaff();

    expect(await screen.findByText('The directory is unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('link', { name: 'Nour Haddad' })).toBeInTheDocument();
  });
});

/**
 * Arabic is not a skin on the English screen. These three cases check the three ways it can be got
 * wrong: English text left behind, a layout that never mirrored, and a count that borrowed English's
 * two plural forms for a language that has six.
 */
describe('StaffPage in Arabic', () => {
  it('puts the directory on screen in Arabic', async () => {
    renderStaff(STAFF_ROUTE, 'SUPER_ADMIN', 'ar');

    // The names are data, so they read the same in both languages — and waiting on one proves the
    // directory itself landed rather than only the page around it.
    expect(await screen.findByRole('link', { name: 'Nour Haddad' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الموظفون' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة مدير' })).toBeInTheDocument();
    expect(screen.getByText(/مدير المنصّة ليس مديراً عاماً أكبر/)).toBeInTheDocument();
  });

  it('mirrors the document in Arabic and leaves it unmirrored in English', async () => {
    const arabic = renderStaff(STAFF_ROUTE, 'SUPER_ADMIN', 'ar');

    await screen.findByRole('heading', { name: 'الموظفون' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    arabic.unmount();

    renderStaff(STAFF_ROUTE, 'SUPER_ADMIN', 'en');

    await screen.findByRole('heading', { name: 'Staff' });
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('counts two administrators with the dual, which English does not have', async () => {
    renderStaff(`${STAFF_ROUTE}?limit=2`, 'SUPER_ADMIN', 'ar');

    expect(
      await screen.findByText('مديران، ودور كل منهما وصلاحيته في الموافقة.'),
    ).toBeInTheDocument();
  });
});
