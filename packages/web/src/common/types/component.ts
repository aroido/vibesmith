/**
 * 공통 구성요소 타입 정의
 *
 * 모든 feature에서 이 파일의 ComponentType을 참조합니다.
 * feature별로 별도 정의하지 마세요.
 */

/** 구성요소 타입 */
export type ComponentType = 'skill' | 'agent' | 'command' | 'hook' | 'rule';

/** 사용 가능한 구성요소 타입 목록 */
export const COMPONENT_TYPES: readonly ComponentType[] = [
  'skill',
  'agent',
  'command',
  'hook',
  'rule',
] as const;

/** 구성요소 타입별 표시 라벨 */
export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  hook: 'Hook',
  rule: 'Rule',
};
