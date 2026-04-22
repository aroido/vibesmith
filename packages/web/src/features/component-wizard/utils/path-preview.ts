/**
 * 파일 경로 미리보기 유틸리티
 *
 * Issue #324: 실제 저장 규칙(scanner, operations)과 동일한 경로 생성
 * 백엔드 packages/core: scanner.py, operations.py 규칙 반영
 *
 * 규칙:
 * - skill: .claude|.cursor/skills/<name>/SKILL.md
 * - agent:  .claude|.cursor/agents/<name>.md
 * - command: .claude|.cursor/commands/<name>.md
 * - rule:   .claude|.cursor/rules/<name>.md (claude) | <name>.mdc (cursor)
 * - hook:   .claude|.cursor/settings.json (병합됨, 개별 파일 없음)
 */

import type { ComponentType } from '@/common/types';

export interface BuildPathParams {
  projectPath: string;
  componentType: ComponentType;
  name: string;
  platform: 'claude_code' | 'cursor';
}

/**
 * 백엔드 operations.create / _resolve_copy_path_and_content 규칙과
 * 동일한 파일 경로를 생성한다.
 */
export function buildComponentFilePath(params: BuildPathParams): string {
  const { projectPath, componentType, name, platform } = params;

  const platformDir = platform === 'cursor' ? '.cursor' : '.claude';
  const base = `${projectPath}/${platformDir}`;

  switch (componentType) {
    case 'skill':
      return `${base}/skills/${name}/SKILL.md`;
    case 'agent':
      return `${base}/agents/${name}.md`;
    case 'command':
      return `${base}/commands/${name}.md`;
    case 'rule':
      return platform === 'cursor'
        ? `${base}/rules/${name}.mdc`
        : `${base}/rules/${name}.md`;
    case 'hook':
      return `${base}/settings.json`;
    default:
      return '';
  }
}

/**
 * hook 타입은 settings.json에 병합되므로 개별 파일 경로 미리보기 대신
 * 설명 메시지를 반환할 때 사용한다.
 */
export function isHookType(componentType: ComponentType): boolean {
  return componentType === 'hook';
}
