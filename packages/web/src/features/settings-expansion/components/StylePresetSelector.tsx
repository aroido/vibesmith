import type { StylePreset } from '@/contexts/theme-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';

const baseCardClass =
  'rounded-xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

const activeCardClass =
  'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))] text-theme-primary shadow-[0_10px_28px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]';

const inactiveCardClass =
  'border-theme bg-theme-surface text-theme-secondary hover:border-[var(--color-border-hover)] hover:bg-theme-hover';

const stylePresetOptions: Array<{
  value: StylePreset;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: 'classic',
    labelKey: 'display.stylePresetClassic',
    descriptionKey: 'display.stylePresetClassicDescription',
  },
  {
    value: 'neon',
    labelKey: 'display.stylePresetNeon',
    descriptionKey: 'display.stylePresetNeonDescription',
  },
  {
    value: 'editorial',
    labelKey: 'display.stylePresetEditorial',
    descriptionKey: 'display.stylePresetEditorialDescription',
  },
];

export function StylePresetSelector() {
  const { t } = useTranslation('settings');
  const { stylePreset, setStylePreset } = useTheme();

  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      role="radiogroup"
      aria-label={t('display.stylePresetLabel')}
    >
      {stylePresetOptions.map((option) => {
        const isSelected = stylePreset === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setStylePreset(option.value)}
            className={`${baseCardClass} ${isSelected ? activeCardClass : inactiveCardClass}`}
          >
            <p className="text-sm font-semibold">{t(option.labelKey)}</p>
            <p className="mt-1 text-xs leading-relaxed text-theme-tertiary">
              {t(option.descriptionKey)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
