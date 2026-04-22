import { describe, expect, it } from 'vitest';
import { queryClient } from './queryClient';

describe('queryClient defaults', () => {
  it('uses always-refetch on window focus for live updates', () => {
    const queryDefaults = queryClient.getDefaultOptions().queries;
    expect(queryDefaults?.refetchOnWindowFocus).toBe('always');
    expect(queryDefaults?.refetchOnReconnect).toBe(true);
  });
});
