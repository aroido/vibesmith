/**
 * Component Status visual indicator
 * Spec: toggle-enhancement.md §5.3 ComponentStatus
 * enabled=true: check icon (녹색), enabled=false: x icon (회색)
 */

import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

interface ComponentStatusProps {
  enabled: boolean;
  /** Optional text to show (e.g. "Enabled" / "Disabled") - rendered with grey when disabled */
  children?: React.ReactNode;
}

export function ComponentStatus({ enabled, children }: ComponentStatusProps) {
  const { t } = useTranslation('components');
  const Icon = enabled ? Check : X;
  const iconClass = enabled
    ? 'text-theme-success'
    : 'text-theme-tertiary';
  const textClass = enabled ? 'text-theme-secondary' : 'text-theme-tertiary';

  return (
    <span
      role="img"
      className={`inline-flex items-center gap-1 ${textClass}`}
      aria-label={enabled ? t('list.statusEnabledAria') : t('list.statusDisabledAria')}
    >
      <span className={iconClass} aria-hidden="true">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </span>
  );
}
