import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { reconciliationSearchSchema } from '@/app/search-schemas';
import { renderWithProviders } from '@/test/utils';

import { BreakFilters } from './break-filters';

const validateSearch = (search: Record<string, unknown>) =>
  reconciliationSearchSchema.parse(search);

const render = (route: string) =>
  renderWithProviders(<BreakFilters />, {
    route,
    routePath: '/reconciliation',
    validateSearch,
  });

describe('BreakFilters', () => {
  it('starts on the open and investigating default when the URL names no status', async () => {
    render('/reconciliation');

    expect(await screen.findByRole('checkbox', { name: 'Open' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Investigating' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Resolved' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Written off' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'False positive' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('honours the statuses named in the URL instead of the default', async () => {
    render('/reconciliation?status=RESOLVED');

    expect(await screen.findByRole('checkbox', { name: 'Resolved' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Open' })).not.toBeChecked();
  });

  it('writes a ticked status back through the URL', async () => {
    const { user, location } = render('/reconciliation');

    await user.click(await screen.findByRole('checkbox', { name: 'Resolved' }));

    expect(screen.getByRole('checkbox', { name: 'Resolved' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Open' })).toBeChecked();
    expect(location()).toContain('RESOLVED');
  });

  it('falls back to the default pair when the last status is unticked', async () => {
    const { user, location } = render('/reconciliation?status=RESOLVED');

    await user.click(await screen.findByRole('checkbox', { name: 'Resolved' }));

    expect(location()).not.toContain('status');
    expect(screen.getByRole('checkbox', { name: 'Open' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Investigating' })).toBeChecked();
  });

  it('ticks a category and puts it in the URL', async () => {
    const { user, location } = render('/reconciliation');

    await user.click(await screen.findByRole('checkbox', { name: 'Duplicate credit' }));

    expect(screen.getByRole('checkbox', { name: 'Duplicate credit' })).toBeChecked();
    expect(location()).toContain('DUPLICATE_CREDIT');
  });

  it('unticks a category that came in from the URL', async () => {
    const { user, location } = render('/reconciliation?category=DUPLICATE_CREDIT');

    expect(await screen.findByRole('checkbox', { name: 'Duplicate credit' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Duplicate credit' }));

    expect(location()).not.toContain('DUPLICATE_CREDIT');
  });

  it('sets a minimum severity from the select', async () => {
    const { user, location } = render('/reconciliation');

    await user.click(await screen.findByRole('combobox', { name: 'Minimum severity' }));
    await user.click(await screen.findByRole('option', { name: '4 and above' }));

    expect(location()).toContain('minSeverity=4');
  });

  it('clears every filter back to the defaults', async () => {
    const { user, location } = render(
      '/reconciliation?status=RESOLVED&category=STUCK_DEPOSIT&minSeverity=4',
    );

    await user.click(await screen.findByRole('button', { name: /clear filters/i }));

    expect(location()).not.toContain('minSeverity');
    expect(location()).not.toContain('STUCK_DEPOSIT');
    expect(screen.getByRole('checkbox', { name: 'Open' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Resolved' })).not.toBeChecked();
  });

  it('keeps the tab it was opened on when the filters are cleared', async () => {
    const { user, location } = render('/reconciliation?tab=breaks&minSeverity=2');

    await user.click(await screen.findByRole('button', { name: /clear filters/i }));

    expect(location()).toContain('tab=breaks');
  });
});
