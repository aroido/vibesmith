import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type StylePreset = 'classic' | 'neon' | 'editorial';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  stylePreset: StylePreset;
  setTheme: (theme: Theme | ((prev: Theme) => Theme)) => void;
  setStylePreset: (
    stylePreset: StylePreset | ((prev: StylePreset) => StylePreset)
  ) => void;
  setLightMode: () => void;
  setDarkMode: () => void;
  setSystemMode: () => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
