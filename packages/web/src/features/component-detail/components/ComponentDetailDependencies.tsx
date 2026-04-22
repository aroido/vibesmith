/**
 * Component dependencies section
 * depends_on, depended_by with "없음" when empty
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DependencyInfo } from '../types';

interface ComponentDetailDependenciesProps {
  dependencies: DependencyInfo;
}

function DepList({
  items,
  label,
  noneLabel,
}: {
  items: { id: string; name: string; type: string }[];
  label: string;
  noneLabel: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-theme-secondary mb-2">{label}</h3>
      {items.length === 0 ? (
        <p className="text-theme-tertiary text-sm">{noneLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/components/${item.id}`}
                className="text-primary hover:underline font-mono text-sm"
              >
                {item.name} [{item.type}]
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ComponentDetailDependencies({
  dependencies,
}: ComponentDetailDependenciesProps) {
  const { t } = useTranslation('components');
  return (
    <div className="vs-frost-panel rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-theme-primary">{t('detail.dependencies')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DepList
          items={dependencies.depends_on}
          label={t('detail.dependsOn')}
          noneLabel={t('detail.none')}
        />
        <DepList
          items={dependencies.depended_by}
          label={t('detail.dependedBy')}
          noneLabel={t('detail.none')}
        />
      </div>
    </div>
  );
}
