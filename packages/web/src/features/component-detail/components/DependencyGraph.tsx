/**
 * DependencyGraph - horizontal dependency visualization
 * depends_on (left) -> current component (center) -> depended_by (right)
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Box } from 'lucide-react';
import type { DependencyInfo, DependencyItem } from '../types';

interface DependencyGraphProps {
  componentName: string;
  dependencies: DependencyInfo;
}

function DependencyNode({ item }: { item: DependencyItem }) {
  return (
    <Link
      to={`/components/${item.id}`}
      className="flex items-center gap-2 px-3 py-2 bg-theme-elevated border border-theme rounded-lg hover:border-[var(--color-primary)] transition-colors"
    >
      <Box className="w-4 h-4 text-theme-secondary shrink-0" />
      <div className="min-w-0">
        <p className="font-mono text-sm text-theme-primary truncate">{item.name}</p>
        <p className="text-xs text-theme-tertiary">{item.type}</p>
      </div>
    </Link>
  );
}

function ArrowSeparator() {
  return (
    <div className="flex items-center px-2 text-theme-tertiary shrink-0">
      <ArrowRight className="w-5 h-5" />
    </div>
  );
}

export function DependencyGraph({ componentName, dependencies }: DependencyGraphProps) {
  const { t } = useTranslation(['components']);

  const { depends_on, depended_by } = dependencies;
  const hasAny = depends_on.length > 0 || depended_by.length > 0;

  if (!hasAny) {
    return (
      <div className="vs-frost-panel rounded-xl p-5">
        <p className="text-theme-tertiary text-sm text-center">
          {t('components:detail.noDependencies')}
        </p>
      </div>
    );
  }

  return (
    <div className="vs-frost-panel rounded-xl p-5">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {/* depends_on (left side) */}
        {depends_on.length > 0 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-theme-tertiary text-center">
                {t('components:detail.dependsOn')}
              </span>
              <div className="flex flex-col gap-2">
                {depends_on.map((item) => (
                  <DependencyNode key={item.id} item={item} />
                ))}
              </div>
            </div>
            <ArrowSeparator />
          </>
        )}

        {/* Current component (center) */}
        <div className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--color-primary)] rounded-lg bg-theme-elevated shrink-0">
          <Box className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-sm text-theme-primary font-semibold truncate">
              {componentName}
            </p>
          </div>
        </div>

        {/* depended_by (right side) */}
        {depended_by.length > 0 && (
          <>
            <ArrowSeparator />
            <div className="flex flex-col gap-2">
              <span className="text-xs text-theme-tertiary text-center">
                {t('components:detail.dependedBy')}
              </span>
              <div className="flex flex-col gap-2">
                {depended_by.map((item) => (
                  <DependencyNode key={item.id} item={item} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
