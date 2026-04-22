/**
 * MarkdownRenderer - react-markdown + remark-gfm + SyntaxHighlighter
 * GitHub 스타일 마크다운 렌더링, 코드 블록 신택스 하이라이팅
 */

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import { ANALYTICS_NO_CAPTURE_CLASS } from '@/common/analytics/privacy';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 필요한 언어만 등록해 문서 뷰어 번들 크기를 최소화
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const components: Components = useMemo(
    () => ({
      code({ className: codeClassName, children, ...props }) {
        const match = /language-([a-zA-Z0-9+-]+)/.exec(codeClassName || '');
        const language = match?.[1]?.toLowerCase();
        if (language) {
          return (
            <SyntaxHighlighter
              language={language}
              PreTag="div"
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- react-syntax-highlighter style type mismatch */
              style={oneDark as any}
              customStyle={{
                margin: '0.5rem 0',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
              codeTagProps={{ className: 'font-mono' }}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          );
        }
        return (
          <code className={codeClassName} {...props}>
            {children}
          </code>
        );
      },
    }),
    []
  );

  return (
    <div
      className={`${ANALYTICS_NO_CAPTURE_CLASS} prose max-w-none prose-pre:bg-theme-elevated prose-pre:border prose-pre:border-theme prose-code:bg-theme-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-p:text-theme-secondary prose-li:text-theme-secondary prose-a:text-primary prose-blockquote:border-theme prose-blockquote:bg-theme-surface/30 prose-blockquote:py-0.5 prose-img:rounded-lg ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
