/**
 * useCreateComponent hook
 * Mutation for POST /api/components, invalidation, navigation (spec Appendix A.1)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createComponent } from '../services/api';
import { trackFeatureUsed } from '@/common/analytics/desktopAnalyticsBridge';
import { trackFirstValueOnce } from '@/common/analytics/activation';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import type {
  CreateComponentDto,
  ComponentCreateResponse,
} from '../types';

interface UseCreateComponentOptions {
  onSuccess?: (response: ComponentCreateResponse) => void;
}

export function useCreateComponent(options?: UseCreateComponentOptions) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: CreateComponentDto) => createComponent(data),
    onSuccess: (response) => {
      trackFeatureUsed('component_create', {
        action: 'submit',
        result: 'success',
        component_type: response.type,
      });
      trackFirstValueOnce('component_create', {
        component_type: response.type,
      });
      showSuccessToast(t('hooks.componentCreated'));
      options?.onSuccess?.(response);
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void navigate(`/components/${response.id}`);
    },
    onError: (error) => {
      trackFeatureUsed('component_create', {
        action: 'submit',
        result: 'failure',
      });
      showErrorToast(
        error instanceof Error ? error.message : t('hooks.componentCreateFailed')
      );
    },
  });
}
