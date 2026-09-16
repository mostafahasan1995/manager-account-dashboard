import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderPlain } from '@/test/utils';

import { StaffFilters } from './staff-filters';

describe('StaffFilters', () => {
  it('reports the role the operator picked, keeping the other filter', async () => {
    const onChange = vi.fn();
    const { user } = renderPlain(
      <StaffFilters role={undefined} isActive={true} onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(await screen.findByRole('option', { name: 'Reviewer' }));

    expect(onChange).toHaveBeenCalledWith({ role: 'REVIEWER', isActive: true });
  });

  it('reports a deactivated-only filter as false, not as an absent filter', async () => {
    const onChange = vi.fn();
    const { user } = renderPlain(
      <StaffFilters role="SUPPORT" isActive={undefined} onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Account state' }));
    await user.click(await screen.findByRole('option', { name: 'Deactivated only' }));

    expect(onChange).toHaveBeenCalledWith({ role: 'SUPPORT', isActive: false });
  });

  it('drops the account-state filter entirely when both states are wanted', async () => {
    const onChange = vi.fn();
    const { user } = renderPlain(
      <StaffFilters role={undefined} isActive={false} onChange={onChange} />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Account state' }));
    await user.click(await screen.findByRole('option', { name: 'Active and deactivated' }));

    expect(onChange).toHaveBeenCalledWith({ role: undefined, isActive: undefined });
  });

  it('offers a way back to the unfiltered directory only once something is filtered', async () => {
    const onChange = vi.fn();
    const { user } = renderPlain(
      <StaffFilters role={undefined} isActive={undefined} onChange={onChange} />,
    );
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    renderPlain(<StaffFilters role="VIEWER" isActive={false} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(onChange).toHaveBeenCalledWith({ role: undefined, isActive: undefined });
  });
});
