/**
 * EnabledAgentsSettings - Cursor / Claude (Claude Code) 체크박스
 * 글로벌 설정 섹션에서 ~/.cursor/, ~/.claude/ 디렉토리 관리 옵션
 */

import { useTranslation } from 'react-i18next';
import { Terminal, Sparkles, AlertTriangle } from 'lucide-react';
import { useEnabledAgentsSettings } from '../hooks/useEnabledAgentsSettings';

const checkboxClass =
  'h-4 w-4 rounded border border-theme bg-theme-surface accent-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

export function EnabledAgentsSettings() {
  const { t } = useTranslation('settings');
  const { enabledAgents, setAgent } = useEnabledAgentsSettings();
  const bothDisabled =
    !enabledAgents.cursor && !enabledAgents.claude;

  return (
    <div className="space-y-4" role="group" aria-label={t('enabledAgents.title')}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <input
            id="agent-cursor"
            type="checkbox"
            checked={enabledAgents.cursor}
            onChange={(e) => setAgent('cursor', e.target.checked)}
            aria-describedby="agent-cursor-desc"
            aria-label={t('enabledAgents.cursorLabel')}
            className={checkboxClass + ' mt-0.5'}
          />
          <div className="min-w-0 flex-1">
            <label
              htmlFor="agent-cursor"
              className="text-sm font-medium text-theme-primary flex items-center gap-2"
            >
              <Terminal className="h-4 w-4 text-theme-secondary shrink-0" aria-hidden />
              {t('enabledAgents.cursorLabel')}
            </label>
            <p
              id="agent-cursor-desc"
              className="text-sm text-theme-secondary mt-0.5"
            >
              {t('enabledAgents.cursorDescription')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="agent-claude"
            type="checkbox"
            checked={enabledAgents.claude}
            onChange={(e) => setAgent('claude', e.target.checked)}
            aria-describedby="agent-claude-desc"
            aria-label={t('enabledAgents.claudeLabel')}
            className={checkboxClass + ' mt-0.5'}
          />
          <div className="min-w-0 flex-1">
            <label
              htmlFor="agent-claude"
              className="text-sm font-medium text-theme-primary flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-theme-secondary shrink-0" aria-hidden />
              {t('enabledAgents.claudeLabel')}
            </label>
            <p
              id="agent-claude-desc"
              className="text-sm text-theme-secondary mt-0.5"
            >
              {t('enabledAgents.claudeDescription')}
            </p>
          </div>
        </div>
      </div>

      {bothDisabled && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg alert-theme-warning"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle
            className="h-5 w-5 text-theme-warning shrink-0"
            aria-hidden
          />
          <p className="text-sm text-theme-warning">
            {t('enabledAgents.allDisabledWarning')}
          </p>
        </div>
      )}
    </div>
  );
}
