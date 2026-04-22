/**
 * Component detail preview
 * content 미리보기 (플레인 텍스트 + 마크다운 렌더링)
 * 렌더링 뷰 ↔ 소스 뷰 전환
 * line-clamp + 더 보기 + 전체 보기 모달
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import { DocumentViewer } from '@/features/document-viewer';

interface ComponentDetailPreviewProps {
  content: string;
  fileName?: string;
  maxLines?: number;
  onContentChange?: (newContent: string) => void;
  /** 콘텐츠 탭 등에서 사용: 제목/전체보기 버튼 숨김 */
  compact?: boolean;
}

export function ComponentDetailPreview({
  content,
  fileName = 'document.md',
  maxLines = 10,
  onContentChange,
  compact = false,
}: ComponentDetailPreviewProps) {
  const { t } = useTranslation('components');
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'source' | 'rendered'>('rendered');
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 마크다운 파싱
  const renderedHtml = useMemo(() => {
    if (viewMode !== 'rendered') return '';
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      return marked(content);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<p class="text-theme-danger">마크다운 파싱 오류</p>';
    }
  }, [content, viewMode]);

  // Prism.js 코드 하이라이팅
  useEffect(() => {
    if (viewMode === 'rendered' && previewRef.current) {
      Prism.highlightAllUnder(previewRef.current);
    }
  }, [renderedHtml, viewMode]);

  if (!content || content.trim() === '') {
    return (
      <div className="vs-frost-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-theme-primary mb-4">{t('detail.previewContent')}</h2>
        <p className="text-theme-tertiary text-sm">{t('detail.noContent')}</p>
      </div>
    );
  }

  const lines = content.split('\n');
  const hasMore = lines.length > maxLines;
  const displayLines = expanded ? lines : lines.slice(0, maxLines);
  const displayContent = displayLines.join('\n');

  return (
    <div className="vs-frost-panel rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-theme">
        <div className="flex">
          <button
            type="button"
            onClick={() => setViewMode('rendered')}
            data-testid="component-detail-preview-rendered-button"
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              viewMode === 'rendered'
                ? 'text-theme-primary'
                : 'text-theme-tertiary hover:text-theme-secondary'
            }`}
            aria-pressed={viewMode === 'rendered'}
          >
            {t('detail.viewRendered')}
            {viewMode === 'rendered' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('source')}
            data-testid="component-detail-preview-source-button"
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              viewMode === 'source'
                ? 'text-theme-primary'
                : 'text-theme-tertiary hover:text-theme-secondary'
            }`}
            aria-pressed={viewMode === 'source'}
          >
            {t('detail.viewSource')}
            {viewMode === 'source' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
            )}
          </button>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={() => setIsFullViewOpen(true)}
            data-testid="component-detail-view-full-button"
            className="mr-3 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-surface transition-colors"
            aria-label={t('detail.viewFullAria')}
          >
            {t('detail.viewFull')}
          </button>
        )}
      </div>

      <div className="p-6">

      {/* Content Display */}
      {viewMode === 'source' ? (
        <>
          <pre
            className="text-sm text-theme-secondary font-mono whitespace-pre-wrap break-words overflow-x-auto"
            style={
              !expanded && hasMore
                ? { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
                : undefined
            }
          >
            {displayContent}
          </pre>
          {hasMore && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              data-testid="component-detail-expand-button"
              className="mt-3 text-sm text-primary hover:underline font-medium"
            >
              {t('detail.showMore')}
            </button>
          )}
        </>
      ) : (
        <div
          ref={previewRef}
          className="prose max-w-none prose-pre:bg-theme-elevated prose-pre:border prose-pre:border-theme prose-p:text-theme-secondary prose-li:text-theme-secondary prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
      </div>
      <DocumentViewer
        isOpen={isFullViewOpen}
        onClose={() => setIsFullViewOpen(false)}
        fileName={fileName}
        content={content}
        onSave={onContentChange}
      />
    </div>
  );
}
