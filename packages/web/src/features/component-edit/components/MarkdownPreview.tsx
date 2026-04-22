/**
 * Markdown Preview Component
 * 실시간 마크다운 미리보기 (Prism.js 코드 하이라이팅)
 */

import { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import Prism from 'prismjs';

interface MarkdownPreviewProps {
  content: string;
  name: string;
  description: string;
}

let prismLanguageLoader: Promise<unknown[]> | null = null;

function ensurePrismLanguages(): Promise<unknown[]> {
  if (!prismLanguageLoader) {
    prismLanguageLoader = (async () => {
      const loaded: unknown[] = [];

      // Prism 언어 모듈은 의존 순서가 있어 순차적으로 로딩
      loaded.push(await import('prismjs/components/prism-javascript'));
      loaded.push(await import('prismjs/components/prism-typescript'));
      loaded.push(await import('prismjs/components/prism-jsx'));
      loaded.push(await import('prismjs/components/prism-tsx'));
      loaded.push(await import('prismjs/components/prism-python'));
      loaded.push(await import('prismjs/components/prism-bash'));
      loaded.push(await import('prismjs/components/prism-json'));
      loaded.push(await import('prismjs/components/prism-yaml'));
      loaded.push(await import('prismjs/components/prism-markdown'));

      return loaded;
    })();
  }
  return prismLanguageLoader;
}

export function MarkdownPreview({
  content,
  name,
  description,
}: MarkdownPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation('components');
  const preview = useMemo(() => {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });

      const html = marked(content);

      return {
        frontmatter: { name, description },
        html,
        parseError: false,
      };
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return {
        frontmatter: { name, description },
        html: '',
        parseError: true,
      };
    }
  }, [content, name, description]);

  useEffect(() => {
    let isCancelled = false;
    void ensurePrismLanguages()
      .then(() => {
        if (!isCancelled && previewRef.current) {
          Prism.highlightAllUnder(previewRef.current);
        }
      })
      .catch(() => {
        // 테스트/브라우저 환경 차이로 언어 모듈 로딩 실패 시에도 편집 흐름은 유지
      });

    return () => {
      isCancelled = true;
    };
  }, [preview.html]);

  return (
    <div className="vs-frost-panel flex h-full flex-col overflow-hidden rounded-xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-theme">
        <h2 className="text-lg font-semibold text-theme-primary">{t('edit.previewTitle')}</h2>
        <p className="text-sm text-theme-secondary mt-1">{t('edit.previewLive')}</p>
      </div>

      {/* Frontmatter */}
      <div className="border-b border-theme bg-theme-elevated px-6 py-4">
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-theme-secondary">name:</span>{' '}
            <span className="text-primary font-mono">
              {preview.frontmatter.name || '(empty)'}
            </span>
          </div>
          <div>
            <span className="text-theme-secondary">description:</span>{' '}
            <span className="text-theme-secondary">
              {preview.frontmatter.description || '(empty)'}
            </span>
          </div>
        </div>
      </div>

      {/* Markdown Content */}
      <div
        ref={previewRef}
        className="flex-1 px-6 py-4 overflow-y-auto prose max-w-none"
        dangerouslySetInnerHTML={{ __html: preview.html }}
      />
    </div>
  );
}
