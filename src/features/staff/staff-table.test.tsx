import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockAdmins } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';

import { StaffTable } from './staff-table';

const admin = (username: string | null) => {
  const found = mockAdmins.find((row) => row.username === username);
  if (found === undefined) throw new Error(`no fixture admin @${String(username)}`);
  return found;
};

describe('StaffTable', () => {
  it('puts the directory in a real table and links each name to its detail page', async () => {
    renderWithProviders(<StaffTable admins={mockAdmins} noOpenLimit={new Set()} />);

    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Name', 'Username', 'Telegram ID', 'Role', 'Account', 'Last login', 'Added']);

    expect(within(table).getByRole('link', { name: 'Lina Farah' })).toHaveAttribute(
      'href',
      `/staff/${admin('lina_review').id}`,
    );
  });

  it('shows the telegram id with a way to copy it, and role and state as words', async () => {
    const reviewer = admin('lina_review');
    renderWithProviders(<StaffTable admins={[reviewer]} noOpenLimit={new Set()} />);

    expect(await screen.findByText(reviewer.telegramUserId)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('@lina_review')).toBeInTheDocument();
  });

  it('leaves an administrator unflagged when a limit is in force', async () => {
    const reviewer = admin('lina_review');
    renderWithProviders(<StaffTable admins={[reviewer]} noOpenLimit={new Set()} />);

    await screen.findByRole('table');
    expect(screen.queryByText('No approval limit')).not.toBeInTheDocument();
  });

  it('flags an administrator who has no approval limit in force', async () => {
    const reviewer = admin('lina_review');
    renderWithProviders(<StaffTable admins={[reviewer]} noOpenLimit={new Set([reviewer.id])} />);

    expect(await screen.findByText('No approval limit')).toBeInTheDocument();
  });

  it('says so when an administrator has never signed in', async () => {
    renderWithProviders(<StaffTable admins={[admin('audit_bot')]} noOpenLimit={new Set()} />);

    expect(await screen.findByText('Never signed in')).toBeInTheDocument();
  });

  it('leaves the username column empty rather than blank-looking when there is none', async () => {
    renderWithProviders(<StaffTable admins={[admin(null)]} noOpenLimit={new Set()} />);

    const table = await screen.findByRole('table');
    const cells = within(table).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('—');
  });
});
