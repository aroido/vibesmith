/**
 * Content parser utility
 * Extracts body from content (after frontmatter), assembles content with frontmatter
 * Spec §6.3
 */

/**
 * frontmatter + 본문에서 본문만 추출
 * ---\n...\n---\n 이후 내용 반환
 */
export function extractBody(content: string): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    return match[2] ?? content;
  }
  return content;
}

/**
 * frontmatter 파싱
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1];
  const result: Record<string, unknown> = {};
  for (const line of block.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueStr = line.slice(colonIdx + 1).trim();
    try {
      result[key] = JSON.parse(valueStr);
    } catch {
      result[key] = valueStr.replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

/**
 * name, description을 반영한 frontmatter + 본문 조립
 * Spec §6.3 저장 시 content 조립 로직
 */
export function assembleContent(
  existingFrontmatter: Record<string, unknown> | null,
  name: string,
  description: string,
  body: string
): string {
  const updated = {
    ...(existingFrontmatter ?? {}),
    name,
    description,
  };
  const lines = Object.entries(updated)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
