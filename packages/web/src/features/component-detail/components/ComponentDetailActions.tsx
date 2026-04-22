/**
 * Component detail action buttons (copy, toggle, delete)
 * Spec: component-copy-api.md - Copy + CopyToProjectModal integration
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentDetail, DependencyItem } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CopyToProjectModal } from './CopyToProjectModal';
import { DependencyWarningModal } from './DependencyWarningModal';

interface ComponentDetailActionsProps {
  component: ComponentDetail;
  onDelete: () => void;
  onToggle: () => void;
  isToggling?: boolean;
  /** Shown when toggle API returns affected_dependencies */
  isDependencyWarningOpen?: boolean;
  affectedDependencies?: DependencyItem[];
  onDependencyWarningConfirm?: () => void;
  onDependencyWarningCancel?: () => void;
}

export function ComponentDetailActions({
  component,
  onDelete,
  onToggle,
  isToggling = false,
  isDependencyWarningOpen = false,
  affectedDependencies = [],
  onDependencyWarningConfirm,
  onDependencyWarningCancel,
}: ComponentDetailActionsProps) {
  const { t } = useTranslation('components');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const handleDeleteClick = () => setIsDeleteModalOpen(true);
  const handleDeleteConfirm = () => {
    onDelete();
    setIsDeleteModalOpen(false);
  };
  const handleDeleteCancel = () => setIsDeleteModalOpen(false);
  const handleCopyClick = () => setIsCopyModalOpen(true);
  const handleCopyModalClose = () => setIsCopyModalOpen(false);

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleCopyClick}
          data-testid="component-detail-copy-button"
          className="px-4 py-2 rounded-lg btn-theme-surface transition-colors"
          aria-label={t('detail.copyAria')}
        >
          {t('copy.title')}
        </button>
        {component.type !== 'hook' && (
          <button
            onClick={onToggle}
            disabled={isToggling}
            data-testid="component-detail-toggle-button"
            className="px-4 py-2 rounded-lg btn-theme-surface transition-colors disabled:opacity-50"
            aria-label={component.enabled ? t('detail.disableAria') : t('detail.enableAria')}
          >
            {component.enabled ? t('detail.disableButton') : t('detail.enableButton')}
          </button>
        )}
        <button
          onClick={handleDeleteClick}
          data-testid="component-detail-delete-button"
          className="px-4 py-2 rounded-lg btn-theme-danger-soft transition-colors"
          aria-label={t('detail.delete')}
        >
          {t('detail.delete')}
        </button>
      </div>

      <CopyToProjectModal
        isOpen={isCopyModalOpen}
        componentId={component.id}
        componentName={component.name}
        sourceProjectId={component.project_id}
        onClose={handleCopyModalClose}
        onSuccess={handleCopyModalClose}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        componentName={component.name}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {isDependencyWarningOpen && onDependencyWarningConfirm && onDependencyWarningCancel && (
        <DependencyWarningModal
          isOpen={isDependencyWarningOpen}
          componentName={component.name}
          affectedDependencies={affectedDependencies}
          onConfirm={onDependencyWarningConfirm}
          onCancel={onDependencyWarningCancel}
        />
      )}
    </>
  );
}
