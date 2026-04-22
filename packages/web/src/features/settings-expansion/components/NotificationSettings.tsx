/**
 * NotificationSettings - 알림 활성화 및 타입별 설정
 */

import { useTranslation } from 'react-i18next';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import type { NotificationTypes } from '../types';

const sectionClass =
  'vs-frost-panel rounded-2xl p-6';

const checkboxClass =
  'h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

const types: (keyof NotificationTypes)[] = ['success', 'error', 'info', 'warning'];

export function NotificationSettings() {
  const { t } = useTranslation('settings');
  const { enabled, setEnabled, types: typeSettings, setType } = useNotificationSettings();

  return (
    <section
      className={sectionClass}
      aria-labelledby="notification-settings-title"
    >
      <h2
        id="notification-settings-title"
        className="text-lg font-semibold text-theme-primary mb-4"
      >
        {t('notification.title')}
      </h2>
      <p className="text-sm text-theme-secondary mb-6">
        {t('notification.description')}
      </p>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input
            id="notification-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-describedby="notification-enabled-desc"
            aria-label={t('notification.enabledLabel')}
            className={checkboxClass}
          />
          <label
            htmlFor="notification-enabled"
            id="notification-enabled-desc"
            className="text-sm font-medium text-theme-primary"
          >
            {t('notification.enabledLabel')}
          </label>
        </div>
        {enabled && (
          <fieldset
            className="space-y-3"
            aria-label={t('notification.typesLabel')}
          >
            <legend className="text-sm font-medium text-theme-secondary mb-2">
              {t('notification.typesLabel')}
            </legend>
            {types.map((type) => (
              <div key={type} className="flex items-center gap-3">
                <input
                  id={`notification-type-${type}`}
                  type="checkbox"
                  checked={typeSettings[type]}
                  onChange={(e) => setType(type, e.target.checked)}
                  className={checkboxClass}
                />
                <label
                  htmlFor={`notification-type-${type}`}
                  className="text-sm text-theme-secondary"
                >
                  {t(`notification.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </label>
              </div>
            ))}
          </fieldset>
        )}
      </div>
    </section>
  );
}
