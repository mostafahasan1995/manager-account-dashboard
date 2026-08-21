import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { ADMIN_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { SetLimitDialog } from './set-limit-dialog';

const props = {
  adminUserId: ADMIN_IDS.reviewer,
  adminName: 'Lina Farah',
  defaultCurrency: 'NSP',
};

/** Captures the posted body so a test can prove the amounts crossed the wire as typed. */
function capturePost(): { body: () => unknown } {
  let captured: unknown = null;
  server.use(
    http.post(
      `${config.apiBaseUrl}/v1/admin/admins/:id/approval-limits`,
      async ({ request, params }) => {
        captured = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 'limit-new',
              adminUserId: String(params.id),
              currencyCode: 'NSP',
              maxSingleApproval: '750000.00',
              maxDailyApproval: '3000000.00',
              secondApprovalAbove: null,
              effectiveFrom: new Date().toISOString(),
              effectiveTo: null,
              createdAt: new Date().toISOString(),
            },
            error: null,
            meta: { correlationId: 'test-3', timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      },
    ),
  );
  return { body: () => captured };
}

describe('SetLimitDialog', () => {
  it('says up front that this closes the version in force rather than editing it', async () => {
    renderPlain(<SetLimitDialog open onOpenChange={vi.fn()} {...props} />);

    expect(
      await screen.findByText('This closes the current version, it does not edit it'),
    ).toBeInTheDocument();
    expect(screen.getByText(/history here is never rewritten/i)).toBeInTheDocument();
  });

  it('refuses a grouped amount rather than posting something the backend will reject', async () => {
    const { user } = renderPlain(<SetLimitDialog open onOpenChange={vi.fn()} {...props} />);

    await user.type(await screen.findByLabelText('Max single approval'), '1,500.00');
    await user.type(screen.getByLabelText('Max daily approval'), '9000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    expect(
      await screen.findByText(/Max single approval must be a plain decimal amount/i),
    ).toBeInTheDocument();
  });

  it('refuses a negative limit', async () => {
    const { user } = renderPlain(<SetLimitDialog open onOpenChange={vi.fn()} {...props} />);

    await user.type(await screen.findByLabelText('Max single approval'), '500.00');
    await user.type(screen.getByLabelText('Max daily approval'), '-9000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    expect(await screen.findByText('Max daily approval cannot be negative.')).toBeInTheDocument();
  });

  it('refuses a second-approval threshold that is not an amount, but allows a blank one', async () => {
    const { user } = renderPlain(<SetLimitDialog open onOpenChange={vi.fn()} {...props} />);

    await user.type(await screen.findByLabelText('Max single approval'), '500.00');
    await user.type(screen.getByLabelText('Max daily approval'), '9000.00');
    await user.type(screen.getByLabelText('Second approval above'), 'lots');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    expect(
      await screen.findByText(
        'The second-approval threshold must be a plain decimal amount, or blank for never.',
      ),
    ).toBeInTheDocument();
  });

  it('insists on a currency code', async () => {
    const { user } = renderPlain(
      <SetLimitDialog open onOpenChange={vi.fn()} {...props} defaultCurrency="" />,
    );

    await user.type(await screen.findByLabelText('Max single approval'), '500.00');
    await user.type(screen.getByLabelText('Max daily approval'), '9000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    expect(
      await screen.findByText('A three-letter currency code, for example NSP.'),
    ).toBeInTheDocument();
  });

  it('hands the amounts to the API exactly as they were typed', async () => {
    const captured = capturePost();
    const success = vi.spyOn(toast, 'success');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(
      <SetLimitDialog open onOpenChange={onOpenChange} {...props} defaultCurrency="nsp" />,
    );

    await user.type(await screen.findByLabelText('Max single approval'), '750000.00');
    await user.type(screen.getByLabelText('Max daily approval'), '3000000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(captured.body()).toEqual({
      currencyCode: 'NSP',
      maxSingleApproval: '750000.00',
      maxDailyApproval: '3000000.00',
    });
    expect(success).toHaveBeenCalledWith('New approval limit in force for Lina Farah.');
  });

  it('sends the second-approval threshold when one was given', async () => {
    const captured = capturePost();
    const { user } = renderPlain(<SetLimitDialog open onOpenChange={vi.fn()} {...props} />);

    await user.type(await screen.findByLabelText('Max single approval'), '750000.00');
    await user.type(screen.getByLabelText('Max daily approval'), '3000000.00');
    await user.type(screen.getByLabelText('Second approval above'), '400000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    await waitFor(() => {
      expect(captured.body()).toEqual({
        currencyCode: 'NSP',
        maxSingleApproval: '750000.00',
        maxDailyApproval: '3000000.00',
        secondApprovalAbove: '400000.00',
      });
    });
  });

  it('shows the API refusal instead of pretending the limit was set', async () => {
    const failure = vi.spyOn(toast, 'error');
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/admins/:id/approval-limits`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'VALIDATION_FAILED', message: 'Currency NSP is not enabled here.' },
            meta: { correlationId: 'test-4', timestamp: new Date().toISOString() },
          },
          { status: 400 },
        ),
      ),
    );

    const onOpenChange = vi.fn();
    const { user } = renderPlain(<SetLimitDialog open onOpenChange={onOpenChange} {...props} />);

    await user.type(await screen.findByLabelText('Max single approval'), '750000.00');
    await user.type(screen.getByLabelText('Max daily approval'), '3000000.00');
    await user.click(screen.getByRole('button', { name: /close current version/i }));

    expect(await screen.findByText('Currency NSP is not enabled here.')).toBeInTheDocument();
    expect(failure).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
