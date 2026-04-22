/**
 * DisplaySettings tests
 */

import type React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DisplaySettings } from '../components/DisplaySettings';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

describe('DisplaySettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders display section with theme, font size, layout controls', () => {
    const { getByRole } = renderWithTheme(<DisplaySettings />);
    expect(getByRole('heading', { name: /디스플레이|Display/i })).toBeInTheDocument();
    expect(getByRole('radiogroup', { name: /테마|Theme/i })).toBeInTheDocument();
    expect(getByRole('radiogroup', { name: /스타일 프리셋|Style preset/i })).toBeInTheDocument();
    expect(getByRole('combobox', { name: /폰트 크기|Font size/i })).toBeInTheDocument();
    expect(getByRole('combobox', { name: /레이아웃|Layout/i })).toBeInTheDocument();
  });

  it('changes font size and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = renderWithTheme(<DisplaySettings />);
    const fontSelect = getByRole('combobox', { name: /폰트 크기|Font size/i });
    await user.selectOptions(fontSelect, 'lg');
    expect(localStorage.getItem('vibesmith-font-size')).toBe('lg');
  });

  it('changes layout and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = renderWithTheme(<DisplaySettings />);
    const layoutSelect = getByRole('combobox', { name: /레이아웃|Layout/i });
    await user.selectOptions(layoutSelect, 'compact');
    expect(localStorage.getItem('vibesmith-layout')).toBe('compact');
  });

  it('changes style preset and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = renderWithTheme(<DisplaySettings />);
    const neonOption = getByRole('radio', { name: /Neon/i });

    await user.click(neonOption);

    expect(localStorage.getItem('vibesmith-style-preset')).toBe('neon');
    expect(neonOption).toHaveAttribute('aria-checked', 'true');
  });
});
