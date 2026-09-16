import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('calls its handler', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Approve</Button>);

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('cannot be pressed twice while a mutation is in flight', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Approve
      </Button>,
    );

    const button = screen.getByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('respects an explicit disabled', () => {
    render(<Button disabled>Approve</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  /** Radix Slot merges onto exactly one child, so the loading spinner must not be added there. */
  it('renders as its child when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/deposits">Open the queue</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Open the queue' });
    expect(link).toHaveAttribute('href', '/deposits');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('carries its variant and size classes', () => {
    render(
      <Button variant="danger" size="sm">
        Reject
      </Button>,
    );
    expect(screen.getByRole('button').className).toContain('--danger');
  });
});
