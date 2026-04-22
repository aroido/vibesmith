/**
 * Component mutations hook
 * delete, toggle with dependency warning flow
 * Toggle API performs toggle immediately; Cancel = rollback via toggle again
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteComponent, toggleComponent } from '../services/api';
import {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
} from '@/common/utils';
import type { ComponentDetail, DependencyItem } from '../types';

interface UseComponentMutationsOptions {
  componentName?: string;
}

/**
 * 구성요소 뮤테이션 훅 (삭제, 토글)
 * toggle 시 affected_dependencies 있으면 DependencyWarningModal 표시
 * Cancel 시 롤백: toggle API 재호출
 */
export function useComponentMutations(
  id: string | undefined,
  options: UseComponentMutationsOptions = {}
) {
  const { t } = useTranslation('common');
  const { componentName = '' } = options;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [affectedDependencies, setAffectedDependencies] = useState<
    DependencyItem[]
  >([]);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const invalidateAndToast = useCallback(
    (message: string, type: 'success' | 'info' = 'success') => {
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      if (type === 'success') {
        showSuccessToast(message);
      } else {
        showInfoToast(message);
      }
    },
    [queryClient]
  );

  const rollbackToggle = useCallback(async () => {
    if (!id) return;
    try {
      const rollback = await toggleComponent(id);
      queryClient.setQueryData<ComponentDetail>(['components', id], (old) =>
        old ? { ...old, enabled: rollback.enabled } : old
      );
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      showInfoToast(t('hooks.rollbackReverted'));
    } catch {
      showErrorToast(t('hooks.rollbackFailed'));
    }
  }, [id, queryClient, t]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteComponent(id!, { permanent: false }), // Soft Delete → 휴지통
    onSuccess: () => {
      showSuccessToast(t('hooks.movedToTrash'));
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      void navigate('/components');
    },
    onError: (error) => {
      showErrorToast(
        error instanceof Error ? error.message : t('hooks.componentDeleteFailed')
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => toggleComponent(id!),
    onSuccess: (data) => {
      queryClient.setQueryData<ComponentDetail>(['components', id], (old) =>
        old ? { ...old, enabled: data.enabled } : old
      );
      void queryClient.invalidateQueries({ queryKey: ['components'] });

      const deps = data.affected_dependencies ?? [];
      if (deps.length > 0) {
        setAffectedDependencies(deps);
        setPendingToggleId(id ?? null);
        setIsWarningModalOpen(true);
      } else {
        const message = data.enabled
          ? t('hooks.toggleEnabled')
          : t('hooks.toggleDisabled');
        showSuccessToast(message, {
          actionLabel: t('undo'),
          onAction: () => {
            void rollbackToggle();
          },
        });
        void queryClient.invalidateQueries({ queryKey: ['components'] });
      }
    },
    onError: () => {
      showErrorToast(t('hooks.toggleFailed'));
    },
  });

  const handleConfirmDependencyWarning = useCallback(() => {
    setIsWarningModalOpen(false);
    setPendingToggleId(null);
    setAffectedDependencies([]);
    invalidateAndToast(t('hooks.toggleDisabled'));
  }, [invalidateAndToast, t]);

  const handleCancelDependencyWarning = useCallback(async () => {
    if (!pendingToggleId) {
      setIsWarningModalOpen(false);
      return;
    }
    try {
      await toggleComponent(pendingToggleId);
      showInfoToast(t('hooks.canceled'));
    } catch {
      showErrorToast(t('hooks.rollbackConfirmFailed'));
    } finally {
      setIsWarningModalOpen(false);
      setPendingToggleId(null);
      setAffectedDependencies([]);
      void queryClient.invalidateQueries({ queryKey: ['components'] });
    }
  }, [pendingToggleId, queryClient, t]);

  return {
    deleteMutation,
    toggleMutation,
    isWarningModalOpen,
    affectedDependencies,
    componentNameForModal: componentName,
    onConfirmDependencyWarning: handleConfirmDependencyWarning,
    onCancelDependencyWarning: handleCancelDependencyWarning,
  };
}
