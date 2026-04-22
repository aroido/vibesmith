/**
 * Component action buttons
 * Edit, Toggle, Delete
 */

import { useTranslation } from 'react-i18next';

interface ComponentActionsProps {
  enabled: boolean;
  isEditing: boolean;
  isSaving?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

export function ComponentActions({
  enabled,
  isEditing,
  isSaving = false,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onDelete,
}: ComponentActionsProps) {
  const { t } = useTranslation('components');
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('edit.actionLabel')}>
      {isEditing ? (
        <>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg font-medium btn-theme-primary-soft transition-colors disabled:opacity-50"
            aria-label={t('edit.save')}
          >
            {isSaving ? t('edit.saving') : t('edit.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg font-medium btn-theme-surface transition-colors"
            aria-label={t('edit.cancel')}
          >
            {t('edit.cancel')}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 rounded-lg font-medium btn-theme-primary-soft transition-colors"
            aria-label={t('edit.editLabel')}
          >
            {t('edit.editLabel')}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="px-4 py-2 rounded-lg font-medium btn-theme-surface transition-colors"
            aria-label={enabled ? t('edit.toggleDisable') : t('edit.toggleEnable')}
          >
            {enabled ? t('edit.toggleOff') : t('edit.toggleOn')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 rounded-lg font-medium btn-theme-danger-soft transition-colors"
            aria-label={t('edit.deleteLabel')}
          >
            {t('edit.deleteLabel')}
          </button>
        </>
      )}
    </div>
  );
}
