/**
 * ContentTab
 * 기본: 마크다운 렌더링(읽기 모드)
 * "편집" 버튼 → 좌우 분할(왼쪽 에디터 + 오른쪽 실시간 미리보기)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Eye, X } from 'lucide-react';
import { ComponentDetailPreview } from './ComponentDetailPreview';

interface ContentTabProps {
  content: string;
  fileName: string;
  onSave: (content: string) => void;
  isSaving: boolean;
}

export function ContentTab({
  content,
  fileName,
  onSave,
  isSaving,
}: ContentTabProps) {
  const { t } = useTranslation(['components', 'common']);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  const hasChanges = draft !== content;

  const handleEdit = () => {
    setDraft(content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(content);
    setIsEditing(false);
  };

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  // -- 읽기 모드 --
  if (!isEditing) {
    return (
      <div className="relative">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-surface transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {t('common:edit')}
          </button>
        </div>
        <ComponentDetailPreview content={content} fileName={fileName} maxLines={Infinity} compact />
      </div>
    );
  }

  // -- 편집 모드 --
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-primary">
          {t('components:detail.editing', '편집 중')}
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-surface transition-colors"
          >
            <X className="w-4 h-4" />
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-primary-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common:save')}
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div className="vs-frost-panel rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-theme">
            <span className="text-sm font-medium text-theme-secondary">
              Editor
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-[60vh] p-4 font-mono text-sm bg-transparent text-theme-primary resize-none focus:outline-none"
          />
        </div>

        {/* Preview */}
        <div className="vs-frost-panel rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-theme flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-theme-secondary" />
            <span className="text-sm font-medium text-theme-secondary">
              {t('components:detail.preview', 'Preview')}
            </span>
          </div>
          <div className="h-[60vh] overflow-y-auto p-4">
            <ComponentDetailPreview content={draft} fileName={fileName} />
          </div>
        </div>
      </div>
    </div>
  );
}
