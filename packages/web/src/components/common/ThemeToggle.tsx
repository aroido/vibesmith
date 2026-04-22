/**
 * Theme Toggle Button
 * 다크/라이트 모드 전환 버튼
 */

import { useContext } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '@/contexts/theme-context';

export function ThemeToggle() {
  const { t } = useTranslation('common');
  const themeContext = useContext(ThemeContext);

  // Some tests/pages render header without ThemeProvider.
  // Avoid runtime crash and hide toggle until provider is available.
  if (!themeContext) return null;

  const { theme, resolvedTheme, toggleTheme } = themeContext;

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" aria-hidden />;
      case 'dark':
        return <Moon className="h-4 w-4" aria-hidden />;
      case 'system':
        return <Monitor className="h-4 w-4" aria-hidden />;
    }
  };

  const getLabel = () => {
    return resolvedTheme === 'dark'
      ? t('theme.switchToLight')
      : t('theme.switchToDark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-testid="header-theme-toggle-button"
      className="btn-icon-theme rounded-xl p-2.5 transition-all"
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
    </button>
  );
}
