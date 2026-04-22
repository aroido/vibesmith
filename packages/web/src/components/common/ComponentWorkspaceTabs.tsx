import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export type ComponentWorkspaceTab = 'list' | 'dependencies' | 'presets' | 'analysis' | 'trash';

interface ComponentWorkspaceTabsProps {
  active: ComponentWorkspaceTab;
}

const TAB_CONFIG: ReadonlyArray<{
  id: ComponentWorkspaceTab;
  to: string;
  labelKey: string;
}> = [
  { id: 'list', to: '/components', labelKey: 'workspace.tabs.list' },
  {
    id: 'dependencies',
    to: '/components/dependencies',
    labelKey: 'workspace.tabs.dependencies',
  },
  { id: 'presets', to: '/components/presets', labelKey: 'workspace.tabs.presets' },
  { id: 'analysis', to: '/components/analysis', labelKey: 'workspace.tabs.analysis' },
  { id: 'trash', to: '/components/trash', labelKey: 'workspace.tabs.trash' },
];

export function ComponentWorkspaceTabs({ active }: ComponentWorkspaceTabsProps) {
  const { t } = useTranslation('components');

  return (
    <nav
      aria-label={t('workspace.tabs.ariaLabel')}
      className="rounded-2xl border border-theme bg-theme-surface p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {TAB_CONFIG.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex h-10 min-h-[40px] items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'btn-theme-primary-soft text-theme-primary'
                  : 'btn-theme-surface text-theme-secondary'
              }`}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
