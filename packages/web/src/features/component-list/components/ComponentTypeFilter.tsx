/**
 * Component type filter tabs
 * All, Skills, Agents, Commands, Hooks, Rules
 */

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { ComponentType } from '../types';

export type FilterType = ComponentType;

const TAB_KEYS: { value: FilterType; labelKey: string }[] = [
  { value: 'skill', labelKey: 'typeTabSkill' },
  { value: 'agent', labelKey: 'typeTabAgent' },
  { value: 'command', labelKey: 'typeTabCommand' },
  { value: 'hook', labelKey: 'typeTabHook' },
  { value: 'rule', labelKey: 'typeTabRule' },
];

interface ComponentTypeFilterProps {
  selectedTypes: FilterType[];
  onTypesChange: (types: FilterType[]) => void;
}

export function ComponentTypeFilter({
  selectedTypes,
  onTypesChange,
}: ComponentTypeFilterProps) {
  const { t } = useTranslation('components');
  const isAllSelected = selectedTypes.length === 0;

  const toggleType = (type: FilterType) => {
    const exists = selectedTypes.includes(type);
    const next = exists
      ? selectedTypes.filter((item) => item !== type)
      : [...selectedTypes, type];

    const orderedNext = TAB_KEYS.map((tab) => tab.value).filter((tabType) => next.includes(tabType));
    onTypesChange(orderedNext);
  };

  return (
    <div
      role="group"
      aria-label={t('list.typeTablistAria')}
      className="flex gap-2 flex-wrap"
    >
      <button
        type="button"
        aria-label={t('list.typeTabAria', { label: t('list.typeTabAll') })}
        aria-pressed={isAllSelected}
        onClick={() => onTypesChange([])}
        data-testid="component-list-all-tab"
        className={`relative inline-flex h-11 items-center gap-2 px-4 rounded-lg border transition-all ${
          isAllSelected
            ? 'btn-theme-primary-soft font-semibold'
            : 'btn-theme-surface font-medium'
        }`}
      >
        {isAllSelected && (
          <Check className="h-4 w-4" aria-hidden="true" />
        )}
        {t('list.typeTabAll')}
      </button>
      {TAB_KEYS.map((tab) => {
        const label = t(`list.${tab.labelKey}`);
        const isSelected = selectedTypes.includes(tab.value);
        return (
        <button
          key={tab.value}
          type="button"
          aria-label={t('list.typeTabAria', { label })}
          aria-pressed={isSelected}
          onClick={() => toggleType(tab.value)}
          data-testid={`component-list-${tab.value}-tab`}
          className={`relative inline-flex h-11 items-center gap-2 px-4 rounded-lg border transition-all ${
            isSelected
              ? 'btn-theme-primary-soft font-semibold'
              : 'btn-theme-surface font-medium'
          }`}
        >
          {isSelected && (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {label}
        </button>
      );
      })}
    </div>
  );
}
