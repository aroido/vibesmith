/**
 * ViewModeSelector - 렌더링/소스/분할 뷰 전환 버튼 그룹
 */

import { useTranslation } from 'react-i18next';

export type ViewMode = 'preview' | 'source' | 'split';

interface ViewModeSelectorProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
}

export function ViewModeSelector({
  mode,
  onChange,
  disabled = false,
}: ViewModeSelectorProps) {
  const { t } = useTranslation('components');
  const options: { value: ViewMode; key: string }[] = [
    { value: 'preview', key: 'documentViewer.viewPreview' },
    { value: 'source', key: 'documentViewer.viewSource' },
    { value: 'split', key: 'documentViewer.viewSplit' },
  ];

  return (
    <div
      role="group"
      aria-label={t('documentViewer.viewModeAria')}
      className="flex gap-2 mb-4"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          aria-pressed={mode === opt.value}
          data-testid={`document-viewer-view-${opt.value}`}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            mode === opt.value
              ? 'btn-theme-primary-soft'
              : 'btn-theme-surface'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {t(opt.key)}
        </button>
      ))}
    </div>
  );
}
