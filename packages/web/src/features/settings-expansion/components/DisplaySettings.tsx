/**
 * DisplaySettings - 테마, 폰트 크기, 레이아웃
 */

import { useTranslation } from 'react-i18next';
import { ThemeSelector } from './ThemeSelector';
import { StylePresetSelector } from './StylePresetSelector';
import { FontSizeSelector } from './FontSizeSelector';
import { LayoutSelector } from './LayoutSelector';

const sectionClass =
  'vs-frost-panel rounded-2xl p-6';

export function DisplaySettings() {
  const { t } = useTranslation('settings');

  return (
    <section
      className={sectionClass}
      aria-labelledby="display-settings-title"
    >
      <h2
        id="display-settings-title"
        className="text-lg font-semibold text-theme-primary mb-4"
      >
        {t('display.title')}
      </h2>
      <p className="text-sm text-theme-secondary mb-6">
        {t('display.description')}
      </p>
      <div className="space-y-6">
        <div>
          <span className="block text-sm font-medium text-theme-secondary mb-2">
            {t('display.themeLabel')}
          </span>
          <ThemeSelector />
        </div>
        <div>
          <span className="block text-sm font-medium text-theme-secondary mb-2">
            {t('display.stylePresetLabel')}
          </span>
          <p className="mb-3 text-xs text-theme-tertiary">
            {t('display.stylePresetDescription')}
          </p>
          <StylePresetSelector />
        </div>
        <div>
          <label
            htmlFor="font-size-selector"
            className="block text-sm font-medium text-theme-secondary mb-2"
          >
            {t('display.fontSizeLabel')}
          </label>
          <FontSizeSelector />
        </div>
        <div>
          <label
            htmlFor="layout-selector"
            className="block text-sm font-medium text-theme-secondary mb-2"
          >
            {t('display.layoutLabel')}
          </label>
          <LayoutSelector />
        </div>
      </div>
    </section>
  );
}
