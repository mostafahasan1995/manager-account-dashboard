import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderPlain } from '@/test/utils';

import { Can } from './can';
import { ConfirmDialog } from './confirm-dialog';
import { CopyButton, CopyableValue } from './copy-button';

describe('ConfirmDialog', () => {
  it('states what will happen before it happens', () => {
    renderPlain(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Deactivate this rail?"
        description="Players will no longer be offered it. Existing deposits are unaffected."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Deactivate this rail?' })).toBeInTheDocument();
    expect(screen.getByText(/Existing deposits are unaffected/)).toBeInTheDocument();
  });

  it('confirms when asked', async () => {
    const onConfirm = vi.fn();
    const { user } = renderPlain(
      <ConfirmDialog open onOpenChange={vi.fn()} title="Sure?" onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('closes without acting when cancelled', async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const { user } = renderPlain(
      <ConfirmDialog open onOpenChange={onOpenChange} title="Sure?" onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks the action until the operator types the word, for anything that stops a live service', async () => {
    const onConfirm = vi.fn();
    const { user } = renderPlain(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Suspend northern-branch?"
        confirmWord="northern-branch"
        destructive
        confirmLabel="Suspend"
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Suspend' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/type northern-branch to confirm/i), 'northern-branc');
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/type northern-branch to confirm/i), 'h');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('cannot be double-fired while the mutation is in flight', () => {
    renderPlain(
      <ConfirmDialog open onOpenChange={vi.fn()} title="Sure?" loading onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('Can', () => {
  it('renders the action for a role that holds the capability', () => {
    renderPlain(
      <Can capability="deposits.decide">
        <button>Approve</button>
      </Can>,
      { auth: { role: 'REVIEWER' } },
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('hides it entirely for a role that does not — never a disabled button', () => {
    renderPlain(
      <Can capability="deposits.decide">
        <button>Approve</button>
      </Can>,
      { auth: { role: 'VIEWER' } },
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('can show something else instead', () => {
    renderPlain(
      <Can capability="admins.write" fallback={<span>Read-only</span>}>
        <button>Add administrator</button>
      </Can>,
      { auth: { role: 'FINANCE_ADMIN' } },
    );
    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });
});

describe('CopyButton', () => {
  // user-event installs its own clipboard stub during setup(), so the spy has to go on afterwards.
  it('copies the value and confirms it did', async () => {
    const { user } = renderPlain(<CopyButton value="K7QP42" />);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('K7QP42');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('does not break the screen when the browser refuses the clipboard', async () => {
    const { user } = renderPlain(<CopyButton value="K7QP42" />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});

describe('CopyableValue', () => {
  it('shows the value next to its copy button', () => {
    renderPlain(<CopyableValue value="aaaaaaaa-0000-4000-8000-000000000001" display="aaaaaaaa…" />);
    expect(screen.getByText('aaaaaaaa…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
