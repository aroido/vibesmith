/**
 * Component Type Display
 * 읽기 전용 - 구성요소 타입 표시
 */

import { useTranslation } from 'react-i18next';
import { ComponentIcon } from '@/components/common';
import type { ComponentType } from '@/features/component-detail';

interface ComponentTypeDisplayProps {
  type: ComponentType;
}

const TYPE_KEYS: Record<ComponentType, string> = {
  skill: 'edit.typeSkill',
  agent: 'edit.typeAgent',
  command: 'edit.typeCommand',
  hook: 'edit.typeHook',
  rule: 'edit.typeRule',
};

export function ComponentTypeDisplay({ type }: ComponentTypeDisplayProps) {
  const { t } = useTranslation('components');
  const label = t(TYPE_KEYS[type] ?? type);

  return (
    <div className="vs-frost-panel rounded-xl p-6">
      <h2 className="text-lg font-semibold text-theme-primary mb-4">
        {t('edit.componentType')}
      </h2>
      <div className="flex items-center gap-3 text-theme-secondary">
        <ComponentIcon type={type} aria-label={label as string} />
        <span className="font-mono text-primary">{label}</span>
      </div>
    </div>
  );
}
