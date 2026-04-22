/**
 * Fuzzy Search Service
 * v1.11.0 - Fuse.js 기반 Fuzzy 검색
 */

import Fuse from 'fuse.js';
import type { Component } from '../../../common/types';
import type { SearchResultItem } from '../types';
import type { IFuseOptions } from 'fuse.js';

/**
 * Fuse.js 옵션
 * Issue #69: 검색 가중치 최적화
 */
const fuseOptions: IFuseOptions<Component> = {
  keys: [
    { name: 'name', weight: 0.5 },        // 이름 (가장 높은 가중치)
    { name: 'type', weight: 0.2 },        // 타입 (skill, agent, etc.)
    { name: 'tags', weight: 0.15 },       // 태그
    { name: 'description', weight: 0.15 }, // 설명
  ],
  threshold: 0.35, // 0.0 (완전 일치) ~ 1.0 (모든 것 매칭) - 더 정확한 매칭
  includeScore: true,
  includeMatches: true, // 하이라이팅용
  minMatchCharLength: 2,
  ignoreLocation: true,
  distance: 100, // 검색어와의 거리 허용치
  useExtendedSearch: true, // 고급 검색 패턴 지원
};

/**
 * Fuzzy 검색 수행
 * 
 * @param components - 검색 대상 구성요소 목록
 * @param query - 검색어
 * @returns 검색 결과 (점수 및 매칭 정보 포함)
 */
 
export function fuzzySearch(
  components: Component[],
  query: string
): SearchResultItem[] {
  if (!query.trim()) {
    // 검색어가 없으면 모든 구성요소 반환 (최근 업데이트 순)
    return components
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 50) as SearchResultItem[];
  }

  const fuse = new Fuse(components, fuseOptions);
  const results = fuse.search(query);

  // Fuse.js 결과를 SearchResultItem으로 변환
  return results.map((result) => {
    const matches: SearchResultItem['matches'] = {};

    // 매칭된 인덱스 추출 (하이라이팅용)
    if (result.matches) {
      for (const match of result.matches) {
        if (match.key === 'name' && match.indices) {
          matches.name = match.indices as [number, number][];
        } else if (match.key === 'description' && match.indices) {
          matches.description = match.indices as [number, number][];
        }
      }
    }

    return {
      ...result.item,
      score: result.score,
      matches,
    };
  });
}
 

/**
 * 텍스트 하이라이팅
 * 
 * @param text - 원본 텍스트
 * @param indices - 매칭된 인덱스 배열
 * @returns 하이라이팅된 텍스트 (HTML)
 */
export function highlightMatches(
  text: string,
  indices?: [number, number][]
): string {
  if (!indices || indices.length === 0) {
    return text;
  }

  let result = '';
  let lastIndex = 0;

  // 인덱스 정렬 (시작 위치 기준)
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedIndices) {
    // 매칭되지 않은 부분
    result += text.slice(lastIndex, start);
    // 매칭된 부분 (강조)
    result += `<mark class="bg-theme-hover text-theme-primary">${text.slice(start, end + 1)}</mark>`;
    lastIndex = end + 1;
  }

  // 나머지 부분
  result += text.slice(lastIndex);

  return result;
}
