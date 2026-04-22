/**
 * ThemeSelector - 테마 선택 (Light/Dark/System)
 * useTheme 연동
 */

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';

const baseButton =
  'px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';
const activeButton = 'btn-theme-primary-soft text-theme-primary';
const inactiveButton = 'btn-theme-surface text-theme-secondary';

export function ThemeSelector() {
  const { t } = useTranslation('settings');
  const { theme, setLightMode, setDarkMode, setSystemMode } = useTheme();

  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label={t('display.themeLabel')}
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={setLightMode}
        className={`${baseButton} ${theme === 'light' ? activeButton : inactiveButton}`}
      >
        {t('display.themeLight')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={setDarkMode}
        className={`${baseButton} ${theme === 'dark' ? activeButton : inactiveButton}`}
      >
        {t('display.themeDark')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        onClick={setSystemMode}
        className={`${baseButton} ${theme === 'system' ? activeButton : inactiveButton}`}
      >
        {t('display.themeSystem')}
      </button>
    </div>
  );
}
