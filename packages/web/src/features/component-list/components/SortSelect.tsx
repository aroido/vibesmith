/**
 * Sort Select Component
 * 정렬 옵션 선택 드롭다운
 */

import { useTranslation } from 'react-i18next';

export type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc';

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  const { t } = useTranslation('components');

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="sort-select"
        className="block text-sm font-medium text-theme-secondary"
      >
        {t('list.sortBy')}
      </label>
      <select
        id="sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="w-full h-12 rounded-lg input-theme px-3 text-sm"
      >
        <option value="name-asc">{t('list.sortNameAsc')}</option>
        <option value="name-desc">{t('list.sortNameDesc')}</option>
        <option value="date-asc">{t('list.sortDateAsc')}</option>
        <option value="date-desc">{t('list.sortDateDesc')}</option>
      </select>
    </div>
  );
}
