/**
 * Token estimation utility (Spec §6.2)
 * 1 token ≈ 4 characters (OpenAI convention)
 * Backend 미구현 시 프론트엔드에서 파일 크기 기반 계산
 */

/**
 * Estimate tokens from file size (bytes)
 * @param fileSize - File size in bytes
 * @returns Estimated token count
 */
export function estimateTokens(fileSize: number): number {
  // 1 token ≈ 4 characters
  return Math.ceil(fileSize / 4);
}

export interface ComponentWithSize {
  is_active?: boolean;
  file_size?: number;
}

/**
 * Calculate total tokens for active components
 */
export function calculateTotalTokens(components: ComponentWithSize[]): number {
  return components
    .filter((c) => c.is_active !== false)
    .reduce((sum, c) => sum + estimateTokens(c.file_size ?? 0), 0);
}
