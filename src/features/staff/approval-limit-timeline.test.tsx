import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { formatDate } from '@/lib/format';
import { ADMIN_IDS, mockApprovalLimits } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { ApprovalLimitTimeline } from './approval-limit-timeline';

const reviewerVersions = mockApprovalLimits.filter(
  (limit) => limit.adminUserId === ADMIN_IDS.reviewer,
);

const open = reviewerVersions[0];
const closed = reviewerVersions[1];
if (open === undefined || closed === undefined) throw new Error('fixture limits changed');

describe('ApprovalLimitTimeline', () => {
  it('marks exactly one version as in force and dates the ones that are over', async () => {
    renderPlain(<ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />);

    expect(await screen.findByText('In force now')).toBeInTheDocument();
    expect(screen.getAllByText('In force now')).toHaveLength(1);
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(
      screen.getByText(`${formatDate(closed.effectiveFrom)} — ${formatDate(closed.effectiveTo)}`),
    ).toBeInTheDocument();
  });

  it('shows each version’s money with its currency, never as a bare number', async () => {
    renderPlain(<ApprovalLimitTimeline limits={[open]} adminName="Lina Farah" />);

    expect(await screen.findByText('500,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('2,000,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('300,000.00 NSP')).toBeInTheDocument();
  });

  it('says when a version never asks for a second approver', async () => {
    renderPlain(<ApprovalLimitTimeline limits={[closed]} adminName="Lina Farah" />);

    expect(await screen.findByText('Never — approves alone at any amount')).toBeInTheDocument();
  });

  it('treats no limit at all as the loss of authority it is', async () => {
    renderPlain(<ApprovalLimitTimeline limits={[]} adminName="Lina Farah" />);

    expect(await screen.findByText('No approval limit has ever been set')).toBeInTheDocument();
    expect(screen.getByText(/answers DENIED/)).toBeInTheDocument();
  });

  it('warns that ending the open version revokes authority rather than tidying up', async () => {
    const { user } = renderPlain(
      <ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />,
    );

    await user.click(await screen.findByRole('button', { name: /end this limit/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('no approval limit at all');
    expect(dialog).toHaveTextContent('DENIED');
    expect(dialog).toHaveTextContent('history here is never rewritten');
  });

  it('ends only the version the operator confirmed', async () => {
    const success = vi.spyOn(toast, 'success');
    const { user } = renderPlain(
      <ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />,
    );

    await user.click(await screen.findByRole('button', { name: /end this limit/i }));
    await user.click(await screen.findByRole('button', { name: 'End the limit' }));

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith(
        'Lina Farah now has no approval limit and can approve nothing.',
      );
    });
  });

  it('shows what the API said when ending a limit fails', async () => {
    const failure = vi.spyOn(toast, 'error');
    server.use(
      http.delete(`${config.apiBaseUrl}/v1/admin/approval-limits/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'APPROVAL_LIMIT_NOT_FOUND',
              message: 'That approval limit does not exist.',
            },
            meta: { correlationId: 'test-2', timestamp: new Date().toISOString() },
          },
          { status: 404 },
        ),
      ),
    );

    const { user } = renderPlain(
      <ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />,
    );

    await user.click(await screen.findByRole('button', { name: /end this limit/i }));
    await user.click(await screen.findByRole('button', { name: 'End the limit' }));

    expect(await screen.findByText('That approval limit does not exist.')).toBeInTheDocument();
    expect(failure).toHaveBeenCalled();
  });

  it('leaves the limit alone when the operator backs out', async () => {
    const { user } = renderPlain(
      <ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />,
    );

    await user.click(await screen.findByRole('button', { name: /end this limit/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('In force now')).toBeInTheDocument();
  });

  it('shows an amount it cannot parse as it arrived rather than blanking the screen', async () => {
    renderPlain(
      <ApprovalLimitTimeline
        limits={[{ ...open, maxSingleApproval: '1e6' }]}
        adminName="Lina Farah"
      />,
    );

    expect(await screen.findByText('1e6 NSP')).toBeInTheDocument();
  });

  it('hides the revocation from a finance admin, who may read limits but not set them', async () => {
    renderPlain(<ApprovalLimitTimeline limits={reviewerVersions} adminName="Lina Farah" />, {
      auth: { role: 'FINANCE_ADMIN' },
    });

    expect(await screen.findByText('In force now')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end this limit/i })).not.toBeInTheDocument();
  });
});
