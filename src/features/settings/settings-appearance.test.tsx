import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from '@/lib/theme/theme-context';
import { renderPlain } from '@/test/utils';

import { SettingsAppearance } from './settings-appearance';

describe('SettingsAppearance', () => {
  it('starts on system and says which palette that resolved to', () => {
    renderPlain(<SettingsAppearance />);

    expect(screen.getByRole('radio', { name: /system/i })).toBeChecked();
    expect(screen.getByText(/currently showing the light palette/i)).toBeInTheDocument();
  });

  it('switches to dark, applies it to the document and remembers it', async () => {
    const { user } = renderPlain(<SettingsAppearance />);

    await user.click(screen.getByRole('radio', { name: /dark/i }));

    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByText(/currently showing the dark palette/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('switches back to light and takes the dark class off again', async () => {
    const { user } = renderPlain(<SettingsAppearance />);

    await user.click(screen.getByRole('radio', { name: /dark/i }));
    await user.click(screen.getByRole('radio', { name: /light/i }));

    expect(screen.getByRole('radio', { name: /light/i })).toBeChecked();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('offers exactly the three preferences the theme supports', () => {
    renderPlain(<SettingsAppearance />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});
