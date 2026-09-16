import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockPaymentMethods } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { MethodFormDialog } from './method-form-dialog';

/**
 * What is worth testing on this form is what it refuses.
 *
 * A method with a maximum below its minimum accepts no deposit at all, an amount with a thousands
 * separator is rejected by the backend rather than by the person typing it, and a code the backend
 * would not accept is a round trip wasted. All three are caught here, on the field that is wrong.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The toast module is mocked for the whole file, so its call log has to be emptied between cases.
beforeEach(() => {
  vi.clearAllMocks();
});

const bank = mockPaymentMethods[0]!;

const renderCreate = () =>
  renderPlain(<MethodFormDialog open onOpenChange={vi.fn()} method={null} />);

async function fillValidMethod(user: ReturnType<typeof renderPlain>['user']) {
  await user.type(screen.getByLabelText('Code'), 'TEST_RAIL');
  await user.type(screen.getByLabelText('Display name'), 'Test rail');
  await user.type(screen.getByLabelText('Currency'), 'NSP');
  await user.type(screen.getByLabelText('Minimum amount'), '100.00');
  await user.type(screen.getByLabelText('Maximum amount'), '200000.00');
}

describe('creating a method', () => {
  it('refuses a code that is not SCREAMING_SNAKE', async () => {
    const { user } = renderCreate();

    await fillValidMethod(user);
    await user.clear(screen.getByLabelText('Code'));
    await user.type(screen.getByLabelText('Code'), 'bank syr');
    await user.click(screen.getByRole('button', { name: /create method/i }));

    expect(await screen.findByText(/SCREAMING_SNAKE_CASE/)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('refuses a maximum below the minimum, on the maximum', async () => {
    const { user } = renderCreate();

    await fillValidMethod(user);
    await user.clear(screen.getByLabelText('Maximum amount'));
    await user.type(screen.getByLabelText('Maximum amount'), '10.00');
    await user.click(screen.getByRole('button', { name: /create method/i }));

    const message = await screen.findByText(/maximum has to be at least the minimum/i);
    expect(message).toBeInTheDocument();
    expect(message).toHaveAttribute('id', 'method-max-error');
  });

  it('refuses an amount that is not a plain decimal', async () => {
    const { user } = renderCreate();

    await fillValidMethod(user);
    await user.clear(screen.getByLabelText('Minimum amount'));
    await user.type(screen.getByLabelText('Minimum amount'), '1,500.00');
    await user.click(screen.getByRole('button', { name: /create method/i }));

    expect(await screen.findByText(/no separators and no currency code/i)).toBeInTheDocument();
  });

  it('refuses more basis points than there are', async () => {
    const { user } = renderCreate();

    await fillValidMethod(user);
    await user.clear(screen.getByLabelText('Percentage fee (basis points)'));
    await user.type(screen.getByLabelText('Percentage fee (basis points)'), '10001');
    await user.click(screen.getByRole('button', { name: /create method/i }));

    expect(await screen.findByText('10000 at most.')).toBeInTheDocument();
  });

  it('sends the normalised amounts and reports the new method', async () => {
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <MethodFormDialog open onOpenChange={onOpenChange} method={null} onSaved={onSaved} />,
    );

    let body: unknown = null;
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/payment-methods`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: { ...bank, id: 'new-id', code: 'TEST_RAIL', displayName: 'Test rail' },
            error: null,
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      }),
    );

    await fillValidMethod(user);
    await user.click(screen.getByRole('button', { name: /create method/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Test rail created',
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(body).toMatchObject({ code: 'TEST_RAIL', minAmount: '100.00', maxAmount: '200000.00' });
  });

  it('says so, twice, when the backend refuses', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/payment-methods`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'PAYMENT_METHOD_ALREADY_EXISTS', message: 'That code is taken.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderCreate();

    await fillValidMethod(user);
    await user.click(screen.getByRole('button', { name: /create method/i }));

    expect(await screen.findByText('That code is taken.')).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not create the method',
        expect.objectContaining({ description: 'That code is taken.' }),
      );
    });
  });
});

describe('editing a method', () => {
  it('locks the code, the rail and the currency, and says why each one is locked', () => {
    renderPlain(<MethodFormDialog open onOpenChange={vi.fn()} method={bank} />);

    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Currency' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Rail' })).toBeNull();

    expect(screen.getByText(bank.code)).toBeInTheDocument();
    expect(screen.getByText('Bank transfer', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(bank.currencyCode)).toBeInTheDocument();

    expect(screen.getByText(/would orphan them/i)).toBeInTheDocument();
    expect(screen.getByText(/a different one is a different method/i)).toBeInTheDocument();
    expect(screen.getByText(/ledger already holds this method/i)).toBeInTheDocument();
  });

  it('still lets everything else through', async () => {
    const { user } = renderPlain(<MethodFormDialog open onOpenChange={vi.fn()} method={bank} />);

    expect(screen.getByLabelText('Display name')).toHaveValue(bank.displayName);
    expect(screen.getByLabelText('Minimum amount')).toHaveValue(bank.minAmount);

    await user.clear(screen.getByLabelText('Maximum amount'));
    await user.type(screen.getByLabelText('Maximum amount'), '9000000');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        `${bank.displayName} saved`,
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });
});
