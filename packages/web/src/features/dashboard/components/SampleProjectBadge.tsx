/**
 * SampleProjectBadge - 샘플 프로젝트 배지 + 삭제 (Spec §5.2.2)
 * Tailwind + Radix AlertDialog
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface SampleProjectBadgeProps {
  projectId: string;
  projectName?: string;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function SampleProjectBadge({
  projectId: _projectId, // Reserved for future use (e.g. analytics)
  projectName,
  onDelete,
  isDeleting = false,
}: SampleProjectBadgeProps) {
  const { t } = useTranslation('dashboard');
  const [isOpen, setIsOpen] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleConfirm = () => {
    onDelete();
    setIsOpen(false);
  };

  const handleCancel = () => setIsOpen(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold badge-theme-warning"
          aria-label={t('sampleBadge.ariaLabel')}
        >
          SAMPLE
        </span>
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="
            p-1.5 rounded-lg
            btn-theme-danger-soft
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
          aria-label={t('sampleBadge.ariaDelete', { name: projectName ?? 'Sample' })}
        >
          {isDeleting ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-theme-danger" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-primary">
              {t('sampleBadge.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary">
              {t('sampleBadge.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancel}
              className="btn-theme-surface"
            >
              {t('sampleBadge.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="btn-theme-danger-soft"
            >
              {t('sampleBadge.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
