import { useMemo } from 'react';
import type { Component } from '../../../common/types';

export interface TagCount {
  name: string;
  count: number;
}

export function aggregateTags(components: Component[], maxTags = 20): TagCount[] {
  const freq = new Map<string, number>();
  for (const c of components) {
    for (const tag of c.tags ?? []) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxTags);
}

export function useProjectTags(components: Component[], maxTags = 20): TagCount[] {
  return useMemo(() => aggregateTags(components, maxTags), [components, maxTags]);
}
