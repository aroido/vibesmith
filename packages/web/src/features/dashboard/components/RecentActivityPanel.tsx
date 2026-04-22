/**
 * Recent Activity Panel - Terminal style list (Spec §5.3)
 * 10 items, typing effect on hover, terminal cursor blink
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Component } from '../types';
import { ActivityItem } from './ActivityItem';
import { ActivityItemSkeleton } from './LoadingSkeleton';
import { Link } from 'react-router-dom';

interface RecentActivityPanelProps {
  activities: Component[] | null | undefined;
  isLoading: boolean;
}

const DASHBOARD_ACTIVITY_LIMIT = 6;

export function RecentActivityPanel({ activities, isLoading }: RecentActivityPanelProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const totalActivities = activities?.length ?? 0;
  const visibleActivities = (activities ?? []).slice(0, DASHBOARD_ACTIVITY_LIMIT);
  const hiddenActivitiesCount = Math.max(0, totalActivities - visibleActivities.length);

  return (
    <section
      aria-label={t('activity.sectionAria')}
      className="vs-dashboard-panel-shell space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="vs-dashboard-panel-title text-xl font-semibold md:text-2xl">
            {t('recentActivity')}
          </h2>
          {!isLoading && totalActivities > 0 && (
            <p className="text-xs text-theme-tertiary">
              {t('activity.showingRecent', {
                shown: visibleActivities.length,
                count: totalActivities,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void navigate('/components')}
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-theme-secondary transition-colors hover:bg-theme-hover hover:text-theme-primary"
          aria-label={t('activity.viewAll')}
        >
          {t('activity.viewAll')}
        </button>
      </div>

      <div className="vs-dashboard-panel-surface rounded-xl bg-theme-surface backdrop-blur-md border border-theme overflow-hidden">
        {isLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </>
        )}

        {!isLoading && activities && activities.length > 0 && (
          <ul role="list" aria-label={t('activity.listAria')}>
            {visibleActivities.map((component) => (
              <li key={component.id}>
                <Link
                  to={`/components/${component.id}`}
                  className="block"
                >
                  <ActivityItem
                    component={component}
                    isLive={component.isActive}
                    compact
                  />
                </Link>
              </li>
            ))}

            {hiddenActivitiesCount > 0 && (
              <li className="border-t border-theme p-3 text-center">
                <Link
                  to="/components"
                  className="text-sm text-primary hover:underline transition-colors font-mono"
                >
                  {t('activity.loadMore')}
                </Link>
              </li>
            )}
          </ul>
        )}

        {!isLoading && (!activities || activities.length === 0) && (
          <div className="p-8 text-center" role="status">
            <p className="text-theme-secondary font-mono">{t('activity.noActivity')}</p>
            <Link
              to="/components"
              className="mt-4 inline-block px-4 py-2 rounded-lg btn-theme-primary-soft transition-colors"
            >
              {t('activity.browseComponents')}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
