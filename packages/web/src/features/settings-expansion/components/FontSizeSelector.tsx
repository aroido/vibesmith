/**
 * FontSizeSelector - 폰트 크기 선택 (Small/Medium/Large)
 */

import { useTranslation } from 'react-i18next';
import type { FontSize } from '../types';
import { useDisplaySettings } from '../hooks/useDisplaySettings';

const options: FontSize[] = ['sm', 'md', 'lg'];

const selectClass =
  'input-theme rounded-lg px-4 py-2 text-sm font-medium';

export function FontSizeSelector() {
  const { t } = useTranslation('settings');
  const { fontSize, setFontSize } = useDisplaySettings();

  return (
    <select
      id="font-size-selector"
      value={fontSize}
      onChange={(e) => setFontSize(e.target.value as FontSize)}
      aria-label={t('display.fontSizeLabel')}
      className={selectClass}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {t(`display.fontSize${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
        </option>
      ))}
    </select>
  );
}
