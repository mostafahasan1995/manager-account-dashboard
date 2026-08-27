import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { BREAK_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { ResolveBreakDialog } from './resolve-break-dialog';

const render = (onOpenChange = vi.fn()) => {
  const result = renderPlain(
    <>
      <Toaster />
      <ResolveBreakDialog
        breakId={BREAK_IDS.floatMismatch}
        breakLabel="Agent float mismatch · severity 4"
        open
        onOpenChange={onOpenChange}
      />
    </>,
  );
  return { ...result, onOpenChange };
};

describe('ResolveBreakDialog', () => {
  it('refuses to close a break without a note', async () => {
    const { user, onOpenChange } = render();

    await user.click(await screen.findByRole('button', { name: 'Close break' }));

    expect(await screen.findByText('A resolution note is required.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('refuses a note that is only whitespace', async () => {
    const { user, onOpenChange } = render();

    await user.type(screen.getByLabelText('Resolution note'), '   ');
    await user.click(screen.getByRole('button', { name: 'Close break' }));

    expect(await screen.findByText('A resolution note is required.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('spells out what each closing status means', async () => {
    render();

    expect(
      await screen.findByText('The difference was explained and corrected.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real money is missing and we are accepting the loss.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('There was never a difference; the check was wrong.'),
    ).toBeInTheDocument();
  });

  it('closes a break as resolved and says so', async () => {
    const { user, onOpenChange } = render();

    await user.type(screen.getByLabelText('Resolution note'), 'Matched to the bank statement.');
    await user.click(screen.getByRole('button', { name: 'Close break' }));

    expect(await screen.findByText(/closed as resolved/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('asks a second time before writing money off', async () => {
    const { user, onOpenChange } = render();

    await user.click(screen.getByRole('radio', { name: 'Written off' }));
    await user.type(
      screen.getByLabelText('Resolution note'),
      'Unrecoverable after three attempts.',
    );
    await user.click(screen.getByRole('button', { name: 'Close break' }));

    expect(await screen.findByText('This accepts a real loss')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Write it off' }));

    expect(await screen.findByText(/closed as written off/i)).toBeInTheDocument();
  });

  it('lets the operator step back out of the write-off confirmation', async () => {
    const { user } = render();

    await user.click(screen.getByRole('radio', { name: 'Written off' }));
    await user.type(screen.getByLabelText('Resolution note'), 'Thinking about it.');
    await user.click(screen.getByRole('button', { name: 'Close break' }));

    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await screen.findByLabelText('Resolution note')).toHaveValue('Thinking about it.');
  });

  it('keeps the dialog open and reports the failure when the backend refuses', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks/:id/resolve`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'BREAK_NOT_FOUND', message: 'Break not found.' },
            meta: { correlationId: 'test-2', timestamp: new Date().toISOString() },
          },
          { status: 404 },
        ),
      ),
    );

    const { user, onOpenChange } = render();

    await user.type(screen.getByLabelText('Resolution note'), 'Explained by the statement.');
    await user.click(screen.getByRole('button', { name: 'Close break' }));

    expect(await screen.findByText('Could not close the break')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
