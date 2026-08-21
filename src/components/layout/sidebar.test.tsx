import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { homeRouteFor, visibleNavItems } from './nav-items';
import { Sidebar } from './sidebar';
import { can } from '@/lib/auth/permissions';

/**
 * The navigation is derived from the same capability table the screens use, so what these tests
 * really check is that the two cannot drift: a role never sees a link to a screen that would
 * redirect it straight back out.
 */

const renderSidebar = (role: AdminRole) =>
  renderWithProviders(<Sidebar open onClose={vi.fn()} />, { auth: { role } });

describe('what each role can navigate to', () => {
  it('gives a SUPER_ADMIN everything inside its tenant, and no tenant management', async () => {
    renderSidebar('SUPER_ADMIN');

    expect(await screen.findByRole('link', { name: /deposits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /payment rails/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reconciliation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /staff/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /operators/i })).not.toBeInTheDocument();
  });

  it('gives a PLATFORM_ADMIN the operator list, staff, and read access to the rest', async () => {
    renderSidebar('PLATFORM_ADMIN');

    expect(await screen.findByRole('link', { name: /operators/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /staff/i })).toBeInTheDocument();
    // Readable, because a platform operator has to be able to see the state it administers.
    expect(screen.getByRole('link', { name: /deposits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reconciliation/i })).toBeInTheDocument();
  });

  it('gives a SUPPORT user the screens it answers questions from, and no reconciliation', async () => {
    renderSidebar('SUPPORT');

    expect(await screen.findByRole('link', { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /deposits/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /reconciliation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /staff/i })).not.toBeInTheDocument();
  });

  it('gives a VIEWER the queue and reconciliation only', async () => {
    renderSidebar('VIEWER');

    expect(await screen.findByRole('link', { name: /deposits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reconciliation/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /players/i })).not.toBeInTheDocument();
  });

  it('always offers settings, which every role can open', async () => {
    renderSidebar('VIEWER');
    expect(await screen.findByRole('link', { name: /settings/i })).toBeInTheDocument();
  });
});

describe('closing on mobile', () => {
  it('closes when a destination is chosen, so the drawer does not cover the screen it opened', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<Sidebar open onClose={onClose} />, {
      auth: { role: 'SUPER_ADMIN' },
    });

    await user.click(await screen.findByRole('link', { name: /deposits/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('has a labelled close control', async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<Sidebar open onClose={onClose} />, {
      auth: { role: 'SUPER_ADMIN' },
    });

    await user.click(await screen.findByRole('button', { name: /close navigation/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('homeRouteFor', () => {
  it('sends anyone who can read deposits to the overview', () => {
    expect(homeRouteFor((capability) => can('REVIEWER', capability))).toBe('/');
  });

  it('sends a PLATFORM_ADMIN to the operators screen, which is its actual job', () => {
    expect(homeRouteFor((capability) => can('PLATFORM_ADMIN', capability))).toBe('/tenants');
  });

  it('falls back to settings for a role with no screens at all', () => {
    expect(homeRouteFor(() => false)).toBe('/settings');
  });
});

describe('visibleNavItems', () => {
  it('returns only what the role holds', () => {
    const items = visibleNavItems((capability) => can('VIEWER', capability));
    expect(items.map((item) => item.to)).toEqual(['/', '/deposits', '/reconciliation']);
  });
});
