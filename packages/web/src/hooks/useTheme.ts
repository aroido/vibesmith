/**
 * useTheme Hook
 * ThemeContext 기반 - useTheme()는 반드시 ThemeProvider 내부에서 사용
 */

import { useContext } from 'react';
import {
  ThemeContext,
  type ThemeContextValue,
} from '@/contexts/theme-context';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
