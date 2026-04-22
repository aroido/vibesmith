/**
 * Component Create Form
 * Form container with all inputs and actions
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { ComponentTypeSelector } from './ComponentTypeSelector';
import { ProjectSelector } from './ProjectSelector';
import { useCreateComponent } from '../hooks/useCreateComponent';
import { useProjects } from '../hooks/useProjects';
import { getTemplate } from '../services/templates';
import type { ComponentType, ComponentCreateResponse } from '../types';

interface ComponentCreateFormProps {
  onSuccess?: (response: ComponentCreateResponse) => void;
}

export function ComponentCreateForm({
  onSuccess,
}: ComponentCreateFormProps = {}) {
  const { t } = useTranslation('components');
  const [selectedType, setSelectedType] = useState<ComponentType>('skill');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useCreateComponent({ onSuccess });
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  // 타입 변경 시 템플릿 로드
  useEffect(() => {
    setContent(
      getTemplate(selectedType, name, description)
    );
  }, [selectedType, name, description]);

  // 프로젝트 로드 시 첫 번째 선택
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const globalProject = projects.find((p) => p.is_global);
      setSelectedProjectId(globalProject?.id ?? projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // name/description 변경 시 content 플레이스홀더 업데이트 (선택적)
  useEffect(() => {
    if (content && (content.includes('{name}') || content.includes('{description}'))) {
      const updated = content
        .replace(/{name}/g, name || 'my-new-component')
        .replace(/{description}/g, description || 'A component that does something useful');
      if (updated !== content) setContent(updated);
    }
  }, [name, description, content]);

  const handleTypeChange = (type: ComponentType) => {
    setSelectedType(type);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleCancel = () => {
    const hasContent =
      name || description || tagsInput || content.replace(/^---[\s\S]*?---\n\n/s, '').trim();
    if (hasContent && !window.confirm(t('create.confirmCancel'))) {
      return;
    }
    window.history.back();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError(t('create.nameRequired'));
      return;
    }
    if (!selectedProjectId) {
      setValidationError(t('create.projectRequired'));
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    createMutation.mutate({
      type: selectedType,
      name: name.trim(),
      project_id: selectedProjectId,
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const errorMessage =
    validationError ??
    (createMutation.error instanceof Error ? createMutation.error.message : null);

  const stepStatus = [
    {
      id: 'create-step-1',
      label: t('create.step1'),
      done: !!selectedProjectId && name.trim().length > 0,
    },
    {
      id: 'create-step-2',
      label: t('create.step2'),
      done: description.trim().length > 0 || tagsInput.trim().length > 0,
    },
    {
      id: 'create-step-3',
      label: t('create.step3'),
      done: content.trim().length > 0,
    },
  ] as const;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Link
        to="/components"
        className="inline-flex items-center gap-2 text-theme-secondary hover:text-primary transition-colors text-sm font-mono"
      >
        {t('create.backToComponents')}
      </Link>

      <div className="vs-frost-panel rounded-xl p-4">
        <p className="text-xs uppercase tracking-[0.15em] text-theme-secondary mb-3">
          {t('create.stepGuide')}
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

      <div className="space-y-6">
        <section
          id="create-step-1"
          className="vs-frost-panel rounded-xl p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold text-theme-primary">
            {t('create.step1')} <span className="text-theme-danger" aria-hidden>*</span>
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-theme-secondary mb-3">{t('create.componentType')}</h3>
              <ComponentTypeSelector
                selectedType={selectedType}
                onTypeChange={handleTypeChange}
              />
            </div>
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              projects={projects}
              isLoading={projectsLoading}
              onProjectChange={handleProjectChange}
            />
          </div>
          <label
            htmlFor="component-name"
            className="block text-sm font-medium text-theme-secondary"
          >
            {t('create.nameLabel')} <span className="text-theme-danger" aria-hidden>*</span>
          </label>
          <input
            id="component-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('create.namePlaceholder')}
            required
            aria-required
            className="w-full px-4 py-2 rounded-lg input-theme"
          />
        </section>

        <section
          id="create-step-2"
          className="vs-frost-panel rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-theme-primary">{t('create.step2')}</h2>
          <label
            htmlFor="component-description"
            className="block text-sm font-medium text-theme-secondary"
          >
            {t('create.descriptionLabel')}
          </label>
          <input
            id="component-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('create.descriptionPlaceholder')}
            className="w-full px-4 py-2 rounded-lg input-theme"
          />
          <label
            htmlFor="component-tags"
            className="block text-sm font-medium text-theme-secondary"
          >
            {t('create.tagsLabel')}
          </label>
          <input
            id="component-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('create.tagsPlaceholder')}
            className="w-full px-4 py-2 rounded-lg input-theme"
          />
        </section>

        <section
          id="create-step-3"
          className="vs-frost-panel rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-theme-primary">{t('create.step3')}</h2>
          <label
            htmlFor="component-content"
            className="block text-sm font-medium text-theme-secondary"
          >
            {t('create.contentLabel')}
          </label>
          <textarea
            id="component-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full px-4 py-2 rounded-lg input-theme font-mono text-sm resize-y"
            placeholder={t('create.contentPlaceholder')}
          />
        </section>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl alert-theme-danger p-4"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 rounded-lg btn-theme-surface transition-colors"
        >
          {t('common:cancel')}
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="px-6 py-2 rounded-lg btn-theme-primary-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {createMutation.isPending ? t('common:creating') : t('common:createComponent')}
        </button>
      </div>
    </form>
  );
}
