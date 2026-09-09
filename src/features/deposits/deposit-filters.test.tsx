import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { depositSearchSchema } from '@/app/search-schemas';
import { renderWithProviders } from '@/test/utils';

import { DepositFilters } from './deposit-filters';

const validateSearch = (search: Record<string, unknown>) => depositSearchSchema.parse(search);

const renderFilters = (route = '/deposits') =>
  renderWithProviders(<DepositFilters />, {
    route,
    routePath: '/deposits',
    validateSearch,
  });

describe('DepositFilters', () => {
  it('puts a short id search into the URL when it is applied', async () => {
    const { user, location } = renderFilters();

    await user.type(await screen.findByLabelText('Short ID'), 'K7QP42');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(location()).toContain('shortId=K7QP42');
  });

  it('does not rewrite the URL on every keystroke', async () => {
    const { user, location } = renderFilters();

    await user.type(await screen.findByLabelText('Reference'), '8845');

    expect(location()).not.toContain('externalReference');
  });

  it('toggles the unclaimed chip through the URL', async () => {
    const { user, location } = renderFilters();

    const chip = await screen.findByRole('button', { name: 'Unclaimed only' });
    await user.click(chip);
    expect(location()).toContain('unclaimedOnly=true');

    await user.click(screen.getByRole('button', { name: 'Unclaimed only' }));
    expect(location()).not.toContain('unclaimedOnly');
  });

  /**
   * THE COMPLAINT THIS CHIP ANSWERS: the queue's default is the three reviewable statuses, so on a
   * real operator it showed 2 rows out of 48 and every deposit that WORKED was invisible.
   */
  it('asks for EVERY status when All deposits is pressed, not an absent filter', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'All deposits' }));

    const url = decodeURIComponent(location());
    // An absent `status` means the reviewable three to the backend, so "all" has to be spelled out.
    // CREDITED is the one that matters most: it is the successful deposit nobody could see.
    expect(url).toContain('CREDITED');
    expect(url).toContain('EXPIRED');
    expect(url).toContain('REJECTED');
    expect(url).toContain('SUBMITTED');
  });

  it('drops "unclaimed only" when All deposits is pressed, because they contradict', async () => {
    const { user, location } = renderFilters('/deposits?unclaimedOnly=true');

    await user.click(await screen.findByRole('button', { name: 'All deposits' }));

    expect(location()).not.toContain('unclaimedOnly');
  });

  it('returns to the review queue when All deposits is pressed again', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'All deposits' }));
    await user.click(screen.getByRole('button', { name: 'All deposits' }));

    expect(location()).not.toContain('status');
    expect(screen.getByRole('button', { name: 'Needs review' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sends the stuck chip to the two statuses where money is stuck', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'Stuck' }));

    const url = decodeURIComponent(location());
    expect(url).toContain('CREDIT_FAILED');
    expect(url).toContain('NEEDS_RECONCILIATION');
  });

  it('marks the chip that matches the URL as pressed', async () => {
    renderFilters('/deposits?status=CREDIT_FAILED,NEEDS_RECONCILIATION');

    expect(await screen.findByRole('button', { name: 'Stuck' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Needs review' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('writes a status the reviewer ticks and drops it again when it is unticked', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: /more filters/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Credit failed' }));
    expect(decodeURIComponent(location())).toContain('CREDIT_FAILED');

    await user.click(screen.getByRole('checkbox', { name: 'Credit failed' }));
    expect(decodeURIComponent(location())).not.toContain('CREDIT_FAILED');
  });

  it('opens the advanced panel already expanded when a link carries one of its filters', async () => {
    renderFilters('/deposits?minAmount=1500.5');

    expect(await screen.findByLabelText('Amount from')).toHaveValue('1500.5');
  });

  it('keeps a digits-only reference alive across the URL round trip', async () => {
    renderFilters('/deposits?externalReference=884512309');

    expect(await screen.findByLabelText('Reference')).toHaveValue('884512309');
  });

  it('refuses an amount that is not a plain decimal and leaves the URL alone', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: /more filters/i }));
    await user.type(screen.getByLabelText('Amount from'), '1,500.00');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Use a plain amount, like 1500.00');
    expect(location()).not.toContain('minAmount');
  });

  it('changes the sort through the URL', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByLabelText('Sort'));
    await user.click(await screen.findByRole('option', { name: 'Largest amount' }));

    expect(location()).toContain('sort=amount_desc');
  });

  it('only offers to clear filters once one is set, and keeps the open panel when it does', async () => {
    const { user, location } = renderFilters('/deposits?selected=deposit-1');

    expect(await screen.findByRole('button', { name: 'Needs review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Unclaimed only' }));
    await user.click(await screen.findByRole('button', { name: /clear filters/i }));

    expect(location()).not.toContain('unclaimedOnly');
    expect(location()).toContain('selected=deposit-1');
  });

  it('re-seeds its fields from the URL after a clear', async () => {
    const { user } = renderFilters('/deposits?shortId=K7QP42');

    expect(await screen.findByLabelText('Short ID')).toHaveValue('K7QP42');
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(await screen.findByLabelText('Short ID')).toHaveValue('');
  });

  it('applies a date range as whole local days', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: /more filters/i }));
    await user.type(screen.getByLabelText('Created from'), '2026-08-20');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(decodeURIComponent(location())).toContain('createdFrom=2026-08-20');
  });
});
