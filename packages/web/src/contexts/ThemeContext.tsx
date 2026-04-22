/**
 * ThemeContext - 다크/라이트/시스템 모드 전환을 위한 컨텍스트
 * 모든 useTheme 소비자가 동일한 상태를 공유하도록 함
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  ThemeContext,
  type Theme,
  type ResolvedTheme,
  type StylePreset,
  type ThemeContextValue,
} from './theme-context';

const THEME_STORAGE_KEY = 'vibesmith-theme';
const STYLE_PRESET_STORAGE_KEY = 'vibesmith-style-preset';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getStoredStylePreset(): StylePreset {
  if (typeof window === 'undefined') return 'classic';
  const stored = localStorage.getItem(STYLE_PRESET_STORAGE_KEY);
  if (stored === 'classic' || stored === 'neon' || stored === 'editorial') {
    return stored;
  }
  if (stored === 'liquid') {
    localStorage.setItem(STYLE_PRESET_STORAGE_KEY, 'neon');
    return 'neon';
  }
  return 'classic';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

function updateThemeDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function updateStylePresetDOM(stylePreset: StylePreset) {
  const root = document.documentElement;
  root.setAttribute('data-style', stylePreset);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [stylePreset, setStylePresetState] =
    useState<StylePreset>(getStoredStylePreset);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredTheme())
  );

  const setTheme = useCallback(
    (value: Theme | ((prev: Theme) => Theme)) => {
      setThemeState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        localStorage.setItem(THEME_STORAGE_KEY, next);
        return next;
      });
    },
    []
  );

  const setStylePreset = useCallback(
    (value: StylePreset | ((prev: StylePreset) => StylePreset)) => {
      setStylePresetState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        localStorage.setItem(STYLE_PRESET_STORAGE_KEY, next);
        return next;
      });
    },
    []
  );

  // 테마 변경 시 DOM 및 resolved 업데이트
  useEffect(() => {
    const newResolved = resolveTheme(theme);
    setResolvedTheme(newResolved);
    updateThemeDOM(newResolved);
  }, [theme]);

  // 스타일 프리셋 변경 시 DOM 업데이트
  useEffect(() => {
    updateStylePresetDOM(stylePreset);
  }, [stylePreset]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        updateThemeDOM(newResolved);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setLightMode = useCallback(() => setTheme('light'), [setTheme]);
  const setDarkMode = useCallback(() => setTheme('dark'), [setTheme]);
  const setSystemMode = useCallback(() => setTheme('system'), [setTheme]);
  const toggleTheme = useCallback(
    () =>
      setTheme((prev) => {
        if (prev === 'system') {
          return resolvedTheme === 'dark' ? 'light' : 'dark';
        }
        return prev === 'dark' ? 'light' : 'dark';
      }),
    [resolvedTheme, setTheme]
  );

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      stylePreset,
      setTheme,
      setStylePreset,
      setLightMode,
      setDarkMode,
      setSystemMode,
      toggleTheme,
    }),
    [
      theme,
      resolvedTheme,
      stylePreset,
      setTheme,
      setStylePreset,
      setLightMode,
      setDarkMode,
      setSystemMode,
      toggleTheme,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
