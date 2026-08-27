import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { renderPlain } from '@/test/utils';

import { LoadMore, Pagination } from './pagination';
import { CardSkeleton, EmptyState, ErrorState, TableSkeleton } from './states';

describe('EmptyState', () => {
  it('says what is empty and what to do about it', () => {
    renderPlain(
      <EmptyState
        title="Nothing waiting for review"
        description="Deposits appear here the moment a player uploads proof."
        action={<button>Clear filters</button>}
      />,
    );

    expect(screen.getByText('Nothing waiting for review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('shows the message, the code and the correlation id the backend logged it under', () => {
    renderPlain(
      <ErrorState
        error={
          new ApiError({
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            correlationId: 'corr-42',
          })
        }
      />,
    );

    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
    expect(screen.getByText('INTERNAL_ERROR')).toBeInTheDocument();
    expect(screen.getByText(/corr-42/)).toBeInTheDocument();
  });

  it('offers a retry for a failure that might pass next time', async () => {
    const onRetry = vi.fn();
    const { user } = renderPlain(
      <ErrorState error={new Error('network went away')} onRetry={onRetry} />,
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('explains a 403 as a role problem, and offers no retry — retrying cannot help', () => {
    const onRetry = vi.fn();
    renderPlain(
      <ErrorState
        error={new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Not allowed.' })}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Your role cannot see this')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('handles a plain Error as well as an ApiError', () => {
    renderPlain(<ErrorState error={new Error('boom')} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

describe('skeletons', () => {
  it('holds the table shape so nothing jumps when the rows land', () => {
    renderPlain(<TableSkeleton rows={3} columns={4} />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(12);
  });

  it('holds a card shape too', () => {
    renderPlain(<CardSkeleton />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

describe('Pagination', () => {
  const meta = { total: 42, limit: 20, offset: 0, hasMore: true };

  it('says which rows are on screen out of how many', () => {
    renderPlain(<Pagination meta={meta} onOffsetChange={vi.fn()} />);
    expect(screen.getByText('1–20 of 42')).toBeInTheDocument();
  });

  it('cannot go back from the first page', () => {
    renderPlain(<Pagination meta={meta} onOffsetChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('moves forward by one page', async () => {
    const onOffsetChange = vi.fn();
    const { user } = renderPlain(<Pagination meta={meta} onOffsetChange={onOffsetChange} />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onOffsetChange).toHaveBeenCalledWith(20);
  });

  it('cannot go forward past the end', () => {
    renderPlain(
      <Pagination
        meta={{ total: 42, limit: 20, offset: 40, hasMore: false }}
        onOffsetChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('says "No results" rather than "1–0 of 0"', () => {
    renderPlain(
      <Pagination
        meta={{ total: 0, limit: 20, offset: 0, hasMore: false }}
        onOffsetChange={vi.fn()}
      />,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('renders nothing at all before the first page has loaded', () => {
    const { container } = renderPlain(<Pagination meta={undefined} onOffsetChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('LoadMore', () => {
  it('loads the next cursor page', async () => {
    const onLoadMore = vi.fn();
    const { user } = renderPlain(
      <LoadMore hasMore loading={false} loadedCount={20} onLoadMore={onLoadMore} noun="deposits" />,
    );

    expect(screen.getByText(/20 deposits loaded/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('says the list has ended instead of leaving a dead button', () => {
    renderPlain(<LoadMore hasMore={false} loading={false} loadedCount={7} onLoadMore={vi.fn()} />);
    expect(screen.getByText('End of list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});
