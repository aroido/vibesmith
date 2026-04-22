import { useTranslation } from 'react-i18next';
import { FolderOpen, FolderX, Clock } from 'lucide-react';
import { DonutChart } from './DonutChart';
import { DependencyHealthWidget } from './DependencyHealthWidget';
import type { ProjectBreakdown, TabType } from '../types';
import type { ComponentType } from '../../../common/types';

interface PlatformBreakdown {
  platform: string;
  count: number;
}

interface ProjectOverviewPanelProps {
  projectId: string;
  path: string;
  lastScannedAt: string | null;
  dirExists: boolean;
  breakdown: ProjectBreakdown;
  platformBreakdown: PlatformBreakdown[];
  onTabChange: (tab: TabType) => void;
}

const TYPE_COLORS: Record<keyof ProjectBreakdown, string> = {
  skill: 'var(--color-primary)',
  agent: 'var(--color-fg-tertiary)',
  command: 'var(--color-state-success)',
  hook: 'var(--color-state-warning)',
  rule: 'var(--color-accent-primary-hover)',
};

const PLATFORM_COLORS: Record<string, string> = {
  claude_code: 'var(--color-primary)',
  cursor: 'var(--color-state-success)',
};

const PLATFORM_DEFAULT_COLOR = 'var(--color-fg-tertiary)';

const TYPE_LABEL_KEYS: Record<keyof ProjectBreakdown, string> = {
  skill: 'stats.skills',
  agent: 'stats.agents',
  command: 'stats.commands',
  hook: 'stats.hooks',
  rule: 'stats.rules',
};

function abbreviatePath(fullPath: string): string {
  const parts = fullPath.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : fullPath;
}

function platformLabel(p: string): string {
  if (p === 'claude_code') return 'Claude Code';
  if (p === 'cursor') return 'Cursor';
  return p;
}

export function ProjectOverviewPanel({
  projectId,
  path,
  lastScannedAt,
  dirExists,
  breakdown,
  platformBreakdown,
  onTabChange,
}: ProjectOverviewPanelProps) {
  const { t, i18n } = useTranslation('projectDetail');
  const dateLocale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';

  const typeSegments = (Object.keys(breakdown) as (keyof ProjectBreakdown)[]).map((key) => ({
    label: key,
    value: breakdown[key],
    color: TYPE_COLORS[key],
  }));

  const platformSegments = platformBreakdown.map((pb) => ({
    label: pb.platform,
    value: pb.count,
    color: PLATFORM_COLORS[pb.platform] ?? PLATFORM_DEFAULT_COLOR,
  }));

  const lastScannedText = lastScannedAt
    ? new Date(lastScannedAt).toLocaleString(dateLocale, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : t('overview.lastScannedNever');

  return (
    <section className="vs-frost-panel rounded-2xl p-6 mb-6" aria-label={t('overview.title')}>
      <div className="flex flex-col md:flex-row gap-15">
        {/* Left: Meta info */}
        <div className="flex-1 space-y-3">
          {/* Path */}
          <div className="flex items-center gap-2 text-sm" title={path}>
            <FolderOpen className="h-4 w-4 text-theme-tertiary shrink-0" aria-hidden />
            <span className="text-theme-secondary truncate">{abbreviatePath(path)}</span>
          </div>

          {/* Last scanned */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-theme-tertiary shrink-0" aria-hidden />
            <span className="text-theme-secondary">{lastScannedText}</span>
          </div>

          {/* Directory status */}
          <div className="flex items-center gap-2 text-sm">
            {dirExists ? (
              <>
                <FolderOpen className="h-4 w-4 text-theme-success shrink-0" aria-hidden />
                <span className="text-theme-success">{t('overview.dirExists')}</span>
              </>
            ) : (
              <>
                <FolderX className="h-4 w-4 text-theme-danger shrink-0" aria-hidden />
                <span className="text-theme-danger">{t('overview.dirMissing')}</span>
              </>
            )}
          </div>
        </div>

        {/* Platform Chart + Legend */}
        {platformBreakdown.length > 1 && (
          <div className="flex items-center gap-6">
            <DonutChart segments={platformSegments} size={120} />
            <div className="space-y-1.5">
              {platformBreakdown.map((pb) => (
                <div
                  key={pb.platform}
                  className="flex items-center gap-2 text-sm px-2 py-1"
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--platform-swatch)]"
                    style={{ ['--platform-swatch' as string]: PLATFORM_COLORS[pb.platform] ?? PLATFORM_DEFAULT_COLOR }}
                  />
                  <span className="text-theme-secondary">{platformLabel(pb.platform)}</span>
                  <span className="font-semibold text-theme-primary ml-auto">{pb.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type Chart + Legend */}
        <div className="flex items-center gap-6">
          <DonutChart segments={typeSegments} size={120} />
          <div className="space-y-1.5">
            {(Object.keys(breakdown) as (keyof ProjectBreakdown)[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key as ComponentType)}
                className="flex items-center gap-2 text-sm hover:bg-theme-surface rounded px-2 py-1 transition-colors w-full text-left"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--type-swatch)]"
                  style={{ ['--type-swatch' as string]: TYPE_COLORS[key] }}
                />
                <span className="text-theme-secondary">{t(TYPE_LABEL_KEYS[key])}</span>
                <span className="font-semibold text-theme-primary ml-auto">{breakdown[key]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dependency Health */}
        <DependencyHealthWidget projectId={projectId} />
      </div>
    </section>
  );
}
