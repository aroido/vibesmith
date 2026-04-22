/**
 * Tag Autocomplete Utilities
 * v1.12.0 - 태그 자동완성 유틸리티
 */

/**
 * 자동완성 제안 필터링
 * 
 * @param input - 입력 값
 * @param allTags - 전체 태그 목록
 * @param currentTags - 현재 선택된 태그 목록
 * @returns 필터링된 제안 목록
 */
export function filterSuggestions(
  input: string,
  allTags: string[],
  currentTags: string[]
): string[] {
  if (!input.trim()) {
    // 입력이 없으면 현재 선택되지 않은 모든 태그 반환
    return allTags
      .filter((tag) => !currentTags.includes(tag))
      .slice(0, 10);
  }

  const lowerInput = input.toLowerCase();
  
  return allTags
    .filter((tag) => {
      // 이미 선택된 태그 제외
      if (currentTags.includes(tag)) {
        return false;
      }
      // 입력값이 포함된 태그만 포함
      return tag.toLowerCase().includes(lowerInput);
    })
    .sort((a, b) => {
      // 시작 위치가 앞쪽인 태그 우선
      const aIndex = a.toLowerCase().indexOf(lowerInput);
      const bIndex = b.toLowerCase().indexOf(lowerInput);
      return aIndex - bIndex;
    })
    .slice(0, 10); // 최대 10개
}
