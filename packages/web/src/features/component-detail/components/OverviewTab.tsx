/**
 * OverviewTab
 * 개요 탭 — 하나의 카드에 설명/메타/태그/frontmatter/의존성을 통합 표시
 * "편집" 버튼으로 설명 필드를 편집 모드로 전환
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, X, ArrowRight, Box } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ANALYTICS_MASK_TEXT_CLASS,
  ANALYTICS_NO_CAPTURE_CLASS,
} from '@/common/analytics/privacy';
import { InlineTagEditor } from './InlineTagEditor';
import type { ComponentDetail, DependencyItem } from '../types';

interface OverviewTabProps {
  component: ComponentDetail;
  onUpdateField: (field: string, value: unknown) => void;
  isSaving: boolean;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export function OverviewTab({ component, onUpdateField, isSaving, isEditing, onEditingChange }: OverviewTabProps) {
  const { t, i18n } = useTranslation(['components', 'dashboard', 'common']);
  const locale = i18n.language.startsWith('ko') ? 'ko-KR' : 'en-US';
  const [descDraft, setDescDraft] = useState(component.description);

  const handleEdit = () => {
    setDescDraft(component.description);
    onEditingChange(true);
  };

  const handleCancel = () => {
    setDescDraft(component.description);
    onEditingChange(false);
  };

  const handleSave = () => {
    if (descDraft.trim() !== component.description) {
      onUpdateField('description', descDraft.trim());
    }
    onEditingChange(false);
  };

  const deps = component.dependencies ?? { depends_on: [], depended_by: [] };
  const { depends_on, depended_by } = deps;
  const hasDependencies = depends_on.length > 0 || depended_by.length > 0;
  const hasFrontmatter = Object.keys(component.frontmatter ?? {}).length > 0;

  return (
    <div className="vs-frost-panel rounded-xl">
      {/* 헤더: 편집 버튼 */}
      <div className="flex items-center justify-end px-5 pt-4 pb-0">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-surface transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t('common:cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || descDraft.trim() === component.description}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-primary-soft transition-colors disabled:opacity-50"
            >
              {t('common:save')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg btn-theme-surface transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('common:edit')}
          </button>
        )}
      </div>

      {/* 설명 */}
      <div className="px-5 py-4">
        <p className="text-xs text-theme-secondary mb-1.5">
          {t('components:detail.description')}
        </p>
        {isEditing ? (
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            className="w-full bg-theme-elevated border border-theme rounded-lg px-3 py-2 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            placeholder={t('components:detail.noDescription')}
            disabled={isSaving}
            autoFocus
          />
        ) : (
          <p className="text-sm text-theme-primary leading-relaxed">
            {component.description || (
              <span className="text-theme-tertiary italic">{t('components:detail.noDescription')}</span>
            )}
          </p>
        )}
      </div>

      <hr className="border-theme mx-5" />

      {/* 메타 정보 */}
      <dl className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-xs text-theme-secondary">{t('components:columns.project')}</dt>
          <dd className="text-sm text-theme-primary mt-0.5">{component.project_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-theme-secondary">{t('components:detail.path')}</dt>
          <dd
            className={`${ANALYTICS_MASK_TEXT_CLASS} text-sm text-theme-primary font-mono mt-0.5 truncate`}
            title={component.path}
          >
            {component.path}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-theme-secondary">{t('components:detail.updated')}</dt>
          <dd className="text-sm text-theme-primary mt-0.5">
            {new Date(component.updated_at).toLocaleString(locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-theme-secondary">{t('components:detail.created')}</dt>
          <dd className="text-sm text-theme-primary mt-0.5">
            {new Date(component.created_at).toLocaleString(locale)}
          </dd>
        </div>
      </dl>

      <hr className="border-theme mx-5" />

      {/* 태그 */}
      <div className="px-5 py-4">
        <p className="text-xs text-theme-secondary mb-2">{t('components:columns.tags')}</p>
        <InlineTagEditor
          tags={component.tags}
          onAdd={(tag) => onUpdateField('tags', [...component.tags, tag])}
          onRemove={(tag) => onUpdateField('tags', component.tags.filter((v) => v !== tag))}
          isSaving={isSaving}
        />
      </div>

      {/* Frontmatter (있을 때만) */}
      {hasFrontmatter && (
        <>
          <hr className="border-theme mx-5" />
          <div className="px-5 py-4">
            <p className="text-xs text-theme-secondary mb-2">Frontmatter</p>
            <dl
              className={`${ANALYTICS_NO_CAPTURE_CLASS} grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2`}
            >
              {Object.entries(component.frontmatter).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-theme-tertiary font-mono">{key}</dt>
                  <dd className="text-sm text-theme-primary font-mono break-all mt-0.5">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}

      {/* 의존성 (있을 때만) */}
      {hasDependencies && (
        <>
          <hr className="border-theme mx-5" />
          <div className="px-5 py-4">
            <p className="text-xs text-theme-secondary mb-2">
              {t('components:detail.dependencies')}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {depends_on.length > 0 && (
                <>
                  <DepLinks items={depends_on} />
                  <ArrowRight className="h-4 w-4 text-theme-tertiary shrink-0" />
                </>
              )}
              <span className="px-3 py-1.5 rounded-lg border-2 border-[var(--color-primary)] text-sm font-mono font-semibold text-theme-primary">
                {component.name}
              </span>
              {depended_by.length > 0 && (
                <>
                  <ArrowRight className="h-4 w-4 text-theme-tertiary shrink-0" />
                  <DepLinks items={depended_by} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DepLinks({ items }: { items: DependencyItem[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/components/${item.id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-elevated border border-theme hover:border-[var(--color-primary)] transition-colors text-sm"
        >
          <Box className="h-3.5 w-3.5 text-theme-secondary" aria-hidden />
          <span className="font-mono text-xs text-theme-primary">{item.name}</span>
        </Link>
      ))}
    </div>
  );
}
