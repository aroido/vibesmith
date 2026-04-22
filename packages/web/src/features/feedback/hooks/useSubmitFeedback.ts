/**
 * Feedback submit mutation hook
 */

import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '@/common/utils';
import { ApiError } from '@/common/api/errors';
import { submitFeedback } from '../services/api';
import type { FeedbackRequest, FeedbackResponse } from '../types';

export function useSubmitFeedback() {
  const { t } = useTranslation('feedback');

  return useMutation<FeedbackResponse, Error, FeedbackRequest>({
    mutationFn: submitFeedback,
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.messageKey === 'errors.feedback_token_not_configured'
      ) {
        // Dialog에서 브라우저 이슈 생성 폴백 안내를 처리한다.
        return;
      }
      showErrorToast(error instanceof Error ? error.message : t('errors.submitFailed'));
    },
  });
}
