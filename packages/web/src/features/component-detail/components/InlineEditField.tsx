/**
 * InlineEditField
 * 클릭하면 텍스트 → 입력 필드로 전환되는 인라인 편집 컴포넌트
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';

interface InlineEditFieldProps {
  value: string;
  onSave: (value: string) => void;
  isSaving?: boolean;
  as?: 'h1' | 'p' | 'span';
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  isSaving = false,
  as: Tag = 'span',
  className = '',
  inputClassName = '',
  placeholder = '',
  maxLength,
  multiline = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const el = multiline ? textareaRef.current : inputRef.current;
    if (isEditing && el) {
      el.focus();
      el.select();
    }
  }, [isEditing, multiline]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const sharedProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: `bg-theme-elevated border border-theme rounded-lg px-3 py-1.5 text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary w-full ${inputClassName}`,
      placeholder,
      maxLength,
      disabled: isSaving,
    };

    return multiline ? (
      <textarea ref={textareaRef} {...sharedProps} rows={3} />
    ) : (
      <input ref={inputRef} {...sharedProps} />
    );
  }

  return (
    <Tag
      className={`group cursor-pointer inline-flex items-center gap-2 hover:bg-theme-elevated rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
    >
      {value || <span className="text-theme-tertiary italic">{placeholder}</span>}
      <Pencil
        className="h-3.5 w-3.5 text-theme-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </Tag>
  );
}
