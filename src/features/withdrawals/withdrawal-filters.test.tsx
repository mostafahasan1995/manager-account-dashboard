import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { withdrawalSearchSchema } from '@/app/search-schemas';
import type { Locale } from '@/lib/i18n/locales';
import { renderWithProviders } from '@/test/utils';

import { WithdrawalFilters } from './withdrawal-filters';

/**
 * Every filter is a URL, so every test here reads the URL back rather than the component's state.
 * `decodeURIComponent` because the router JSON-encodes arrays: `status=["DEBITED"]` is what a
 * shared link carries once unescaped.
 */
const renderFilters = (route = '/withdrawals', locale?: Locale) =>
  renderWithProviders(<WithdrawalFilters />, {
    route,
    routePath: '/withdrawals',
    validateSearch: withdrawalSearchSchema,
    ...(locale === undefined ? {} : { locale }),
  });

const url = (location: () => string) => decodeURIComponent(location());

describe('WithdrawalFilters', () => {
  it('opens on "still moving" and treats that as no filter at all', async () => {
    renderFilters();

    expect(await screen.findByRole('button', { name: 'Still moving' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('writes a preset chip to the URL and presses it', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'Ready to pay' }));

    expect(url(location)).toContain('status=["DEBITED"]');
    expect(await screen.findByRole('button', { name: 'Ready to pay' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('button', { name: 'Still moving' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('spells out the attention set and the everything set rather than sending a nickname', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'Needs a person' }));
    expect(url(location)).toContain('DEBIT_FAILED');
    expect(url(location)).toContain('NEEDS_RECONCILIATION');

    await user.click(await screen.findByRole('button', { name: 'Everything' }));
    expect(url(location)).toContain('CANCELLED');
    expect(url(location)).toContain('PAID');
  });

  it('pressing the active chip again returns to the open queue', async () => {
    const { user, location } = renderFilters('/withdrawals?status=DEBITED');

    await user.click(await screen.findByRole('button', { name: 'Ready to pay' }));

    expect(url(location)).not.toContain('status=');
  });

  it('drops the page offset whenever a filter changes', async () => {
    const { user, location } = renderFilters('/withdrawals?offset=20&status=PAID');

    expect(url(location)).toContain('offset=20');
    await user.click(await screen.findByRole('button', { name: 'Ready to pay' }));

    expect(url(location)).not.toContain('offset');
  });

  it('commits the short id on Apply, not per keystroke', async () => {
    const { user, location } = renderFilters();

    await user.type(await screen.findByLabelText('Short ID'), 'WD9');
    expect(url(location)).not.toContain('shortId');

    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(url(location)).toContain('shortId=WD9');
  });

  it('writes the sort as soon as it is chosen, and leaves the default out of the URL', async () => {
    const { user, location } = renderFilters('/withdrawals?sort=oldest');

    await user.click(await screen.findByRole('combobox', { name: 'Sort' }));
    await user.click(await screen.findByRole('option', { name: 'Newest first' }));

    expect(url(location)).not.toContain('sort=');
  });

  it('opens the extra filters for a link that carries one of them', async () => {
    renderFilters('/withdrawals?createdFrom=2026-09-01');

    expect(await screen.findByLabelText('Requested from')).toHaveValue('2026-09-01');
    expect(await screen.findByRole('button', { name: 'More filters' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('adds and removes single statuses from the boxes, falling back to the open queue', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'More filters' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Paid' }));
    expect(url(location)).toContain('PAID');
    expect(url(location)).toContain('REQUESTED');

    await user.click(await screen.findByRole('checkbox', { name: 'Paid' }));
    expect(url(location)).not.toContain('status=');
  });

  it('commits the player id and the dates together on Apply', async () => {
    const { user, location } = renderFilters();

    await user.click(await screen.findByRole('button', { name: 'More filters' }));
    await user.type(await screen.findByLabelText('Player id'), 'abc-123');
    await user.type(await screen.findByLabelText('Requested to'), '2026-09-03');
    await user.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(url(location)).toContain('playerId=abc-123');
    expect(url(location)).toContain('createdTo=2026-09-03');
  });

  it('clears every filter but keeps the open panel', async () => {
    const { user, location } = renderFilters(
      '/withdrawals?status=PAID&shortId=WD4&selected=some-id',
    );

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(url(location)).not.toContain('status=');
    expect(url(location)).not.toContain('shortId=');
    expect(url(location)).toContain('selected=some-id');
  });

  it('reads in Arabic', async () => {
    renderFilters('/withdrawals', 'ar');

    expect(await screen.findByRole('button', { name: 'ما زال يتحرك' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'جاهز للدفع' })).toBeInTheDocument();
    expect(await screen.findByLabelText('المعرّف القصير')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
