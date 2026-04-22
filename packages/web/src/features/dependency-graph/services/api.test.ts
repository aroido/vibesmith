/**
 * Dependency Graph API 서비스 테스트
 * Issue #314: API 실패 시 mock fallback 제거 검증
 */

import { describe, it, expect, vi } from 'vitest';
import { api } from './api';

vi.mock('@/common/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('./mockData', () => ({
  mockGraphData: { nodes: [], edges: [], cycles: [] },
  mockDependencyDetail: {},
}));

describe('Dependency Graph API', () => {
  describe('getDependencies (실제 API 모드)', () => {
    it('API 실패 시 mock fallback 없이 에러를 전파해야 함', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockRejectedValue(new Error('Network error'));

      await expect(
        api.getDependencies({
          project_id: null,
          types: ['skill', 'agent', 'command', 'hook', 'rule'],
          includeGlobal: false,
        })
      ).rejects.toThrow('Network error');

      expect(apiClient).toHaveBeenCalledTimes(1);
    });

    it('API 성공 시 데이터를 반환해야 함', async () => {
      const { apiClient } = await import('@/common/api');
      const mockData = {
        nodes: [{ id: '1', name: 'test', type: 'skill' as const, project_id: 'p1', enabled: true }],
        edges: [],
        cycles: [],
      };
      vi.mocked(apiClient).mockResolvedValue(mockData);

      const result = await api.getDependencies({
        project_id: null,
        types: ['skill'],
        includeGlobal: false,
      });

      expect(result).toEqual(mockData);
      expect(apiClient).toHaveBeenCalledWith('/api/dependencies?type=skill');
    });

    it('API 응답 포맷이 깨져도 빈 그래프로 정규화해야 함', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue([]);

      const result = await api.getDependencies({
        project_id: null,
        types: ['skill'],
        includeGlobal: false,
      });

      expect(result).toEqual({ nodes: [], edges: [], cycles: [] });
      expect(apiClient).toHaveBeenCalledWith('/api/dependencies?type=skill');
    });

    it('다중 타입 필터를 반복 query param으로 전달해야 함', async () => {
      const { apiClient } = await import('@/common/api');
      const mockData = {
        nodes: [],
        edges: [],
        cycles: [],
      };
      vi.mocked(apiClient).mockResolvedValue(mockData);

      await api.getDependencies({
        project_id: 'proj_123',
        types: ['skill', 'agent', 'command'],
        includeGlobal: false,
      });

      expect(apiClient).toHaveBeenCalledWith(
        '/api/dependencies?project_id=proj_123&type=skill&type=agent&type=command'
      );
    });
  });
});
