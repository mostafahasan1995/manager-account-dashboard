import { fireEvent, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { DepositProofs } from './deposit-proofs';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return found;
};

const withProofs = deposit(DEPOSIT_IDS.duplicateProof);

const renderProofs = (row: AdminDeposit = withProofs) =>
  renderPlain(<DepositProofs depositId={row.id} shortId={row.shortId} proofs={row.proofs} />);

describe('DepositProofs', () => {
  it('fetches each proof with the bearer token and shows it', async () => {
    renderProofs();

    const images = await screen.findAllByRole('img', { name: /proof \d of 2 for deposit M2WX88/i });
    expect(images).toHaveLength(2);
    expect(images[0]?.getAttribute('src')).toMatch(/^blob:/);
  });

  it('shows what a reviewer needs to spot a reused receipt', async () => {
    renderProofs();

    await screen.findAllByRole('img', { name: /proof 1 of 2/i });
    // The first twelve characters of the sha are enough to compare two proofs by eye.
    expect(screen.getByText('a1b2c3d4e5f6…')).toBeInTheDocument();
    expect(screen.getAllByText('278.2 KB')).not.toHaveLength(0);
    expect(screen.getAllByText('1080 × 1920')).not.toHaveLength(0);
  });

  it('revokes the object URL when the panel closes', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { unmount } = renderProofs(deposit(DEPOSIT_IDS.awaitingReview));

    const objectUrl = (await screen.findByRole('img', { name: /proof 1 of 1/i })).getAttribute(
      'src',
    );
    expect(objectUrl).toMatch(/^blob:/);
    expect(revoke).not.toHaveBeenCalled();

    unmount();

    expect(revoke).toHaveBeenCalledWith(objectUrl);
  });

  it('enlarges a proof on click', async () => {
    const { user } = renderProofs(deposit(DEPOSIT_IDS.awaitingReview));

    await user.click(await screen.findByRole('button', { name: /enlarge proof 1 of 1/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('image/jpeg', { exact: false })).toBeInTheDocument();
  });

  it('says so when the bytes cannot be fetched, and offers another go', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/deposits/:id/proofs/:proofId/content`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'PROOF_UNAVAILABLE', message: 'The proof store is unreachable.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 502 },
        ),
      ),
    );

    renderProofs(deposit(DEPOSIT_IDS.awaitingReview));

    expect(await screen.findByText('This proof could not be fetched')).toBeInTheDocument();
    expect(screen.getByText('The proof store is unreachable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('says so when the bytes arrive but will not decode', async () => {
    renderProofs(deposit(DEPOSIT_IDS.awaitingReview));

    const image = await screen.findByRole('img', { name: /proof 1 of 1/i });
    fireEvent.error(image);

    expect(await screen.findByText('This proof could not be displayed')).toBeInTheDocument();
  });

  it('tells the reviewer to reject rather than guess when nothing was uploaded', async () => {
    renderPlain(<DepositProofs depositId="deposit-1" shortId="K7QP42" proofs={[]} />);

    expect(await screen.findByText('No proof was uploaded')).toBeInTheDocument();
  });
});
