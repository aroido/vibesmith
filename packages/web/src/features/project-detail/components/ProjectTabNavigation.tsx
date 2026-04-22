/**
 * ProjectTabNavigation Component
 * v1.10.0 - 프로젝트 탭 네비게이션
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid,
  BookOpen,
  Bot,
  FileText,
  Link2,
  TerminalSquare,
} from 'lucide-react';
import type { TabType } from '../types';

interface ProjectTabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabConfig: { id: TabType; labelKey: string; icon: ReactNode }[] = [
  { id: 'overview', labelKey: 'overview', icon: <LayoutGrid className="h-4 w-4" aria-hidden /> },
  { id: 'skill', labelKey: 'skills', icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  { id: 'agent', labelKey: 'agents', icon: <Bot className="h-4 w-4" aria-hidden /> },
  { id: 'command', labelKey: 'commands', icon: <TerminalSquare className="h-4 w-4" aria-hidden /> },
  { id: 'hook', labelKey: 'hooks', icon: <Link2 className="h-4 w-4" aria-hidden /> },
  { id: 'rule', labelKey: 'rules', icon: <FileText className="h-4 w-4" aria-hidden /> },
];

export function ProjectTabNavigation({
  activeTab,
  onTabChange,
}: ProjectTabNavigationProps) {
  const { t } = useTranslation('projectDetail');

  return (
    <div
      className="flex gap-2 overflow-x-auto py-1 -my-1"
      role="tablist"
      aria-label={t('stats.tablistAria')}
    >
      {tabConfig.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-4 py-2 rounded-lg
            transition-all duration-200
            whitespace-nowrap
            ${
              activeTab === tab.id
                ? 'btn-theme-primary-soft'
                : 'btn-theme-surface text-theme-secondary'
            }
          `}
        >
          <span className="mr-2 inline-flex items-center">{tab.icon}</span>
          {t(`tabs.${tab.labelKey}`)}
        </button>
      ))}
    </div>
  );
}
