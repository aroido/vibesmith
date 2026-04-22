// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { aggregateTags } from './useProjectTags';

describe('aggregateTags', () => {
  it('should aggregate tags with counts sorted by frequency', () => {
    const components = [
      { tags: ['auth', 'api'] },
      { tags: ['auth', 'ui'] },
      { tags: ['auth'] },
    ] as any[];

    const result = aggregateTags(components);
    expect(result).toEqual([
      { name: 'auth', count: 3 },
      { name: 'api', count: 1 },
      { name: 'ui', count: 1 },
    ]);
  });

  it('should return empty array for no tags', () => {
    expect(aggregateTags([])).toEqual([]);
  });

  it('should respect maxTags limit', () => {
    const components = [
      { tags: ['a', 'b', 'c', 'd'] },
    ] as any[];
    expect(aggregateTags(components, 2)).toHaveLength(2);
  });
});
