import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { ADMIN_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { StaffDetailPage } from './staff-detail-page';

const DETAIL_ROUTE = '/staff/$adminId';

const renderDetail = (adminId: string, role: AdminRole = 'SUPER_ADMIN') =>
  renderWithProviders(<StaffDetailPage />, {
    route: `/staff/${adminId}`,
    routePath: DETAIL_ROUTE,
    auth: { role },
  });

describe('StaffDetailPage', () => {
  it('shows who the administrator is and what their role means', async () => {
    renderDetail(ADMIN_IDS.reviewer);

    expect(await screen.findByRole('heading', { name: 'Lina Farah' })).toBeInTheDocument();
    expect(screen.getByText('700000003')).toBeInTheDocument();
    expect(screen.getByText('Username').parentElement).toHaveTextContent('@lina_review');
    expect(
      screen.getByText('Reviews and decides deposits. Cannot change rails or staff.'),
    ).toBeInTheDocument();
  });

  it('renders the approval limits as a history, not as one editable row', async () => {
    renderDetail(ADMIN_IDS.reviewer);

    expect(await screen.findByText('In force now')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText('500,000.00 NSP')).toBeInTheDocument();
  });

  it('gives a finance admin the record and none of the controls that change it', async () => {
    renderDetail(ADMIN_IDS.reviewer, 'FINANCE_ADMIN');

    expect(await screen.findByRole('heading', { name: 'Lina Farah' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set a new limit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end this limit/i })).not.toBeInTheDocument();
  });

  it('gives a super admin the controls a finance admin cannot have', async () => {
    renderDetail(ADMIN_IDS.reviewer);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set a new limit/i })).toBeInTheDocument();
  });

  it('flags a deposit decider who has no limit in force at all', async () => {
    renderDetail(ADMIN_IDS.superAdmin);

    expect(await screen.findByText('No approval limit is in force')).toBeInTheDocument();
    expect(screen.getByText(/comes back DENIED until a limit is set/i)).toBeInTheDocument();
    expect(screen.getByText('No approval limit has ever been set')).toBeInTheDocument();
  });

  it('does not nag about a missing limit for a role that never decides deposits', async () => {
    renderDetail(ADMIN_IDS.viewer);

    expect(await screen.findByRole('heading', { name: 'Audit Read-only' })).toBeInTheDocument();
    expect(screen.queryByText('No approval limit is in force')).not.toBeInTheDocument();
    expect(screen.getByText(/This role does not decide deposits/i)).toBeInTheDocument();
    expect(screen.getByText('Never signed in')).toBeInTheDocument();
  });

  it('surfaces the self-modification refusal in the API’s own words', async () => {
    const { user } = renderDetail(ADMIN_IDS.superAdmin);

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('You cannot deactivate yourself.')).toBeInTheDocument();
    expect(
      screen.getByText(/Nobody edits or deactivates their own administrator record/i),
    ).toBeInTheDocument();
  });

  it('deactivates an administrator who is not the one signed in', async () => {
    const { user } = renderDetail(ADMIN_IDS.support);

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(screen.getByText('Account').parentElement).toHaveTextContent('Deactivated');
    });
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('opens the edit form on the record it is showing', async () => {
    const { user } = renderDetail(ADMIN_IDS.reviewer);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(await screen.findByLabelText('Display name')).toHaveValue('Lina Farah');
  });

  it('opens the new-limit form already warning what it will do', async () => {
    const { user } = renderDetail(ADMIN_IDS.reviewer);

    await user.click(await screen.findByRole('button', { name: /set a new limit/i }));

    expect(
      await screen.findByText('This closes the current version, it does not edit it'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toHaveValue('NSP');
  });

  it('does not claim there is no limit when the limits failed to load', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/admins/:id/approval-limits`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'Approval limits are unavailable.' },
            meta: { correlationId: 'test-6', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    renderDetail(ADMIN_IDS.superAdmin);

    expect(await screen.findByText('Approval limits are unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No approval limit is in force')).not.toBeInTheDocument();
  });

  it('shows a load failure as a failure rather than an empty record, and can retry', async () => {
    server.use(
      http.get(
        `${config.apiBaseUrl}/v1/admin/admins/:id`,
        () =>
          HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'INTERNAL_ERROR', message: 'The record is unavailable.' },
              meta: { correlationId: 'test-7', timestamp: new Date().toISOString() },
            },
            { status: 500 },
          ),
        { once: true },
      ),
    );

    const { user } = renderDetail(ADMIN_IDS.reviewer);

    expect(await screen.findByText('The record is unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'Lina Farah' })).toBeInTheDocument();
  });

  it('says so when the administrator does not exist', async () => {
    renderDetail('aaaaaaaa-0000-4000-8000-000000009999');

    expect(await screen.findByText('Admin not found.')).toBeInTheDocument();
  });

  it('shows a manager with no Telegram account plainly, and that a console password is set', async () => {
    renderDetail(ADMIN_IDS.noTelegram);

    expect(await screen.findByRole('heading', { name: 'Maya Console' })).toBeInTheDocument();
    expect(screen.getByText('No Telegram account')).toBeInTheDocument();
    expect(screen.getByText('Console password').parentElement).toHaveTextContent('Set');
  });

  it('points back at the directory when the URL names nobody', async () => {
    renderWithProviders(<StaffDetailPage />, { route: '/staff', routePath: '/staff' });

    expect(await screen.findByText('This link does not name an administrator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to staff' })).toBeInTheDocument();
  });
});
