import { screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/utils';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * The phone route into the navigation, walked end to end.
 *
 * Both halves already have tests, and neither can catch the failure that matters here: the bar's
 * test proves it calls `onOpenNav`, the drawer's proves it renders links and calls `onClose`, and
 * both pass just as happily if the two are wired to different pieces of state. Below `lg` the
 * drawer is the ONLY way off the screen you are on — the sidebar is translated off-canvas and
 * nothing else in the shell links anywhere — so a break in that wiring is not a cosmetic one. It
 * strands an operator on whichever screen they signed in to.
 *
 * So this mounts the pair the way AppShell does, over one piece of state, and presses the button.
 */
function NavHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Topbar
        onOpenNav={() => {
          setOpen(true);
        }}
      />
      <Sidebar
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/** The drawer never unmounts — above `lg` it is the static column — so state is read, not presence. */
const drawer = () => screen.getByRole('complementary', { name: /main navigation/i });

describe('the navigation drawer on a phone', () => {
  it('opens from the top bar, offers the destinations, and closes again', async () => {
    const { user } = renderWithProviders(<NavHarness />, { auth: { role: 'SUPER_ADMIN' } });

    const trigger = await screen.findByRole('button', { name: /open navigation/i });
    expect(drawer()).toHaveAttribute('data-state', 'closed');

    await user.click(trigger);
    expect(drawer()).toHaveAttribute('data-state', 'open');

    expect(screen.getByRole('link', { name: /deposits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reconciliation/i })).toBeInTheDocument();
    // Anchored: 'Financial settings' is a nav item of its own, and it is not this one.
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close navigation/i }));
    expect(drawer()).toHaveAttribute('data-state', 'closed');
  });

  it('offers only what the role can open, since the drawer is the whole navigation here', async () => {
    const { user } = renderWithProviders(<NavHarness />, { auth: { role: 'VIEWER' } });

    await user.click(await screen.findByRole('button', { name: /open navigation/i }));

    expect(screen.getByRole('link', { name: /reconciliation/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /staff/i })).not.toBeInTheDocument();
  });
});
