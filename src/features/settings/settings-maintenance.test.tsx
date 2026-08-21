import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { SettingsMaintenance } from './settings-maintenance';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SWEEP_PATH = `${config.apiBaseUrl}/v1/admin/deposits/maintenance/sweep`;

const sweepReturns = (report: { expired: number; released: number; reaped: number }) => {
  server.use(
    http.post(SWEEP_PATH, () =>
      HttpResponse.json({
        success: true,
        data: report,
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

const sweepFails = () => {
  server.use(
    http.post(SWEEP_PATH, () =>
      HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'The sweep job is already running.' },
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        },
        { status: 500 },
      ),
    ),
  );
};

/** Both the trigger and the dialog's confirm say "Run sweep"; this is the one inside the dialog. */
const confirmButton = async () =>
  within(await screen.findByRole('dialog')).getByRole('button', { name: /run sweep/i });

describe('SettingsMaintenance', () => {
  it('is not offered to a role that cannot sweep', () => {
    renderPlain(<SettingsMaintenance />, { auth: { role: 'REVIEWER' } });

    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run sweep/i })).not.toBeInTheDocument();
  });

  it('is offered to finance, which the backend allows to sweep', () => {
    renderPlain(<SettingsMaintenance />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(screen.getByRole('button', { name: /run sweep/i })).toBeInTheDocument();
  });

  it('asks before writing to the live queue', async () => {
    const { user } = renderPlain(<SettingsMaintenance />);

    await user.click(screen.getByRole('button', { name: /run sweep/i }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(/cannot be undone/i);
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('reports each count with what it counted', async () => {
    sweepReturns({ expired: 3, released: 2, reaped: 1 });
    const { user } = renderPlain(<SettingsMaintenance />);

    await user.click(screen.getByRole('button', { name: /run sweep/i }));
    await user.click(await confirmButton());

    expect(await screen.findByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(
      screen.getByText('Claims a reviewer never came back to, handed back to the queue.'),
    ).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Sweep finished', {
      description: '3 expired, 2 released, 1 reaped.',
    });
  });

  it('keeps the dialog honest when the sweep fails, and says why', async () => {
    sweepFails();
    const { user } = renderPlain(<SettingsMaintenance />);

    await user.click(screen.getByRole('button', { name: /run sweep/i }));
    await user.click(await confirmButton());

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('The sweep did not run', {
        description: 'The sweep job is already running.',
      });
    });
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });
});
