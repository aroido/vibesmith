/**
 * TagFormModal - 태그 추가/편집 모달 (태그명, 색상, 설명)
 * Issue #498
 */

import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TAG_COLOR_PALETTE } from '../utils/tagColorRegistry';
import type { TagCardData } from './TagCard';

interface TagFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; color: string; description: string }) => void;
  initialTag?: TagCardData | null;
}

export function TagFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialTag = null,
}: TagFormModalProps) {
  const { t } = useTranslation('settings');
  const isEdit = !!initialTag;

  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTag) {
        setName(initialTag.name);
        setColor(initialTag.color);
        setDescription(initialTag.description ?? '');
      } else {
        setName('');
        setColor('blue');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, initialTag]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('tags.errors.empty'));
      return;
    }
    if (trimmedName.length > 20) {
      setError(t('tags.errors.tooLong'));
      return;
    }
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(trimmedName)) {
      setError(t('tags.errors.invalidFormat'));
      return;
    }
    setError(null);
    onSubmit({ name: trimmedName, color, description: description.trim() });
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-theme-surface border-theme text-theme-primary max-w-md">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">
            {isEdit ? t('tagManagement.editTagTitle') : t('tagManagement.addTagTitle')}
          </DialogTitle>
          <DialogDescription className="text-theme-secondary">
            {isEdit ? t('tagManagement.editTagDescription') : t('tagManagement.addTagDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tag-name" className="block text-sm font-medium text-theme-secondary mb-1">
              {t('tagManagement.tagNameLabel')}
            </label>
            <input
              id="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tagManagement.tagNamePlaceholder')}
              className="w-full px-3 py-2 rounded-lg input-theme"
              autoComplete="off"
              disabled={isEdit}
              aria-describedby={error ? 'tag-name-error' : undefined}
              aria-invalid={!!error}
            />
            {isEdit && (
              <p className="mt-1 text-xs text-theme-tertiary">{t('tagManagement.tagNameDisabledHint')}</p>
            )}
            {error && (
              <p id="tag-name-error" className="mt-1 text-sm text-theme-danger" role="alert">
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              {t('tagManagement.tagColorLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLOR_PALETTE.slice(0, 10).map(({ name: cname, hsl }) => (
                <button
                  key={cname}
                  type="button"
                  onClick={() => setColor(cname)}
                  className={`h-8 w-8 rounded-full border-2 bg-[var(--tag-swatch)] transition-all ${
                    color === cname
                      ? 'border-theme scale-110 shadow-sm'
                      : 'border-theme opacity-80 hover:opacity-100'
                  }`}
                  style={{ ['--tag-swatch' as string]: `hsl(${hsl})` }}
                  aria-label={t('tagManagement.applyColor', { colorName: t(`tagManagement.colors.${cname}`) })}
                  title={t(`tagManagement.colors.${cname}`)}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="tag-description" className="block text-sm font-medium text-theme-secondary mb-1">
              {t('tagManagement.tagDescriptionLabel')}
            </label>
            <textarea
              id="tag-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tagManagement.tagDescriptionPlaceholder')}
              rows={2}
              className="w-full px-3 py-2 rounded-lg input-theme resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg btn-theme-surface"
            >
              {t('tagManagement.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg btn-theme-primary-soft font-medium"
            >
              {isEdit ? t('tagManagement.saveTag') : t('tagManagement.addTag')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
