/**
 * ComponentContent - Content viewer (read) or textarea (edit)
 */

import { useTranslation } from 'react-i18next';

interface ComponentContentProps {
  content: string;
  isEditing: boolean;
  onContentChange: (content: string) => void;
}

export function ComponentContent({
  content,
  isEditing,
  onContentChange,
}: ComponentContentProps) {
  const { t } = useTranslation('components');
  if (isEditing) {
    return (
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full min-h-[200px] p-4 rounded-lg input-theme font-mono text-sm"
        aria-label={t('edit.contentEditLabel')}
      />
    );
  }

  return (
    <pre
      className="whitespace-pre-wrap p-4 rounded-lg bg-theme-elevated border border-theme text-theme-secondary font-mono text-sm"
      role="article"
      aria-label={t('edit.contentViewLabel')}
    >
      {content}
    </pre>
  );
}
