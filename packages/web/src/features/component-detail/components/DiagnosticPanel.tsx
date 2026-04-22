/**
 * Diagnostic Panel
 * 구성요소 문법 검증 및 자동 진단 (Phase 1: 정적 분석)
 * 단일 패널 안에 요약 + 이슈 목록을 compact하게 표시
 */

import { useTranslation } from 'react-i18next';
import { DIAGNOSTIC_SECTION_HEADERS } from './diagnosticConstants';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { ComponentDetail } from '../types';

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface DiagnosticPanelProps {
  component: ComponentDetail;
}

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

function validateFrontmatter(component: ComponentDetail, t: TFunction): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const fm = component.frontmatter;

  if (!fm || typeof fm !== 'object') {
    issues.push({
      severity: 'error',
      message: t('detail.diagnostic.frontmatterMissing'),
      suggestion: t('detail.diagnostic.frontmatterMissingSuggestion'),
    });
    return issues;
  }

  if (!('name' in fm) || !fm.name) {
    issues.push({
      severity: 'error',
      message: t('detail.diagnostic.frontmatterNameMissing'),
      suggestion: t('detail.diagnostic.frontmatterNameSuggestion'),
    });
  }

  if (!('description' in fm) || !fm.description) {
    issues.push({
      severity: 'warning',
      message: t('detail.diagnostic.frontmatterDescriptionMissing'),
      suggestion: t('detail.diagnostic.frontmatterDescriptionSuggestion'),
    });
  }

  return issues;
}

function validateContent(component: ComponentDetail, t: TFunction): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const content = component.content || '';

  if (content.trim().length < 100) {
    issues.push({
      severity: 'warning',
      message: t('detail.diagnostic.contentTooShort'),
      suggestion: t('detail.diagnostic.contentTooShortSuggestion'),
    });
  }

  const hasUsageSection = DIAGNOSTIC_SECTION_HEADERS.USAGE.some((h) =>
    content.includes(h)
  );
  if (!hasUsageSection) {
    issues.push({
      severity: 'info',
      message: t('detail.diagnostic.usageSectionMissing'),
      suggestion: t('detail.diagnostic.usageSectionSuggestion'),
    });
  }

  const hasExampleSection = DIAGNOSTIC_SECTION_HEADERS.EXAMPLE.some((h) =>
    content.includes(h)
  );
  if (!hasExampleSection) {
    issues.push({
      severity: 'info',
      message: t('detail.diagnostic.exampleSectionMissing'),
      suggestion: t('detail.diagnostic.exampleSectionSuggestion'),
    });
  }

  return issues;
}

function validateStatus(component: ComponentDetail, t: TFunction): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  if (!component.enabled) {
    issues.push({
      severity: 'warning',
      message: t('detail.diagnostic.componentDisabled'),
      suggestion: t('detail.diagnostic.componentDisabledSuggestion'),
    });
  }

  return issues;
}

const SEVERITY_ICON = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_COLOR = {
  error: 'text-theme-danger',
  warning: 'text-theme-warning',
  info: 'text-primary',
} as const;

const SEVERITY_BG = {
  error: 'bg-theme-danger/5 border-theme-danger/20',
  warning: 'bg-theme-warning/5 border-theme-warning/20',
  info: 'bg-primary/5 border-primary/20',
} as const;

export function DiagnosticPanel({ component }: DiagnosticPanelProps) {
  const { t } = useTranslation('components');
  const allIssues = [
    ...validateStatus(component, t as TFunction),
    ...validateFrontmatter(component, t as TFunction),
    ...validateContent(component, t as TFunction),
  ];
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = allIssues.filter((i) => i.severity === 'info').length;

  return (
    <section className="vs-frost-panel rounded-xl p-5">
      {/* Header: title + summary badges */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-[0.15em] text-theme-secondary">
          {t('detail.diagnosticTitle')}
        </h2>
        {allIssues.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-theme-success">
            <CheckCircle className="h-3.5 w-3.5" aria-hidden />
            {t('detail.diagnostic.complete')}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-theme-danger">
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-theme-warning">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <Info className="h-3.5 w-3.5" aria-hidden />
                {infoCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* All clear */}
      {allIssues.length === 0 && (
        <p className="text-xs text-theme-secondary">
          {t('detail.diagnostic.noIssues')}
        </p>
      )}

      {/* Issues list — compact */}
      {allIssues.length > 0 && (
        <ul className="space-y-2">
          {allIssues.map((issue, index) => {
            const Icon = SEVERITY_ICON[issue.severity];
            return (
              <li
                key={index}
                className={`rounded-lg border p-3 ${SEVERITY_BG[issue.severity]}`}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_COLOR[issue.severity]}`} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-theme-primary">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="mt-1 text-xs text-theme-secondary">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
