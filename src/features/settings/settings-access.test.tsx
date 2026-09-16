import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CAPABILITY_LABELS, capabilitiesOf } from '@/lib/auth/permissions';
import { renderPlain } from '@/test/utils';

import { SettingsAccess } from './settings-access';

describe('SettingsAccess', () => {
  it('lists what a reviewer holds and nothing a reviewer does not', () => {
    renderPlain(<SettingsAccess />, { auth: { role: 'REVIEWER' } });

    expect(screen.getByText(CAPABILITY_LABELS['deposits.decide'])).toBeInTheDocument();
    expect(screen.getByText(CAPABILITY_LABELS['reconciliation.read'])).toBeInTheDocument();
    expect(screen.queryByText(CAPABILITY_LABELS['deposits.sweep'])).not.toBeInTheDocument();
    expect(screen.queryByText(CAPABILITY_LABELS['admins.write'])).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(capabilitiesOf('REVIEWER').length);
  });

  it('grows with the role', () => {
    renderPlain(<SettingsAccess />, { auth: { role: 'SUPER_ADMIN' } });

    expect(screen.getByText(CAPABILITY_LABELS['deposits.sweep'])).toBeInTheDocument();
    expect(screen.getByText(CAPABILITY_LABELS['admins.write'])).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(capabilitiesOf('SUPER_ADMIN').length);
  });

  it('shows the platform admin the full set — it is the owner superset', () => {
    renderPlain(<SettingsAccess />, { auth: { role: 'PLATFORM_ADMIN' } });

    expect(screen.getByText(CAPABILITY_LABELS['tenants.manage'])).toBeInTheDocument();
    expect(screen.getByText(CAPABILITY_LABELS['admins.write'])).toBeInTheDocument();
    expect(screen.getByText(CAPABILITY_LABELS['deposits.read'])).toBeInTheDocument();

    // The owner account now decides money too — it holds every capability, so the panel lists it all.
    expect(screen.getByText(CAPABILITY_LABELS['deposits.decide'])).toBeInTheDocument();
    expect(screen.getByText(CAPABILITY_LABELS['reconciliation.act'])).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(capabilitiesOf('PLATFORM_ADMIN').length);
  });

  it('names the role it is describing', () => {
    renderPlain(<SettingsAccess />, { auth: { role: 'SUPPORT' } });

    expect(screen.getByText(/what support is allowed to do/i)).toBeInTheDocument();
  });

  it('falls back to a plain sentence when nobody is signed in', () => {
    renderPlain(<SettingsAccess />, { auth: { isAuthenticated: false } });

    expect(screen.getByText('This role holds no console capabilities.')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
