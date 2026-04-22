/**
 * SplitView - 소스와 렌더링 뷰 분할 표시
 */

import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SourceView } from './SourceView';

interface SplitViewProps {
  content: string;
}

export function SplitView({ content }: SplitViewProps) {
  const { t } = useTranslation('components');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-theme-secondary">{t('documentViewer.splitSourceLabel')}</h3>
        <SourceView content={content} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-theme-secondary">{t('documentViewer.splitPreviewLabel')}</h3>
        <div className="p-4 rounded-lg bg-theme-elevated border border-theme overflow-auto max-h-[500px]">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  );
}
