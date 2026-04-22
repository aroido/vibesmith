/**
 * Tag Color Utilities
 * v1.12.0 - 태그 색상 생성 (커스텀 레지스트리 우선, 해시 폴백)
 */

import { getTagCustomColor } from './tagColorRegistry';

function getHueFromTag(tag: string): number {
  const hash = tag.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return Math.abs(hash) % 360;
}

/**
 * 태그 텍스트 색상 (커스텀 우선)
 */
export function getTagColor(tag: string): string {
  const custom = getTagCustomColor(tag);
  if (custom) return `hsl(${custom})`;
  return `hsl(${getHueFromTag(tag)}, 70%, 50%)`;
}

/**
 * 태그 배경 색상 (반투명, 커스텀 우선)
 */
export function getTagBackgroundColor(tag: string): string {
  const custom = getTagCustomColor(tag);
  if (custom) return `hsla(${custom}, 0.2)`;
  const hue = getHueFromTag(tag);
  return `hsla(${hue}, 70%, 50%, 0.2)`;
}

/**
 * 태그 테두리 색상 (커스텀 우선)
 */
export function getTagBorderColor(tag: string): string {
  const custom = getTagCustomColor(tag);
  if (custom) return `hsla(${custom}, 0.5)`;
  const hue = getHueFromTag(tag);
  return `hsla(${hue}, 70%, 50%, 0.5)`;
}
