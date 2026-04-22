/**
 * TagBadge Component
 * v1.12.0 - 태그 배지 컴포넌트
 */

import type { CSSProperties } from 'react';
import { getTagColor, getTagBackgroundColor, getTagBorderColor } from '../utils/tagColor';

interface TagBadgeProps {
  tag: string;
  count?: number;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function TagBadge({ tag, count, onRemove, onClick, size = 'md' }: TagBadgeProps) {
  const fgTone = getTagColor(tag);
  const bgTone = getTagBackgroundColor(tag);
  const bdTone = getTagBorderColor(tag);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const tagStyle: CSSProperties = {
    '--tag-fg': fgTone,
    '--tag-bg': bgTone,
    '--tag-bd': bdTone,
    borderWidth: '1px',
    borderStyle: 'solid',
  } as CSSProperties;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${sizeClasses[size]}
        rounded-md
        font-medium
        text-[var(--tag-fg)] bg-[var(--tag-bg)] border border-[var(--tag-bd)]
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
      `}
      style={tagStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={onClick ? `Filter by ${tag} tag` : undefined}
    >
      <span>{tag}</span>
      {count !== undefined && (
        <span className="opacity-70">({count})</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="
            ml-0.5 -mr-1
            hover:bg-theme-hover
            rounded
            transition-colors
          "
          aria-label={`Remove ${tag} tag`}
        >
          ×
        </button>
      )}
    </span>
  );
}
