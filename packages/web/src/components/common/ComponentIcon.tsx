/**
 * Component type icon (공통 컴포넌트)
 * Skill, Agent, Command, Hook, Rule
 *
 * 이전 위치: features/component-list/components/ComponentIcon.tsx
 * v1.5.0에서 공통 컴포넌트로 이동
 */

import { useTranslation } from 'react-i18next';
import {
  Bot,
  BookOpen,
  FileText,
  Link2,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from '@/common/types';

const TYPE_ICONS: Record<ComponentType, LucideIcon> = {
  skill: BookOpen,
  agent: Bot,
  command: TerminalSquare,
  hook: Link2,
  rule: FileText,
};

interface ComponentIconProps {
  type: ComponentType;
  className?: string;
  'aria-label'?: string;
}

export function ComponentIcon({
  type,
  className = '',
  'aria-label': ariaLabel,
}: ComponentIconProps) {
  const { t } = useTranslation('components');
  const Icon = TYPE_ICONS[type];
  const label = ariaLabel ?? t('componentIcon.typeAria', { type });

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center ${className}`}
      role="img"
      aria-label={label}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
