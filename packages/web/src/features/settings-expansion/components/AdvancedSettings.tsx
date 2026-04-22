/**
 * AdvancedSettings - 자동 스캔, 실험적 기능
 */

import { useTranslation } from 'react-i18next';
import { useAdvancedSettings } from '../hooks/useAdvancedSettings';

const sectionClass =
  'vs-frost-panel rounded-2xl p-6';

const checkboxClass =
  'h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

export function AdvancedSettings() {
  const { t } = useTranslation('settings');
  const { autoScan, setAutoScan, experimental, setExperimental } =
    useAdvancedSettings();

  return (
    <section
      className={sectionClass}
      aria-labelledby="advanced-settings-title"
    >
      <h2
        id="advanced-settings-title"
        className="text-lg font-semibold text-theme-primary mb-4"
      >
        {t('advanced.title')}
      </h2>
      <p className="text-sm text-theme-secondary mb-6">
        {t('advanced.description')}
      </p>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input
            id="auto-scan"
            type="checkbox"
            checked={autoScan}
            onChange={(e) => setAutoScan(e.target.checked)}
            aria-describedby="auto-scan-desc"
            aria-label={t('advanced.autoScanLabel')}
            className={checkboxClass}
          />
          <label
            htmlFor="auto-scan"
            id="auto-scan-desc"
            className="text-sm font-medium text-theme-primary"
          >
            {t('advanced.autoScanLabel')}
          </label>
        </div>
        <div
          className="flex items-start gap-3"
          aria-describedby="experimental-warning"
        >
          <input
            id="experimental"
            type="checkbox"
            checked={experimental}
            onChange={(e) => setExperimental(e.target.checked)}
            aria-describedby="experimental-warning"
            aria-label={t('advanced.experimentalLabel')}
            className={`${checkboxClass} mt-0.5`}
          />
          <div>
            <label
              htmlFor="experimental"
              className="text-sm font-medium text-theme-primary block"
            >
              {t('advanced.experimentalLabel')}
            </label>
            <p
              id="experimental-warning"
              className="text-xs text-theme-warning mt-1"
            >
              {t('advanced.experimentalWarning')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
