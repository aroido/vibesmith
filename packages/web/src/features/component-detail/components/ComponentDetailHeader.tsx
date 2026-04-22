/**
 * Component detail header
 * 이름(인라인 편집), 타입 배지, 활성화 상태, 액션 버튼 (Copy, Toggle, Delete)
 */

import { useTranslation } from 'react-i18next';
import { ComponentIcon } from '@/components/common';
import { InlineEditField } from './InlineEditField';
import { ComponentDetailActions } from './ComponentDetailActions';
import type { ComponentDetail } from '../types';

interface ComponentDetailHeaderProps {
  component: ComponentDetail;
  onDelete: () => void;
  onToggle: () => void;
  isToggling?: boolean;
  onUpdateName?: (name: string) => void;
  isSaving?: boolean;
  /** 개요 탭 편집 모드와 연동 */
  isEditing?: boolean;
}

export function ComponentDetailHeader({
  component,
  onDelete,
  onToggle,
  isToggling = false,
  onUpdateName,
  isSaving = false,
  isEditing = false,
}: ComponentDetailHeaderProps) {
  const { t } = useTranslation('components');
  return (
    <div className="vs-frost-panel flex flex-wrap items-start justify-between gap-4 rounded-xl p-6">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <ComponentIcon type={component.type} aria-label={t('detail.componentTypeAria', { type: component.type })} />
        <div className="min-w-0">
          {isEditing && onUpdateName ? (
            <InlineEditField
              value={component.name}
              onSave={onUpdateName}
              isSaving={isSaving}
              as="h1"
              className="text-2xl font-bold text-theme-primary font-display"
            />
          ) : (
            <h1 className="text-2xl font-bold text-theme-primary font-display truncate">
              {component.name}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded badge-theme-info">
              {component.type}
            </span>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                component.type === 'hook'
                  ? 'badge-theme-info'
                  : component.enabled
                    ? 'badge-theme-success'
                    : 'badge-theme-muted'
              }`}
              aria-label={
                component.type === 'hook'
                  ? t('detail.hookAlwaysActiveAria')
                  : component.enabled ? t('detail.enabledLabel') : t('detail.disabledLabel')
              }
            >
              {component.type === 'hook'
                ? t('detail.hookAlwaysActive')
                : component.enabled ? t('detail.enabled') : t('detail.disabled')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ComponentDetailActions
          component={component}
          onDelete={onDelete}
          onToggle={onToggle}
          isToggling={isToggling}
        />
      </div>
    </div>
  );
}
