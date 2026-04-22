/**
 * Tag Validation Utilities
 * v1.12.0 - 태그 검증 유틸리티
 */

export const MAX_TAG_LENGTH = 20;
export const MAX_TAGS = 10;
const TAG_REGEX = /^[a-zA-Z0-9-_]+$/;

/**
 * 태그 유효성 검사
 * 
 * @param tag - 태그 이름
 * @returns 유효성 검사 결과 (errorKey는 i18n 키)
 */
export function validateTag(tag: string): { valid: boolean; errorKey?: string } {
  if (!tag.trim()) {
    return { valid: false, errorKey: 'settings.tags.errors.empty' };
  }

  if (tag.length > MAX_TAG_LENGTH) {
    return { valid: false, errorKey: 'settings.tags.errors.tooLong' };
  }

  if (!TAG_REGEX.test(tag)) {
    return { valid: false, errorKey: 'settings.tags.errors.invalidFormat' };
  }

  return { valid: true };
}

/**
 * 태그 목록 유효성 검사
 * 
 * @param tags - 태그 목록
 * @returns 유효성 검사 결과 (errorKey는 i18n 키)
 */
export function validateTags(tags: string[]): { valid: boolean; errorKey?: string } {
  if (tags.length > MAX_TAGS) {
    return { valid: false, errorKey: 'settings.tags.errors.tooMany' };
  }

  return { valid: true };
}

/**
 * 태그 정규화 (소문자 변환, 공백 제거)
 * 
 * @param tag - 태그 이름
 * @returns 정규화된 태그
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}
