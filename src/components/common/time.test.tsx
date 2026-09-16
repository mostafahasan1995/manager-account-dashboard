import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderPlain } from '@/test/utils';

import { Countdown, TimeAgo } from './time';

const NOW = new Date('2026-08-21T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TimeAgo', () => {
  it('reads as elapsed time, which is the question an operator actually asks', () => {
    renderPlain(<TimeAgo value="2026-08-21T11:56:00.000Z" />);
    expect(screen.getByText('4 minutes ago')).toBeInTheDocument();
  });

  it('takes a prefix for rows that need one', () => {
    renderPlain(<TimeAgo value="2026-08-21T11:56:00.000Z" prefix="detected" />);
    expect(screen.getByText(/detected 4 minutes ago/)).toBeInTheDocument();
  });

  it('renders an em dash when there is no timestamp', () => {
    renderPlain(<TimeAgo value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Countdown', () => {
  it('shows the time left on a claim or an expiry window', () => {
    renderPlain(<Countdown target="2026-08-21T12:04:12.000Z" />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('4m 12s');
  });

  it('ticks down every second, because "8 minutes left" and "expired" are different decisions', () => {
    renderPlain(<Countdown target="2026-08-21T12:00:10.000Z" />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('10s');

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('countdown')).toHaveTextContent('5s');
  });

  it('says expired and calls back once the moment passes', () => {
    const onExpire = vi.fn();
    renderPlain(<Countdown target="2026-08-21T12:00:02.000Z" onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByTestId('countdown')).toHaveTextContent('expired');
    expect(onExpire).toHaveBeenCalled();
  });

  it('renders an em dash and starts no timer when there is nothing to count to', () => {
    renderPlain(<Countdown target={null} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('—');
  });
});
