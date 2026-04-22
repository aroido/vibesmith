/**
 * Global Search Types
 * v1.11.0 - 전역 검색 타입 정의
 */

import type { Component } from '../../../common/types';

/**
 * 검색 결과 아이템 (Fuse.js 결과 포함)
 */
export interface SearchResultItem extends Component {
  // Fuzzy 검색 점수 (0-1, 낮을수록 좋음)
  score?: number;
  // 매칭된 인덱스 (하이라이팅용)
  matches?: {
    name?: [number, number][];
    description?: [number, number][];
  };
}

/**
 * 검색 상태
 */
export interface SearchState {
  query: string;
  results: SearchResultItem[];
  selectedIndex: number;
  recentSearches: string[];
  loading: boolean;
  error: Error | null;
}

/**
 * 검색 기록 (LocalStorage)
 */
export interface SearchHistory {
  queries: string[];
  maxSize: number;
}
