/**
 * Component Edit Form
 * 폼 컨테이너 - Name, Description, Tags, Content 편집
 */

import { useState } from 'react';
import { Check, Eye, EyeOff, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ComponentType } from '@/common/types';
import { ComponentTypeDisplay } from './ComponentTypeDisplay';
import { ProjectDisplay } from './ProjectDisplay';
import { TagInput } from '@/features/tag-management';
import { MarkdownPreview } from './MarkdownPreview';

interface ComponentEditFormProps {
  componentType: ComponentType;
  projectName: string;
  name: string;
  description: string;
  tags: string[];
  allTags?: string[];
  content: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onTagsChange: (tags: string[]) => void;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ComponentEditForm({
  componentType,
  projectName,
  name,
  description,
  tags,
  content,
  onNameChange,
  onDescriptionChange,
  onTagsChange,
  onContentChange,
  onSubmit,
  onCancel,
  saving = false,
  allTags = [],
}: ComponentEditFormProps) {
  const { t } = useTranslation('components');
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const stepStatus = [
    { id: 'edit-step-1', label: t('edit.stepBasics'), done: name.trim().length > 0 },
    {
      id: 'edit-step-2',
      label: t('edit.stepMetadata'),
      done: description.trim().length > 0 || tags.length > 0,
    },
    { id: 'edit-step-3', label: t('edit.stepContent'), done: content.trim().length > 0 },
  ] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const togglePreview = () => {
    setIsPreviewVisible((prev) => !prev);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="vs-frost-panel rounded-xl p-4">
        <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary mb-3">
          {t('edit.stepGuide')}
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {stepStatus.map((step) => (
            <a
              key={step.id}
              href={`#${step.id}`}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                step.done
                  ? 'badge-theme-success'
                  : 'border-theme bg-theme-surface text-theme-secondary hover:bg-theme-hover'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {step.done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                )}{' '}
                {step.label}
              </span>
            </a>
          ))}
        </div>
      </div>

      <section
        id="edit-step-1"
        className="vs-frost-panel rounded-xl p-6 space-y-5"
      >
        <h2 className="text-lg font-semibold text-theme-primary">
          {t('edit.stepBasics')} <span className="text-theme-danger" aria-hidden>*</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ComponentTypeDisplay type={componentType} />
          <ProjectDisplay projectName={projectName} />
        </div>
        <label
          htmlFor="component-name"
          className="block text-sm font-medium text-theme-secondary"
        >
          {t('edit.nameLabel')} <span className="text-theme-danger" aria-hidden>*</span>
        </label>
        <input
          id="component-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('edit.namePlaceholder')}
          required
          aria-required
          className="w-full px-4 py-2 rounded-lg input-theme"
        />
      </section>

      <section
        id="edit-step-2"
        className="vs-frost-panel rounded-xl p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-theme-primary">{t('edit.stepMetadata')}</h2>
        <label
          htmlFor="component-description"
          className="block text-sm font-medium text-theme-secondary"
        >
          {t('edit.descriptionLabel')}
        </label>
        <input
          id="component-description"
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('edit.descriptionPlaceholder')}
          className="w-full px-4 py-2 rounded-lg input-theme"
        />
        <label
          htmlFor="component-tags"
          className="block text-sm font-medium text-theme-secondary"
        >
          {t('edit.tagsLabel')}
        </label>
        <TagInput
          value={tags}
          onChange={onTagsChange}
          allTags={allTags}
          placeholder={t('edit.tagsPlaceholder')}
          maxTags={10}
        />
      </section>

      <section
        id="edit-step-3"
        className="vs-frost-panel rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-primary">{t('edit.stepContent')}</h2>
          <button
            type="button"
            onClick={togglePreview}
            className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg btn-theme-surface transition-colors text-sm"
          >
            {isPreviewVisible ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span>{t('edit.previewHide')}</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span>{t('edit.previewShow')}</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Editor */}
          <div className="space-y-2">
            <label
              htmlFor="component-content"
              className="block text-sm font-medium text-theme-secondary"
            >
              {t('edit.contentLabel')}
            </label>
            <textarea
              id="component-content"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              rows={20}
              className="w-full px-4 py-2 rounded-lg input-theme font-mono text-sm resize-y"
              placeholder={t('edit.contentPlaceholder')}
            />
          </div>

          {/* Preview */}
          {isPreviewVisible && (
            <div className="min-h-[500px]">
              <MarkdownPreview
                content={content}
                name={name}
                description={description}
              />
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 rounded-lg btn-theme-surface transition-colors"
        >
          {t('edit.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg btn-theme-primary-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? t('edit.saving') : t('edit.saveChanges')}
        </button>
      </div>
    </form>
  );
}
