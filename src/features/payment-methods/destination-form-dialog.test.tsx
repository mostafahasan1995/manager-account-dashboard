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

/** Tether’s own contracts — real, well-formed addresses on each chain. */
const TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM = '0x55d398326f99059ff775485246999027b3197955';

/**
 * The operator's own crypto rail, exactly as they created it: code `USDT`, not `USDT_TRC20`.
 *
 * That difference used to decide everything. The form looked the code up in a table of the two
 * codes this system seeds, missed, and applied NO address check at all — on the one field in this
 * console that cannot be corrected afterwards. The rail is what it keys on now.
 */
const operatorUsdt = {
  ...bank,
  id: 'operator-usdt',
  code: 'USDT',
  displayName: 'usdt trc20',
  rail: 'CRYPTO' as const,
};

const renderCryptoCreate = (onOpenChange = vi.fn()) =>
  renderPlain(
    <DestinationFormDialog
      open
      onOpenChange={onOpenChange}
      method={operatorUsdt}
      destination={null}
    />,
  );

describe('pasting a wallet address on a chain rail', () => {
  /*
   * This address is where every player on the rail is told to send money, it cannot be edited once
   * saved, and a wrong one does not fail — the transfer succeeds, into a stranger’s wallet, and
   * keeps succeeding. So the form has two jobs the backend cannot do for it: catch the mistake
   * BEFORE Save, and make somebody look at the address while looking is still free.
   */

  it('checks the address on a rail the operator named themselves, not one the seeder named', async () => {
    // The whole of bug 1 in one case: this method is coded `USDT`, so the old code table said "not
    // a chain rail" and let an IBAN through as a USDT payout address.
    const { user } = renderCryptoCreate();

    await user.type(screen.getByLabelText('Label'), 'My USDT wallet');
    await user.type(screen.getByLabelText('Account identifier'), 'SY84 0000 0000 0001 2345');
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText(/this is not a wallet address/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('refuses the seed placeholder, which is a hole where an address should be', async () => {
    const { user } = renderCryptoCreate();

    await user.type(screen.getByLabelText('Label'), 'USDT TRC20');
    await user.type(
      screen.getByLabelText('Account identifier'),
      'SEED-PLACEHOLDER-USDT-TRC20-0000',
    );
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText(/this is not a wallet address/i)).toBeInTheDocument();
  });

  it('names the chain it read off the paste, beside the tick that asks for a read-back', async () => {
    /*
     * What replaced the old cross-network refusal. Nothing knows which chain a rail is "supposed"
     * to pay on any more, so the console cannot refuse the other one — but it can put the chain it
     * READ in front of the person confirming the address. Somebody who pasted the BEP20 address out
     * of the other rail's clipboard sees BEP20 on a rail they think of as TRC20.
     */
    const { user } = renderCryptoCreate();
    const account = screen.getByLabelText('Account identifier');

    // Pasted rather than typed, which is both how an address really arrives and the only way to
    // exercise this without 42 re-renders.
    await user.click(account);
    await user.paste(EVM);

    expect(await screen.findByText(/this is a BEP20 address/i)).toBeInTheDocument();

    await user.clear(account);
    await user.paste(TRON);

    expect(await screen.findByText(/this is a TRC20 address/i)).toBeInTheDocument();
  });

  it('will not save a well-formed address until somebody has read it back', async () => {
    /*
     * Format validation cannot tell a well-formed address of YOURS from a well-formed address of
     * somebody else’s, and the wrong-clipboard paste is the failure that actually happens. Only a
     * human comparing characters catches it.
     */
    const { user } = renderCryptoCreate();

    await user.type(screen.getByLabelText('Label'), 'USDT TRC20');
    await user.type(screen.getByLabelText('Account identifier'), TRON);
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    expect(await screen.findByText(/read the address back/i)).toBeInTheDocument();
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it('saves once the address is right and the tick is on', async () => {
    let body: unknown = null;
    server.use(
      http.post(
        `${config.apiBaseUrl}/v1/admin/payment-methods/:id/destinations`,
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            {
              success: true,
              data: { ...primary, id: 'new-id', label: 'USDT TRC20' },
              error: null,
              meta: { correlationId: 'test', timestamp: new Date().toISOString() },
            },
            { status: 201 },
          );
        },
      ),
    );
    const { user } = renderCryptoCreate();

    await user.type(screen.getByLabelText('Label'), 'USDT TRC20');
    await user.type(screen.getByLabelText('Account identifier'), TRON);
    await user.click(screen.getByLabelText(/read this address back/i));
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    await waitFor(() => {
      expect(body).toMatchObject({ accountIdentifier: TRON });
    });
    // The tick is a speed bump, not a field. It has no business being persisted.
    expect(body).not.toHaveProperty('addressConfirmed');
  });

  it('forgives the whitespace a phone paste brings with it', async () => {
    const { user } = renderCryptoCreate();

    await user.type(screen.getByLabelText('Label'), 'USDT TRC20');
    await user.type(screen.getByLabelText('Account identifier'), `  ${TRON}  `);
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    // Stopped by the tick, not by the address.
    expect(await screen.findByText(/read the address back/i)).toBeInTheDocument();
    expect(screen.queryByText(/is not a wallet address/i)).not.toBeInTheDocument();
  });

  it('asks none of this of a bank account, whose shape is not ours to assert', async () => {
    // A rule that rejected a valid Syriatel number would be a worse bug than the one it prevents.
    const { user } = renderCreate();

    expect(screen.queryByLabelText(/read this address back/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Label'), 'Overflow');
    await user.type(screen.getByLabelText('Account identifier'), 'SY84 0000 0000 0001 2345');
    await user.click(screen.getByRole('button', { name: /add destination/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });
  });
});

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
