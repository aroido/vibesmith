/**
 * TagManagerSection - Settings 페이지 태그 관리 섹션
 * 태그 목록, 추가/편집/삭제 (Mock 데이터, Issue #498)
 */

import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus as AddIcon } from 'lucide-react';
import { Tag } from 'lucide-react';
import {
  TAG_COLOR_PALETTE,
  setTagCustomColor,
  removeTagCustomColor,
  getTagCustomColor,
} from '../utils/tagColorRegistry';
import { TagCard, type TagCardData } from './TagCard';
import { TagFormModal } from './TagFormModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Mock 태그 데이터 (백엔드 API 미구현 시 사용) */
const MOCK_TAGS: TagCardData[] = [
  { id: 1, name: 'frontend', color: 'blue', count: 15 },
  { id: 2, name: 'backend', color: 'green', count: 23 },
  { id: 3, name: 'testing', color: 'purple', count: 8 },
];

function getColorNameFromHsl(hsl: string): string {
  const entry = TAG_COLOR_PALETTE.find((c) => c.hsl === hsl);
  return entry?.name ?? 'blue';
}

export function TagManagerSection() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();

  const [tags, setTags] = useState<TagCardData[]>(MOCK_TAGS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagCardData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagCardData | null>(null);

  const nextId = useMemo(() => Math.max(0, ...tags.map((x) => x.id)) + 1, [tags]);

  useEffect(() => {
    MOCK_TAGS.forEach((tag) => {
      const existing = getTagCustomColor(tag.name);
      if (!existing) {
        const entry = TAG_COLOR_PALETTE.find((c) => c.name === tag.color);
        if (entry) setTagCustomColor(tag.name, entry.hsl);
      }
    });
  }, []);

  const handleAddTag = (data: { name: string; color: string; description: string }) => {
    const colorEntry = TAG_COLOR_PALETTE.find((c) => c.name === data.color);
    if (colorEntry) {
      setTagCustomColor(data.name, colorEntry.hsl);
      window.dispatchEvent(new CustomEvent('tag-colors-changed'));
    }
    setTags((prev) => [
      ...prev,
      {
        id: nextId,
        name: data.name,
        color: data.color,
        count: 0,
        description: data.description || undefined,
      },
    ]);
    void queryClient.invalidateQueries({ queryKey: ['tags'] });
  };

  const handleEditTag = (data: { name: string; color: string; description: string }) => {
    if (!editingTag) return;
    const colorEntry = TAG_COLOR_PALETTE.find((c) => c.name === data.color);
    if (colorEntry) {
      setTagCustomColor(editingTag.name, colorEntry.hsl);
      window.dispatchEvent(new CustomEvent('tag-colors-changed'));
    }
    setTags((prev) =>
      prev.map((tag) =>
        tag.id === editingTag.id
          ? { ...tag, color: data.color, description: data.description || undefined }
          : tag
      )
    );
    setEditingTag(null);
    void queryClient.invalidateQueries({ queryKey: ['tags'] });
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      removeTagCustomColor(deleteTarget.name);
      setTags((prev) => prev.filter((tag) => tag.id !== deleteTarget.id));
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent('tag-colors-changed'));
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
    }
  };

  const openEditModal = (tag: TagCardData) => {
    setEditingTag({
      ...tag,
      color: getTagCustomColor(tag.name)
        ? getColorNameFromHsl(getTagCustomColor(tag.name)!)
        : tag.color,
    });
  };

  return (
    <section
      aria-labelledby="tag-management-title"
      className="vs-frost-panel rounded-2xl p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 id="tag-management-title" className="text-lg font-semibold text-theme-primary">
          {t('tagManagement.title')}
        </h2>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-theme-primary-soft font-medium transition-colors"
          aria-label={t('tagManagement.addTag')}
        >
          <AddIcon className="h-4 w-4" aria-hidden />
          {t('tagManagement.addTag')}
        </button>
      </div>
      <p className="text-sm text-theme-secondary mb-4">{t('tagManagement.description')}</p>

      {tags.length === 0 ? (
        <div className="py-8 text-center">
          <Tag className="mx-auto h-12 w-12 text-theme-tertiary mb-2" aria-hidden />
          <p className="text-theme-secondary">{t('tagManagement.noTags')}</p>
          <p className="text-xs text-theme-tertiary mt-1">{t('tagManagement.addTagsHint')}</p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-theme-primary-soft text-sm font-medium"
          >
            <AddIcon className="h-4 w-4" />
            {t('tagManagement.addTag')}
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              onEdit={openEditModal}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <TagFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddTag}
      />

      <TagFormModal
        isOpen={!!editingTag}
        onClose={() => setEditingTag(null)}
        onSubmit={handleEditTag}
        initialTag={editingTag}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-theme-surface border-theme text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-theme-primary">
              {t('tagManagement.deleteTagTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary">
              {deleteTarget &&
                t('tagManagement.deleteTagConfirm', { name: deleteTarget.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
              className="btn-theme-surface border-0"
            >
              {t('tagManagement.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="btn-theme-danger-soft"
            >
              {t('tagManagement.deleteTagButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
