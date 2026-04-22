/**
 * Tag Color Registry - localStorage 기반 커스텀 색상 저장
 * Settings 태그 관리에서 설정한 색상을 persist
 */

const STORAGE_KEY = 'vibesmith_tag_colors';

/** Tailwind/Chakra 스타일 색상 팔레트 (HSL 기반) */
export const TAG_COLOR_PALETTE = [
  { name: 'blue', hsl: '210, 70%, 50%' },
  { name: 'cyan', hsl: '187, 70%, 50%' },
  { name: 'teal', hsl: '168, 70%, 45%' },
  { name: 'green', hsl: '142, 70%, 45%' },
  { name: 'emerald', hsl: '160, 70%, 45%' },
  { name: 'lime', hsl: '84, 70%, 45%' },
  { name: 'yellow', hsl: '48, 90%, 50%' },
  { name: 'amber', hsl: '38, 92%, 50%' },
  { name: 'orange', hsl: '25, 95%, 53%' },
  { name: 'red', hsl: '0, 72%, 51%' },
  { name: 'rose', hsl: '346, 77%, 50%' },
  { name: 'pink', hsl: '330, 70%, 55%' },
  { name: 'fuchsia', hsl: '292, 84%, 61%' },
  { name: 'purple', hsl: '270, 70%, 55%' },
  { name: 'violet', hsl: '258, 70%, 58%' },
  { name: 'indigo', hsl: '239, 70%, 55%' },
  { name: 'slate', hsl: '215, 20%, 45%' },
] as const;

export type TagColorName = (typeof TAG_COLOR_PALETTE)[number]['name'];

export interface TagColorRegistry {
  [tag: string]: string; // tag -> HSL string e.g. "210, 70%, 50%"
}

function loadRegistry(): TagColorRegistry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TagColorRegistry;
    return typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveRegistry(registry: TagColorRegistry): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

export function getTagCustomColor(tag: string): string | null {
  const registry = loadRegistry();
  return registry[tag] ?? null;
}

export function setTagCustomColor(tag: string, hsl: string): void {
  const registry = loadRegistry();
  registry[tag] = hsl;
  saveRegistry(registry);
}

export function removeTagCustomColor(tag: string): void {
  const registry = loadRegistry();
  delete registry[tag];
  saveRegistry(registry);
}

export function getAllTagColors(): TagColorRegistry {
  return loadRegistry();
}
