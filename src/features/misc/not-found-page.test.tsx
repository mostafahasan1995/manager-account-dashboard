import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { renderWithProviders } from '@/test/utils';

import { NotFoundPage } from './not-found-page';
import { RouteErrorPage } from './route-error-page';

describe('NotFoundPage', () => {
  it('explains both reasons a link can land nowhere, including the role one', async () => {
    renderWithProviders(<NotFoundPage />);

    expect(await screen.findByText('That page does not exist')).toBeInTheDocument();
    expect(screen.getByText(/role you do not have/i)).toBeInTheDocument();
  });

  it('offers a way back rather than leaving the operator stranded', async () => {
    renderWithProviders(<NotFoundPage />);
    expect(await screen.findByRole('link', { name: /back to the overview/i })).toBeInTheDocument();
  });
});

describe('RouteErrorPage', () => {
  it('shows what failed instead of blanking the console mid-shift', async () => {
    renderWithProviders(
      <RouteErrorPage
        error={
          new ApiError({
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            correlationId: 'corr-7',
          })
        }
        reset={vi.fn()}
        info={{ componentStack: '' }}
      />,
    );

    expect(await screen.findByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(screen.getByText(/corr-7/)).toBeInTheDocument();
  });

  it('lets the operator try the route again', async () => {
    const reset = vi.fn();
    const { user } = renderWithProviders(
      <RouteErrorPage
        error={new Error('render blew up')}
        reset={reset}
        info={{ componentStack: '' }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });
});
