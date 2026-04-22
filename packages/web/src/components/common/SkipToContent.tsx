import { useTranslation } from 'react-i18next';

/**
 * Skip to content link - WCAG 2.1 AA (2.4.1 Bypass Blocks)
 * Allows keyboard users to skip navigation and go directly to main content.
 */
export function SkipToContent() {
  const { t } = useTranslation('common');

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-[var(--color-bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-canvas)] focus:whitespace-nowrap"
    >
      {t('skipToContent')}
    </a>
  );
}
