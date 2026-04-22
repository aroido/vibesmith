import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

export interface ProjectOption {
  id: string;
  name: string;
  isGlobal: boolean;
}

export type PlatformFilter = 'all' | 'claude_code' | 'cursor';

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claude_code', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
];

export interface TreeFiltersProps {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  selectedPlatform: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hideDisabled: boolean;
  onHideDisabledChange: (value: boolean) => void;
  riskOnly: boolean;
  onRiskOnlyChange: (value: boolean) => void;
  cycleCount: number;
  brokenCount: number;
}

export const TreeFilters: React.FC<TreeFiltersProps> = ({
  projects,
  selectedProjectId,
  onProjectChange,
  selectedPlatform,
  onPlatformChange,
  searchQuery,
  onSearchChange,
  hideDisabled,
  onHideDisabledChange,
  riskOnly,
  onRiskOnlyChange,
  cycleCount,
  brokenCount,
}) => {
  const { t } = useTranslation('dependencyGraph');
  const showBadges = cycleCount > 0 || brokenCount > 0;

  // Global projects first, then alphabetical
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isGlobal !== b.isGlobal) return a.isGlobal ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="vs-frost-panel rounded-xl p-4 space-y-3">
      {/* Project filter tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onProjectChange(null)}
          className={[
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            selectedProjectId === null
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] text-theme-secondary hover:text-theme-primary',
          ].join(' ')}
        >
          {t('filters.all')}
        </button>
        {sortedProjects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onProjectChange(selectedProjectId === p.id ? null : p.id)}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              selectedProjectId === p.id
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] text-theme-secondary hover:text-theme-primary',
            ].join(' ')}
          >
            {p.isGlobal && <span className="mr-1">🌐</span>}
            {p.name}
          </button>
        ))}
      </div>

      {/* Platform filter tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PLATFORM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPlatformChange(selectedPlatform === opt.value ? 'all' : opt.value)}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              selectedPlatform === opt.value
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[color-mix(in_srgb,var(--color-text-primary)_8%,transparent)] text-theme-secondary hover:text-theme-primary',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search + checkboxes */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('nodeSearchPlaceholder')}
            className="input-theme w-full rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-theme-secondary whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideDisabled}
            onChange={(e) => onHideDisabledChange(e.target.checked)}
            className="h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)]"
          />
          {t('hideDisabledNodes')}
        </label>

        <label className="flex items-center gap-1.5 text-sm text-theme-secondary whitespace-nowrap">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => onRiskOnlyChange(e.target.checked)}
            className="h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)]"
          />
          {t('riskOnly')}
        </label>
      </div>

      {showBadges && (
        <div className="flex items-center gap-3 pt-3 mt-3 border-t border-theme flex-wrap">
          {cycleCount > 0 && (
            <span className="text-sm font-medium rounded-md badge-theme-danger px-2 py-1">
              {t('filters.circularDependencies', { count: cycleCount })}
            </span>
          )}
          {brokenCount > 0 && (
            <span className="text-sm font-medium rounded-md badge-theme-warning px-2 py-1">
              {t('filters.brokenReferences', { count: brokenCount })}
            </span>
          )}
        </div>
      )}
    </section>
  );
};
