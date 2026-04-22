/**
 * Component Edit Page
 * 편집 페이지: 로딩/에러/404/성공 상태 처리
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageFrame } from '@/components/common';
import type { ComponentType } from '@/common/types';
import { ApiError } from '@/common/api';
import { notify } from '@/common/utils/notify';
import { useComponent } from '../hooks/useComponent';
import { useUpdateComponent } from '../hooks/useUpdateComponent';
import { useTags } from '@/features/tag-management';
import {
  assembleContent,
  extractBody,
  parseFrontmatter,
} from '../services/content-parser';
import { ComponentEditForm } from './ComponentEditForm';

export function ComponentEditPage() {
  const { id } = useParams<{ id: string }>();
  const componentId = id ?? '';
  const { t, i18n } = useTranslation(['components', 'common']);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState('');

  const { data: component, isLoading, error, refetch } = useComponent(id);
  const { data: allTags = [] } = useTags();
  const updateMutation = useUpdateComponent({
    id: componentId,
    onSuccess: () => notify.success(t('components:edit.saved')),
  });

  useEffect(() => {
    if (!component) return;
    const fm = component.frontmatter ?? parseFrontmatter(component.content);
    const body = extractBody(component.content);
    setName(component.name);
    setDescription(component.description ?? '');
    setTags(component.tags ?? []);
    setContent(body);
    if (fm && typeof fm === 'object') {
      if (typeof fm.name === 'string') setName(fm.name);
      if (typeof fm.description === 'string') setDescription(fm.description);
    }
  }, [component]);

  const handleSubmit = () => {
    if (!component || !componentId) return;
    if (!name.trim()) {
      notify.error(t('components:edit.nameRequired'));
      return;
    }
    const existingFrontmatter =
      (component.frontmatter as Record<string, unknown>) ??
      parseFrontmatter(component.content) ??
      null;
    const assembled = assembleContent(
      typeof existingFrontmatter === 'object' ? existingFrontmatter : null,
      name.trim(),
      description.trim(),
      content
    );
    updateMutation.mutate({
      content: assembled,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleCancel = () => {
    if (!window.confirm(t('components:edit.confirmCancel'))) {
      return;
    }
    window.history.back();
  };

  const is404 =
    error instanceof ApiError && error.statusCode === 404;

  if (!componentId) {
    return (
      <PageFrame activeNav="components" title={t('components:edit.title')}>
        <div className="alert-theme-danger rounded-xl p-6">
          <p>{t('components:edit.invalidId')}</p>
          <Link to="/components" className="text-primary hover:underline mt-2 inline-block">
            {t('components:detail.backToList')}
          </Link>
        </div>
      </PageFrame>
    );
  }

  if (isLoading) {
    return (
      <PageFrame
        activeNav="components"
        title={t('components:edit.title')}
        subtitle={t('components:edit.subtitle')}
      >
        <div className="p-2" role="status" aria-label={t('components:detail.loadingAria')}>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-theme-skeleton rounded w-48" />
            <div className="h-4 bg-theme-skeleton rounded w-full" />
            <div className="h-4 bg-theme-skeleton rounded w-3/4" />
          </div>
        </div>
      </PageFrame>
    );
  }

  if (error && is404) {
    return (
      <PageFrame
        activeNav="components"
        title={t('components:edit.title')}
        subtitle={t('components:edit.subtitle')}
      >
        <div role="alert" className="alert-theme-danger rounded-lg p-4">
          {t('components:detail.notFound')}
        </div>
        <Link
          to="/components"
          className="mt-4 inline-block text-primary hover:underline"
        >
          {t('components:detail.backToList')}
        </Link>
      </PageFrame>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : t('components:edit.loadError');
    return (
      <PageFrame activeNav="components" title={t('components:edit.title')}>
        <div role="alert" className="alert-theme-danger rounded-lg p-4">
          {message}
        </div>
        <button
          onClick={() => void refetch()}
          className="mt-4 px-4 py-2 rounded-lg btn-theme-surface"
        >
          {t('components:edit.retry')}
        </button>
        <Link
          to="/components"
          className="mt-4 ml-3 inline-block text-primary hover:underline"
        >
          {t('components:detail.backToList')}
        </Link>
      </PageFrame>
    );
  }

  if (!component) {
    return null;
  }

  const validationError =
    updateMutation.error instanceof Error ? updateMutation.error.message : null;

  return (
    <PageFrame
      activeNav="components"
      title={t('components:edit.title')}
      subtitle={t('components:edit.subtitle')}
      contentClassName="max-w-[88rem] mx-auto"
    >
      {validationError && (
        <div
          role="alert"
          className="mb-4 alert-theme-danger rounded-lg p-4"
        >
          {validationError}
        </div>
      )}

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1fr,320px]">
        <ComponentEditForm
          componentType={component.type as ComponentType}
          projectName={component.project_name}
          name={name}
          description={description}
          tags={tags}
          allTags={allTags}
          content={content}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onTagsChange={setTags}
          onContentChange={setContent}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          saving={updateMutation.isPending}
        />

        <aside className="space-y-4">
          <section className="vs-frost-panel rounded-xl p-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary mb-2">
              {t('components:edit.editGuide')}
            </h2>
            <ul className="space-y-2 text-sm text-theme-secondary">
              <li>{t('components:edit.guide1')}</li>
              <li>{t('components:edit.guide2')}</li>
              <li>{t('components:edit.guide3')}</li>
              <li>{t('components:edit.guide4')}</li>
            </ul>
          </section>

          <section className="vs-frost-panel rounded-xl p-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary mb-2">
              {t('components:edit.editSnapshot')}
            </h2>
            <p className="text-sm text-theme-secondary">{t('components:edit.snapshotType')}: {component.type}</p>
            <p className="text-sm text-theme-secondary mt-1">{t('components:edit.snapshotProject')}: {component.project_name}</p>
            <p className="text-sm text-theme-secondary mt-1">
              {t('components:edit.snapshotUpdated')}: {new Date(component.updated_at).toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US')}
            </p>
          </section>
        </aside>
      </section>
    </PageFrame>
  );
}
