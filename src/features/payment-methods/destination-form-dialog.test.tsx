import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockDestinations, mockPaymentMethods } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { DestinationFormDialog } from './destination-form-dialog';

/**
 * The account identifier is the one value on this screen that costs real money when it is wrong, so
 * the tests that matter are the ones about it: it cannot be left blank, and once a destination
 * exists it cannot be edited at all — with the reason on screen rather than in a commit message.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The toast module is mocked for the whole file, so its call log has to be emptied between cases.
beforeEach(() => {
  vi.clearAllMocks();
});

const bank = mockPaymentMethods[0]!;
const primary = mockDestinations[0]!;

const renderCreate = (onOpenChange = vi.fn()) =>
  renderPlain(
    <DestinationFormDialog open onOpenChange={onOpenChange} method={bank} destination={null} />,
  );

describe('adding a destination', () => {
  it('will not take a blank label or a blank account', async () => {
    const { user } = renderCreate();

    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText(/cashiers pick this account by its label/i)).toBeInTheDocument();
    expect(await screen.findByText(/it cannot be blank/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('refuses a cap that is not a plain decimal', async () => {
    const { user } = renderCreate();

    await user.type(screen.getByLabelText('Label'), 'Overflow');
    await user.type(screen.getByLabelText('Account identifier'), 'SY84 0000');
    await user.type(screen.getByLabelText('Daily cap'), '20,000.00');
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText(/or leave it empty for no cap/i)).toBeInTheDocument();
  });

  it('sends the account exactly as it was typed, and leaves an empty cap out', async () => {
    let body: unknown = null;
    server.use(
      http.post(
        `${config.apiBaseUrl}/v1/admin/payment-methods/:id/destinations`,
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            {
              success: true,
              data: { ...primary, id: 'new-id', label: 'Overflow two' },
              error: null,
              meta: { correlationId: 'test', timestamp: new Date().toISOString() },
            },
            { status: 201 },
          );
        },
      ),
    );
    const onOpenChange = vi.fn();
    const { user } = renderCreate(onOpenChange);

    await user.type(screen.getByLabelText('Label'), 'Overflow two');
    await user.type(screen.getByLabelText('Account identifier'), 'SY84 0000 0000 0009 8765');
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Overflow two added',
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
    expect(body).toMatchObject({
      label: 'Overflow two',
      accountIdentifier: 'SY84 0000 0000 0009 8765',
      priority: 1,
    });
    expect(body).not.toHaveProperty('dailyCap');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reports a refusal in the dialog and in a toast', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/payment-methods/:id/destinations`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'VALIDATION_FAILED', message: 'That account is already listed.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderCreate();

    await user.type(screen.getByLabelText('Label'), 'Duplicate');
    await user.type(screen.getByLabelText('Account identifier'), '0999-000-111');
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText('That account is already listed.')).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not add the destination',
        expect.objectContaining({ description: 'That account is already listed.' }),
      );
    });
  });
});

describe('editing a destination', () => {
  it('locks the account identifier and says it would redirect real money', () => {
    renderPlain(
      <DestinationFormDialog open onOpenChange={vi.fn()} method={bank} destination={primary} />,
    );

    expect(screen.queryByRole('textbox', { name: /account identifier/i })).toBeNull();
    expect(screen.getByText(primary.accountIdentifier)).toBeInTheDocument();
    expect(screen.getByText(/silently redirect players/i)).toBeInTheDocument();
  });

  it('saves the rest of the row without touching the account', async () => {
    let body: unknown = null;
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/payment-destinations/:id`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: { ...primary, priority: 4 },
            error: null,
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 200 },
        );
      }),
    );
    const { user } = renderPlain(
      <DestinationFormDialog open onOpenChange={vi.fn()} method={bank} destination={primary} />,
    );

    await user.clear(screen.getByLabelText('Priority'));
    await user.type(screen.getByLabelText('Priority'), '4');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        `${primary.label} saved`,
        expect.objectContaining({ description: 'The account number itself is unchanged.' }),
      );
    });
    expect(body).toMatchObject({ priority: 4 });
    expect(body).not.toHaveProperty('accountIdentifier');
  });
});
