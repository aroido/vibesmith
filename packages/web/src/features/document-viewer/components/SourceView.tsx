/**
 * SourceView - 마크다운 소스 텍스트 표시
 */

interface SourceViewProps {
  content: string;
}

export function SourceView({ content }: SourceViewProps) {
  return (
    <pre className="text-sm text-theme-secondary font-mono whitespace-pre-wrap break-words overflow-x-auto p-4 rounded-lg bg-theme-elevated border border-theme">
      {content || ' '}
    </pre>
  );
}
