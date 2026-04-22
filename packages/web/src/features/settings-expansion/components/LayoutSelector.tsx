/**
 * LayoutSelector - 레이아웃 선택 (Compact/Normal)
 */

import { useTranslation } from 'react-i18next';
import type { Layout } from '../types';
import { useDisplaySettings } from '../hooks/useDisplaySettings';

const options: Layout[] = ['compact', 'normal'];

const selectClass =
  'input-theme rounded-lg px-4 py-2 text-sm font-medium';

export function LayoutSelector() {
  const { t } = useTranslation('settings');
  const { layout, setLayout } = useDisplaySettings();

  return (
    <select
      id="layout-selector"
      value={layout}
      onChange={(e) => setLayout(e.target.value as Layout)}
      aria-label={t('display.layoutLabel')}
      className={selectClass}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {t(`display.layout${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
        </option>
      ))}
    </select>
  );
}
