import { useTranslation } from 'react-i18next';
import { Info, FileText, BarChart3, type LucideIcon } from 'lucide-react';

export type DetailTab = 'overview' | 'content' | 'analysis';

interface ComponentDetailTabsProps {
  active: DetailTab;
  onChange: (tab: DetailTab) => void;
}

const TAB_CONFIG: ReadonlyArray<{
  id: DetailTab;
  labelKey: string;
  Icon: LucideIcon;
}> = [
  { id: 'overview', labelKey: 'detail.tabs.overview', Icon: Info },
  { id: 'content', labelKey: 'detail.tabs.content', Icon: FileText },
  { id: 'analysis', labelKey: 'detail.tabs.analysis', Icon: BarChart3 },
];

export function ComponentDetailTabs({ active, onChange }: ComponentDetailTabsProps) {
  const { t } = useTranslation('components');

  return (
    <nav
      aria-label={t('detail.tabs.ariaLabel')}
      className="border-b border-theme mb-6"
    >
      <div className="flex items-center gap-1">
        {TAB_CONFIG.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <tab.Icon size={16} aria-hidden="true" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
