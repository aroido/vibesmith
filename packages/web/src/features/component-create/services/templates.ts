/**
 * Component templates
 */

import type { ComponentType } from '../types';

const SKILL_TEMPLATE = `---
name: {name}
description: {description}
allowed-tools: [Read, Write, Bash]
---

# {name}

## Usage

This skill helps you...

## Examples

\`\`\`
Example usage here
\`\`\`
`;

const AGENT_TEMPLATE = `---
name: {name}
description: {description}
tools: [all]
model: claude-sonnet-4
permissionMode: ask
---

You are a specialized agent that...

## Instructions

1. Step 1
2. Step 2
`;

const COMMAND_TEMPLATE = `# {name}

{description}

## Usage

Use this command to...
`;

/** 템플릿이 제공되는 타입 (component-create UI에서 지원하는 타입) */
const TEMPLATES: Partial<Record<ComponentType, string>> = {
  skill: SKILL_TEMPLATE,
  agent: AGENT_TEMPLATE,
  command: COMMAND_TEMPLATE,
};

/**
 * 타입에 맞는 템플릿 반환
 * @param type - 구성요소 타입
 * @param name - 이름 (플레이스홀더 치환)
 * @param description - 설명 (플레이스홀더 치환)
 */
export function getTemplate(
  type: ComponentType,
  name: string,
  description: string
): string {
  const template = TEMPLATES[type];
  if (!template) {
    return `# ${name}\n\n${description || 'A component that does something useful'}\n`;
  }
  return template
    .replace(/{name}/g, name || 'my-new-component')
    .replace(/{description}/g, description || 'A component that does something useful');
}
