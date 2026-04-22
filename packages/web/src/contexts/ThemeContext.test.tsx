import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from '@/hooks/useTheme';

function ThemeContextHarness() {
  const { stylePreset, setStylePreset } = useTheme();

  return (
    <>
      <span data-testid="preset-value">{stylePreset}</span>
      <button type="button" onClick={() => setStylePreset('editorial')}>
        set-editorial
      </button>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-style');
    document.documentElement.classList.remove('dark');

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

  it('migrates the removed liquid preset to neon and applies data-style to root', () => {
    localStorage.setItem('vibesmith-style-preset', 'liquid');

    render(
      <ThemeProvider>
        <ThemeContextHarness />
      </ThemeProvider>
    );

    expect(screen.getByTestId('preset-value')).toHaveTextContent('neon');
    expect(localStorage.getItem('vibesmith-style-preset')).toBe('neon');
    expect(document.documentElement.getAttribute('data-style')).toBe('neon');
  });

  it('updates style preset state, storage, and root attribute', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeContextHarness />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: 'set-editorial' }));

    expect(screen.getByTestId('preset-value')).toHaveTextContent('editorial');
    expect(localStorage.getItem('vibesmith-style-preset')).toBe('editorial');
    expect(document.documentElement.getAttribute('data-style')).toBe('editorial');
  });
});
