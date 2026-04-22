/**
 * Component type selector
 * Radio buttons: Skill, Agent, Command (spec §5.3)
 */

import { useTranslation } from 'react-i18next';
import type { ComponentType } from '../types';

const TYPE_OPTIONS: { value: ComponentType; labelKey: string }[] = [
  { value: 'skill', labelKey: 'list.typeSkill' },
  { value: 'agent', labelKey: 'list.typeAgent' },
  { value: 'command', labelKey: 'list.typeCommand' },
];

interface ComponentTypeSelectorProps {
  selectedType: ComponentType;
  onTypeChange: (type: ComponentType) => void;
}

export function ComponentTypeSelector({
  selectedType,
  onTypeChange,
}: ComponentTypeSelectorProps) {
  const { t } = useTranslation('components');

  return (
    <fieldset
      className="space-y-3"
      aria-describedby="component-type-description"
    >
      <legend className="text-sm font-medium text-theme-primary">
        {t('create.componentType')} <span className="text-theme-danger">*</span>
      </legend>
      <p id="component-type-description" className="sr-only">
        {t('create.typeDescription')}
      </p>
      <div
        role="radiogroup"
        aria-label={t('create.typeRadiogroupAria')}
        className="flex gap-4 flex-wrap"
      >
        {TYPE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="radio"
              name="componentType"
              value={opt.value}
              checked={selectedType === opt.value}
              onChange={() => onTypeChange(opt.value)}
              className="h-4 w-4 rounded-full border border-theme bg-theme-surface accent-[var(--color-primary)]"
              aria-checked={selectedType === opt.value}
            />
            <span className="text-theme-primary">{t(opt.labelKey)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
