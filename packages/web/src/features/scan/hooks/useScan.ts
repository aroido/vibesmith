/**
 * useScan hook
 * React Query mutation for POST /api/scan (spec Appendix A.1)
 * 비동기 스캔: POST는 즉시 반환, 완료는 scan-progress 폴링으로 감지
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import { scan } from '../services/api';
import type { ScanRequest, ScanResponse } from '../types';

interface UseScanOptions {
  onSuccess?: (result: ScanResponse) => void;
}

export function useScan(options?: UseScanOptions) {
  const { t } = useTranslation('scan');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ScanRequest = {}) => scan(request),
    onSuccess: (data, variables) => {
      options?.onSuccess?.(data);

      if (data.status === 'already_running') {
        showSuccessToast(t('toastAlreadyRunning', { defaultValue: 'Scan is already running' }));
        return;
      }

      let messageKey = 'toastStarted';
      if (variables.home_path) messageKey = 'toastGlobalPathStarted';
      else if (variables.cursor_global_path) messageKey = 'toastCursorGlobalPathStarted';
      else if (variables.root_path) messageKey = 'toastProjectAddStarted';

      showSuccessToast(t(messageKey, { defaultValue: 'Scan started' }));

      // scan-progress 폴링 강제 갱신
      void queryClient.invalidateQueries({ queryKey: ['scan-progress'] });
    },
    onError: (error: Error) => {
      showErrorToast(t('toastError', { message: error.message }));
    },
  });
}
