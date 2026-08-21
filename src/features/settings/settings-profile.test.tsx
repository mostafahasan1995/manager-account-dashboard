import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@/lib/auth/auth-context';
import { createTestAuth, renderPlain } from '@/test/utils';

import { SettingsProfile } from './settings-profile';

describe('SettingsProfile', () => {
  it('names the admin, their telegram id and what their role means', () => {
    renderPlain(<SettingsProfile />, { auth: { role: 'REVIEWER' } });

    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('700000001')).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(
      screen.getByText('Reviews and decides deposits. Cannot change rails or staff.'),
    ).toBeInTheDocument();
  });

  it('counts the session down and says there is no refresh token', () => {
    renderPlain(<SettingsProfile />);

    expect(screen.getByTestId('countdown')).toHaveTextContent(/\d/);
    expect(screen.getByText('Admin sessions have no refresh token')).toBeInTheDocument();
    expect(screen.getByText('/console')).toBeInTheDocument();
  });

  it('offers the telegram id for copying rather than retyping', async () => {
    const { user } = renderPlain(<SettingsProfile />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('700000001');
  });

  it('signs out on request, and says it was the admin who asked', async () => {
    const signOut = vi.fn();
    const { user } = renderPlain(<SettingsProfile />, { auth: { signOut } });

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledWith('manual');
  });

  it('turns the countdown amber once the session is nearly over', () => {
    const auth = { ...createTestAuth(), expiringSoon: true };
    renderPlain(
      <AuthContext value={auth}>
        <SettingsProfile />
      </AuthContext>,
    );

    expect(screen.getByTestId('countdown')).toHaveClass('text-[var(--warning)]');
  });

  it('says plainly when there is no session on this tab', () => {
    renderPlain(<SettingsProfile />, { auth: { isAuthenticated: false } });

    expect(screen.getByText('No session is signed in on this tab.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});
