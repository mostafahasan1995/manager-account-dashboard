import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockTenants } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { TenantProvisioning } from '@/types';

import { TenantCreatedAlert } from './tenant-created-alert';

const tenant = mockTenants[0]!;

/** Everything went right, including the import — the shape a healthy backend answers. */
const allGood: TenantProvisioning = {
  webhookRegistered: true,
  webhookUrl: 'https://console.example/telegram/webhook/abc',
  webhookError: null,
  menusPushed: true,
  menuScopes: ['default', 'all_private_chats'],
  menuError: null,
  activated: true,
  activationError: null,
  paymentMethodsCreated: 4,
  paymentMethodsError: null,
  paymentMethodsNeedAccounts: false,
  playersImported: 37,
  playersImportError: null,
  ichancyFake: false,
};

describe('TenantCreatedAlert', () => {
  it('reads every step out as done, with the players imported counted', () => {
    renderPlain(<TenantCreatedAlert tenant={tenant} provisioning={allGood} onDismiss={vi.fn()} />);

    expect(
      screen.getByText('Main operation was created. Here is what provisioning managed.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Webhook registered with Telegram.')).toBeInTheDocument();
    expect(screen.getByText('Command menus pushed.')).toBeInTheDocument();
    expect(
      screen.getByText('Activated: the Ichancy agent answered a real sign-in.'),
    ).toBeInTheDocument();
    expect(screen.getByText('4 payment methods provisioned.')).toBeInTheDocument();
    expect(screen.getByText('Players imported: 37')).toBeInTheDocument();
    expect(screen.queryByText(/placeholder account/)).not.toBeInTheDocument();
  });

  it('prints the server’s own sentence beside each step that failed', () => {
    renderPlain(
      <TenantCreatedAlert
        tenant={tenant}
        provisioning={{
          ...allGood,
          webhookRegistered: false,
          webhookError: 'Telegram refused the URL: wrong response 502.',
          menusPushed: false,
          menuError: null,
          activated: false,
          activationError: 'Ichancy sign-in failed: the agent did not answer.',
          paymentMethodsError: 'The rails table is locked.',
          paymentMethodsNeedAccounts: true,
          playersImported: 0,
          playersImportError: 'Players were not imported: the operator was not activated.',
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Webhook not registered: Telegram refused the URL: wrong response 502.'),
    ).toBeInTheDocument();
    // A failure with no sentence still says it failed, rather than printing "null".
    expect(screen.getByText('Command menus not pushed: no reason given')).toBeInTheDocument();
    expect(
      screen.getByText('Not activated: Ichancy sign-in failed: the agent did not answer.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Payment methods not provisioned: The rails table is locked.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Players were not imported: Players were not imported: the operator was not activated.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/money sent to a placeholder is gone/)).toBeInTheDocument();
  });

  it('says an activation and an import in fake mode proved nothing', () => {
    renderPlain(
      <TenantCreatedAlert
        tenant={tenant}
        provisioning={{ ...allGood, ichancyFake: true, playersImported: 5 }}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Activated in fake mode: Ichancy was not contacted, so the agent’s credentials are unproven.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Players imported in fake mode: 5, made up rather than read from Ichancy.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/no real connection was made while creating/)).toBeInTheDocument();
    // The real-mode claim must not sit beside the fake one.
    expect(
      screen.queryByText('Activated: the Ichancy agent answered a real sign-in.'),
    ).not.toBeInTheDocument();
  });

  it('names binding the staff group as the next step when the operator has none', () => {
    renderPlain(
      <TenantCreatedAlert
        tenant={{ ...tenant, adminChatId: null }}
        provisioning={{
          ...allGood,
          activated: false,
          activationError:
            'This operator has no staff group yet, so it cannot be activated: its deposit review cards and alerts would go nowhere.',
        }}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/Not activated: This operator has no staff group yet/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'No staff group yet: open the operator, use “Add bot to staff group”, then activate it.',
      ),
    ).toBeInTheDocument();
  });

  it('dismisses on request', async () => {
    const onDismiss = vi.fn();
    const { user } = renderPlain(
      <TenantCreatedAlert tenant={tenant} provisioning={allGood} onDismiss={onDismiss} />,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('reads in Arabic, with the count of rails in the Arabic plural', () => {
    renderPlain(
      <TenantCreatedAlert
        tenant={tenant}
        provisioning={{ ...allGood, paymentMethodsCreated: 2 }}
        onDismiss={vi.fn()}
      />,
      { locale: 'ar' },
    );

    expect(
      screen.getByText('تم إنشاء Main operation. هذا ما أنجزه الإعداد التلقائي.'),
    ).toBeInTheDocument();
    expect(screen.getByText('جُهِّزت طريقتا دفع.')).toBeInTheDocument();
    expect(screen.getByText('اللاعبون المستوردون: 37')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إغلاق' })).toBeInTheDocument();
  });
});
