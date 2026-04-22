// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { fetchProjectComponents } from './api';
import type { Component } from '../../../common/types';

vi.mock('@/common/api', () => ({
  apiClient: vi.fn(),
}));

const mockComponent: Component = {
  id: 'comp_001',
  type: 'skill',
  name: 'alpha-skill',
  description: 'Alpha description',
  enabled: true,
  tags: ['alpha'],
  project_id: 'proj_001',
  project_name: 'vibesmith',
  path: '/tmp/alpha',
  created_at: '2026-02-24T00:00:00Z',
  updated_at: '2026-02-24T00:00:00Z',
};

describe('project-detail services/api', () => {
  describe('fetchProjectComponents', () => {
    it('returns array response as-is', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue([mockComponent]);

      const result = await fetchProjectComponents('proj_001');

      expect(result).toEqual([mockComponent]);
      expect(apiClient).toHaveBeenCalledWith('/api/projects/proj_001/components');
    });

    it('normalizes paginated response shape { items, total }', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue({
        items: [mockComponent],
        total: 1,
      });

      const result = await fetchProjectComponents('proj_001');

      expect(result).toEqual([mockComponent]);
    });

    it('normalizes legacy response shape { components, total }', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue({
        components: [mockComponent],
        total: 1,
      });

      const result = await fetchProjectComponents('proj_001');

      expect(result).toEqual([mockComponent]);
    });

    it('returns empty array when response shape is unexpected', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue({
        total: 0,
      });

      const result = await fetchProjectComponents('proj_001');

      expect(result).toEqual([]);
    });

    it('builds query string from filters', async () => {
      const { apiClient } = await import('@/common/api');
      vi.mocked(apiClient).mockResolvedValue([]);

      await fetchProjectComponents('proj_001', {
        type: 'skill',
        search: 'alpha',
        sortBy: 'name',
      });

      expect(apiClient).toHaveBeenCalledWith(
        '/api/projects/proj_001/components?type=skill&search=alpha&sort=name'
      );
    });
  });
});
