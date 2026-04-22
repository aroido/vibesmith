/**
 * Status Filter Component
 * Filters components by enabled/disabled status
 * Spec: toggle-enhancement.md §5.3 StatusFilter
 */

import { useTranslation } from 'react-i18next';

export type StatusFilterValue = 'all' | 'enabled' | 'disabled';

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const { t } = useTranslation('components');
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    // 타입 가드: 유효한 StatusFilterValue인지 검증
    if (newValue === 'all' || newValue === 'enabled' || newValue === 'disabled') {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor="status-filter"
        className="block text-sm font-medium text-theme-secondary"
      >
        {t('list.statusLabel')}
      </label>
      <select
        id="status-filter"
        value={value}
        onChange={handleChange}
        className="w-full h-12 px-4 rounded-lg input-theme appearance-none"
        aria-label={t('list.statusFilterAria')}
      >
        <option value="all">{t('list.statusAll')}</option>
        <option value="enabled">{t('list.statusEnabled')}</option>
        <option value="disabled">{t('list.statusDisabled')}</option>
      </select>
    </div>
  );
}
