/**
 * Stats API Client
 * Issue #501: Mock API → 실제 API 교체
 */

import { apiClient } from '../client';
import type { ContextStatsResponse } from '@features/dashboard/types';

/**
 * 구성요소별 토큰 정보
 */
export interface ComponentTokenInfo {
  id: string;
  name: string;
  type: string;
  estimated_tokens: number;
  file_size_bytes: number;
}

/**
 * 최적화 제안
 */
export interface OptimizationSuggestion {
  type: 'oversized' | 'duplicate' | 'tech_mismatch' | 'global_overuse';
  component_id: string;
  component_name: string;
  reason: string;
  action: 'split' | 'merge' | 'disable' | 'move';
  priority: 'high' | 'medium' | 'low';
  similarity_score?: number | null;
}

/**
 * 샘플 구성요소 정보
 */
export interface SampleComponentInfo {
  id: string;
  name: string;
  type: string;
  description: string;
}

/**
 * 샘플 프로젝트 생성 응답
 */
export interface CreateSampleProjectResponse {
  project_id: string;
  path: string;
  components_count: number;
  components: SampleComponentInfo[];
}

/**
 * 샘플 프로젝트 생성 요청
 */
export interface CreateSampleProjectRequest {
  target_path?: string;
}

/**
 * Context Stats API
 */
export const statsApi = {
  /**
   * 컨텍스트 최적화 통계 조회 (플랫폼별 계층)
   * GET /api/stats/context
   */
  getContextStats: async (projectId?: string): Promise<ContextStatsResponse> => {
    const queryString = projectId ? `?project_id=${projectId}` : '';
    return apiClient<ContextStatsResponse>(`/api/stats/context${queryString}`);
  },

  /**
   * 샘플 프로젝트 생성
   * POST /api/sample-project
   */
  createSampleProject: async (
    req: CreateSampleProjectRequest = {}
  ): Promise<CreateSampleProjectResponse> => {
    return apiClient<CreateSampleProjectResponse>('/api/sample-project', {
      method: 'POST',
      body: JSON.stringify({
        target_path: req.target_path ?? '~/vibesmith-sample',
      }),
    });
  },
};
