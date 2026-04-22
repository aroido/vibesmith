/**
 * Platform filter toggle buttons
 * All, Claude Code, Cursor — same UI pattern as ComponentTypeFilter
 */

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

export type PlatformFilterValue = 'all' | 'claude_code' | 'cursor';

const PLATFORM_OPTIONS: { value: 'claude_code' | 'cursor'; labelKey: string }[] = [
  { value: 'claude_code', labelKey: 'platformClaudeCode' },
  { value: 'cursor', labelKey: 'platformCursor' },
];

interface PlatformFilterProps {
  selected: PlatformFilterValue;
  onChange: (value: PlatformFilterValue) => void;
}

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const { t } = useTranslation('components');
  const isAll = selected === 'all';

  return (
    <div
      role="group"
      aria-label={t('list.platformFilterAria')}
      className="flex gap-2 flex-wrap"
    >
      <button
        type="button"
        aria-pressed={isAll}
        onClick={() => onChange('all')}
        data-testid="platform-filter-all"
        className={`relative inline-flex h-11 items-center gap-2 px-4 rounded-lg border transition-all ${
          isAll
            ? 'btn-theme-primary-soft font-semibold'
            : 'btn-theme-surface font-medium'
        }`}
      >
        {isAll && <Check className="h-4 w-4" aria-hidden="true" />}
        {t('list.platformAll')}
      </button>
      {PLATFORM_OPTIONS.map((opt) => {
        const label = t(`list.${opt.labelKey}`);
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(opt.value)}
            data-testid={`platform-filter-${opt.value}`}
            className={`relative inline-flex h-11 items-center gap-2 px-4 rounded-lg border transition-all ${
              isSelected
                ? 'btn-theme-primary-soft font-semibold'
                : 'btn-theme-surface font-medium'
            }`}
          >
            {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
