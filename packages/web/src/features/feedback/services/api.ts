/**
 * Feedback feature API client
 * POST /api/feedback
 */

import { apiClient } from '@/common/api';
import type { FeedbackRequest, FeedbackResponse } from '../types';

/**
 * 사용자 피드백 제출
 */
export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  return apiClient<FeedbackResponse>('/api/feedback/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
