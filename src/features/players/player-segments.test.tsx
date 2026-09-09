import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { playerSearchSchema } from '@/app/search-schemas';
import type { Locale } from '@/lib/i18n/locales';
import { renderWithProviders } from '@/test/utils';

import { PlayerSegments } from './player-segments';
import { searchForSegment, segmentOf } from './segments';

/**
 * The segmented view is a URL. Each of these proves that a press writes the query string the
 * backend filters on, and that the offset goes with it.
 */

const renderSegments = (route = '/players', locale: Locale = 'en') =>
  renderWithProviders(<PlayerSegments />, {
    route,
    routePath: '/players',
    validateSearch: playerSearchSchema,
    locale,
  });

describe('PlayerSegments', () => {
  it('starts on All and offers the four views', async () => {
    renderSegments();

    expect(await screen.findByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Telegram' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Old players' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Blocked' })).toBeInTheDocument();
  });

  it('writes the old-players view as source=ICHANCY_IMPORT', async () => {
    const { user, location } = renderSegments();

    await user.click(await screen.findByRole('tab', { name: 'Old players' }));

    await waitFor(() => {
      expect(location()).toContain('source=ICHANCY_IMPORT');
    });
    expect(screen.getByRole('tab', { name: 'Old players' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('writes the blocked view as blocked=true and drops any source', async () => {
    const { user, location } = renderSegments('/players?source=TELEGRAM');

    await user.click(await screen.findByRole('tab', { name: 'Blocked' }));

    await waitFor(() => {
      expect(location()).toContain('blocked=true');
    });
    expect(location()).not.toContain('source=');
  });

  it('drops the page offset with the view, and keeps the other filters', async () => {
    const { user, location } = renderSegments('/players?offset=20&limit=10&search=ka');

    await user.click(await screen.findByRole('tab', { name: 'Telegram' }));

    await waitFor(() => {
      expect(location()).toContain('source=TELEGRAM');
    });
    expect(location()).not.toContain('offset=');
    expect(location()).toContain('limit=10');
    expect(location()).toContain('search=ka');
  });

  it('clears both fields again on All', async () => {
    const { user, location } = renderSegments('/players?blocked=true');

    expect(await screen.findByRole('tab', { name: 'Blocked' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('tab', { name: 'All' }));

    await waitFor(() => {
      expect(location()).not.toContain('blocked=');
    });
    expect(location()).not.toContain('source=');
  });

  it('reads in Arabic', async () => {
    renderSegments('/players', 'ar');

    expect(await screen.findByRole('tab', { name: 'اللاعبون القدامى' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'المحظورون' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'عرض' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('segmentOf', () => {
  it('reads blocked ahead of source, and an unknown source as All', () => {
    expect(segmentOf({})).toBe('all');
    expect(segmentOf({ source: 'TELEGRAM' })).toBe('telegram');
    expect(segmentOf({ source: 'ICHANCY_IMPORT' })).toBe('imported');
    expect(segmentOf({ blocked: true, source: 'TELEGRAM' })).toBe('blocked');
    // `blocked=false` hides the blocked rows; it is a filter, not this view.
    expect(segmentOf({ blocked: false })).toBe('all');
    expect(segmentOf({ source: 'ADMIN' })).toBe('all');
  });
});

describe('searchForSegment', () => {
  it('writes every field it owns, absent or set, and always resets the offset', () => {
    expect(searchForSegment('all')).toEqual({
      source: undefined,
      blocked: undefined,
      offset: undefined,
    });
    expect(searchForSegment('telegram')).toEqual({
      source: 'TELEGRAM',
      blocked: undefined,
      offset: undefined,
    });
    expect(searchForSegment('imported')).toEqual({
      source: 'ICHANCY_IMPORT',
      blocked: undefined,
      offset: undefined,
    });
    expect(searchForSegment('blocked')).toEqual({
      source: undefined,
      blocked: true,
      offset: undefined,
    });
  });
});
