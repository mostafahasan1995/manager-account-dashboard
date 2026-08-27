import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { renderWithProviders } from '@/test/utils';

import { TenantNotice } from './tenant-notice';

/**
 * The notice and the switcher are one control with two faces, and this file exists because they can
 * disagree.
 *
 * Whichever way the flag points, exactly one of them must be on screen: a banner saying every screen
 * answers for one operator, or a switcher that changes which one. Both at once contradicts itself.
 * NEITHER is the state that costs money — a console silently pinned to the home operator while
 * looking like it can move, which is what a stale banner and a live switcher would produce
 * together.
 *
 * The suite pins the flag off (`vitest.config.ts`), so the on-case stubs the getter.
 */

const renderNotice = (tenantHeaderEnabled: boolean) => {
  vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(tenantHeaderEnabled);
  return renderWithProviders(<TenantNotice />, { auth: { role: 'PLATFORM_ADMIN' } });
};

describe('the single-operator notice', () => {
  it('says so, in words, when the console cannot switch operators', async () => {
    renderNotice(false);

    // A word, not a colour, and not merely an absent switcher: the reason the screen shows one
    // operator's money has to be readable by somebody who never noticed a switcher existed.
    expect(await screen.findByText(/single-tenant mode/i)).toBeInTheDocument();
  });

  it('is silent once the backend carries the tenant claim', () => {
    // Leaving it up would be the more expensive mistake of the two: an operator would read "every
    // screen is tenant zero" while the switcher beside it was genuinely changing operators.
    const { container } = renderNotice(true);

    expect(container).toBeEmptyDOMElement();
  });
});
