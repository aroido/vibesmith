/**
 * LanguageSelector - 언어 선택 (i18n spec §5.2)
 * Settings 페이지에서 사용
 */

import { useTranslation } from 'react-i18next';
import type { SupportedLocale } from '@/i18n';
import { SUPPORTED_LOCALES } from '@/i18n';

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ko: '한국어',
  en: 'English',
};

interface LanguageSelectorProps {
  value?: SupportedLocale;
  onChange?: (locale: SupportedLocale) => void;
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  className = '',
}: LanguageSelectorProps) {
  const { t, i18n } = useTranslation('settings');
  const currentLocale = (value ?? i18n.language) as SupportedLocale;
  const resolvedLocale =
    currentLocale === 'ko' || currentLocale === 'en' ? currentLocale : 'ko';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value as SupportedLocale;
    if (newLocale === 'ko' || newLocale === 'en') {
      void i18n.changeLanguage(newLocale);
      onChange?.(newLocale);
    }
  };

  return (
    <select
      value={resolvedLocale}
      onChange={handleChange}
      aria-label={t('languageSelect')}
      className={`rounded-lg border border-theme bg-theme-surface px-4 py-2 text-sm font-medium text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)] focus:border-transparent ${className}`}
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
