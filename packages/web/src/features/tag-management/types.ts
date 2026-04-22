/**
 * Tag Management Types
 * v1.12.0 - 태그 관리 타입 정의
 */

/**
 * 태그 (기본)
 */
export type Tag = string;

/**
 * 태그 통계
 */
export interface TagStats {
  tag: string;
  count: number;
  color?: string; // 커스텀 색상 (Should Have)
}

/**
 * 태그 입력 상태
 */
export interface TagInputState {
  tags: Tag[];
  inputValue: string;
  suggestions: Tag[];
  showSuggestions: boolean;
}

/**
 * 태그 필터 상태
 */
export interface TagFilterState {
  selectedTags: Tag[];
  popularTags: TagStats[];
}
