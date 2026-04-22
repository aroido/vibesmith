/**
 * API 클라이언트 설정 테스트
 * - API base URL 설정 로직 (test 모드, file:// 환경)
 *
 * @see Issue #348 - file:// 환경에서 API base 미설정으로 file:///api로 요청되는 문제
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from './client';

describe('API client - base URL resolution', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('test 모드에서는 http://localhost:8000을 base로 사용', async () => {
    await apiFetch('/api/stats');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8000/api/stats',
      expect.any(Object)
    );
  });

  it('상대 경로를 올바른 절대 URL로 변환', async () => {
    await apiFetch('/api/components');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8000/api/components',
      expect.any(Object)
    );
  });
});
