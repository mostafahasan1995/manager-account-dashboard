import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ThemeState {
  /** What the operator chose. */
  preference: ThemePreference;
  /** What is actually on screen after resolving "system". */
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

export const THEME_STORAGE_KEY = 'cashier-console.theme.v1';
