/**
 * path-preview 유틸리티 테스트
 * Issue #324: 미리보기 경로가 실제 저장 규칙과 일치하는지 검증
 */

import { describe, it, expect } from 'vitest';
import {
  buildComponentFilePath,
  isHookType,
  type BuildPathParams,
} from './path-preview';

const PROJECT_PATH = '/Users/dev/my-project';

describe('buildComponentFilePath', () => {
  it.each([
    {
      type: 'skill' as const,
      name: 'my-skill',
      platform: 'claude_code' as const,
      expected: `${PROJECT_PATH}/.claude/skills/my-skill/SKILL.md`,
    },
    {
      type: 'skill' as const,
      name: 'my-skill',
      platform: 'cursor' as const,
      expected: `${PROJECT_PATH}/.cursor/skills/my-skill/SKILL.md`,
    },
    {
      type: 'agent' as const,
      name: 'code-reviewer',
      platform: 'claude_code' as const,
      expected: `${PROJECT_PATH}/.claude/agents/code-reviewer.md`,
    },
    {
      type: 'agent' as const,
      name: 'code-reviewer',
      platform: 'cursor' as const,
      expected: `${PROJECT_PATH}/.cursor/agents/code-reviewer.md`,
    },
    {
      type: 'command' as const,
      name: 'run-tests',
      platform: 'claude_code' as const,
      expected: `${PROJECT_PATH}/.claude/commands/run-tests.md`,
    },
    {
      type: 'command' as const,
      name: 'run-tests',
      platform: 'cursor' as const,
      expected: `${PROJECT_PATH}/.cursor/commands/run-tests.md`,
    },
    {
      type: 'rule' as const,
      name: 'project-rules',
      platform: 'claude_code' as const,
      expected: `${PROJECT_PATH}/.claude/rules/project-rules.md`,
    },
    {
      type: 'rule' as const,
      name: 'project-rules',
      platform: 'cursor' as const,
      expected: `${PROJECT_PATH}/.cursor/rules/project-rules.mdc`,
    },
    {
      type: 'hook' as const,
      name: 'on-save',
      platform: 'claude_code' as const,
      expected: `${PROJECT_PATH}/.claude/settings.json`,
    },
    {
      type: 'hook' as const,
      name: 'on-save',
      platform: 'cursor' as const,
      expected: `${PROJECT_PATH}/.cursor/settings.json`,
    },
  ])(
    '$type + $platform => $expected',
    ({ type, name, platform, expected }) => {
      const params: BuildPathParams = {
        projectPath: PROJECT_PATH,
        componentType: type,
        name,
        platform,
      };
      expect(buildComponentFilePath(params)).toBe(expected);
    }
  );

  it('agent는 agents/<name>.md (폴더 구조 아님)', () => {
    const path = buildComponentFilePath({
      projectPath: PROJECT_PATH,
      componentType: 'agent',
      name: 'my-agent',
      platform: 'claude_code',
    });
    expect(path).toBe(`${PROJECT_PATH}/.claude/agents/my-agent.md`);
    expect(path).not.toContain('AGENT.md');
    expect(path).not.toContain('my-agent/');
  });

  it('command는 commands/<name>.md (폴더 구조 아님)', () => {
    const path = buildComponentFilePath({
      projectPath: PROJECT_PATH,
      componentType: 'command',
      name: 'my-cmd',
      platform: 'cursor',
    });
    expect(path).toBe(`${PROJECT_PATH}/.cursor/commands/my-cmd.md`);
    expect(path).not.toContain('COMMAND.md');
    expect(path).not.toContain('my-cmd/');
  });
});

describe('isHookType', () => {
  it('hook 타입이면 true', () => {
    expect(isHookType('hook')).toBe(true);
  });

  it('hook 외 타입이면 false', () => {
    expect(isHookType('skill')).toBe(false);
    expect(isHookType('agent')).toBe(false);
    expect(isHookType('command')).toBe(false);
    expect(isHookType('rule')).toBe(false);
  });
});
