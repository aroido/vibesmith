/**
 * DocumentViewer - 본문 미리보기 모달
 * 마크다운 렌더링, 뷰 전환(렌더링/소스/분할), 편집, 저장, 전체화면
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ViewModeSelector, type ViewMode } from './ViewModeSelector';
import { SourceView } from './SourceView';
import { SplitView } from './SplitView';
import { showSuccessToast } from '@/common/utils/toast';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  content: string;
  onSave?: (newContent: string) => void;
}

export function DocumentViewer({
  isOpen,
  onClose,
  fileName,
  content: initialContent,
  onSave,
}: DocumentViewerProps) {
  const { t } = useTranslation('components');
  const [content, setContent] = useState(initialContent);
  const [editedContent, setEditedContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setEditedContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = useCallback(() => {
    setContent(editedContent);
    setIsEditing(false);
    onSave?.(editedContent);
    showSuccessToast(t('documentViewer.saveSuccessToast'), {
      duration: 3000,
    });
  }, [editedContent, onSave, t]);

  const handleCancel = useCallback(() => {
    setEditedContent(content);
    setIsEditing(false);
  }, [content]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const displayContent = isEditing ? editedContent : content;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`bg-theme-elevated border-theme text-theme-primary max-w-4xl overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen ? 'fixed inset-4 max-w-none max-h-none w-auto h-auto' : ''
        }`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle className="text-lg font-mono truncate">
              {fileName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('documentViewer.dialogDescription')}
            </DialogDescription>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedContent(content);
                    setIsEditing(true);
                  }}
                  className="btn-theme-surface"
                >
                  {t('documentViewer.edit')}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="btn-theme-primary-soft"
                  >
                    {t('documentViewer.save')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="btn-theme-surface"
                  >
                    {t('documentViewer.cancel')}
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen
                    ? t('documentViewer.exitFullscreenAria')
                    : t('documentViewer.fullscreenAria')
                }
                className="p-2 rounded-lg text-theme-secondary hover:text-primary hover:bg-theme-surface transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 py-4">
          {!isEditing ? (
            <>
              <ViewModeSelector mode={viewMode} onChange={setViewMode} />
              {viewMode === 'preview' && (
                <div className="overflow-auto max-h-[60vh]">
                  <MarkdownRenderer content={displayContent} />
                </div>
              )}
              {viewMode === 'source' && (
                <SourceView content={displayContent} />
              )}
              {viewMode === 'split' && (
                <SplitView content={displayContent} />
              )}
            </>
          ) : (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[500px] p-4 font-mono text-sm input-theme rounded-lg resize-y"
              placeholder={t('documentViewer.editPlaceholder')}
              data-testid="document-viewer-editor"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
