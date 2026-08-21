import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderPlain } from '@/test/utils';

import { SettingsConnection } from './settings-connection';

/**
 * The other side of the two build flags.
 *
 * `config` is resolved once at module load, so flipping a flag means a module mock and therefore a
 * file of its own — the copy that appears when mocks are off and the tenant header is on is exactly
 * the copy nobody would otherwise ever read in a test.
 */
vi.mock('@/config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    appName: 'Cashier Console',
    enableMocks: false,
    tenantHeaderEnabled: true,
  },
}));

describe('SettingsConnection with mocks off and the tenant header on', () => {
  it('says every request goes to the real backend', () => {
    renderPlain(<SettingsConnection />);

    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText(/every request goes to the url above/i)).toBeInTheDocument();
  });

  it('says the header is sent and that the backend still has to honour it', () => {
    renderPlain(<SettingsConnection />);

    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText(/X-Tenant-Id rides on every admin request/i)).toBeInTheDocument();
    expect(screen.getByText(/docs\/API-CONTRACT\.md/)).toBeInTheDocument();
  });
});
