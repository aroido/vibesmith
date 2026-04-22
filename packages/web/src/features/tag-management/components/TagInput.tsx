/**
 * TagInput Component
 * v1.12.0 - 태그 입력 컴포넌트
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TagBadge } from './TagBadge';
import { validateTag, validateTags, normalizeTag } from '../utils/tagValidation';
import { filterSuggestions } from '../utils/tagAutocomplete';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  allTags?: string[];
  placeholder?: string;
  maxTags?: number;
}

export function TagInput({
  value,
  onChange,
  allTags = [],
  placeholder,
  maxTags = 10,
}: TagInputProps) {
  const { t } = useTranslation('components');
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 자동완성 제안 목록
  const suggestions = filterSuggestions(inputValue, allTags, value);

  // 입력 필드 포커스 시 자동완성 표시
  useEffect(() => {
    if (inputValue && suggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [inputValue, suggestions.length]);

  const handleAddTag = (tag: string) => {
    const normalized = normalizeTag(tag);

    // 빈 태그 무시
    if (!normalized) {
      return;
    }

    // 중복 체크
    if (value.includes(normalized)) {
      setError(t('tags.tagExists'));
      setTimeout(() => setError(null), 3000);
      return;
    }

    // 태그 유효성 검사
    const validation = validateTag(normalized);
    if (!validation.valid) {
      setError(t(validation.errorKey || 'tags.invalidTag'));
      setTimeout(() => setError(null), 3000);
      return;
    }

    // 최대 개수 체크
    const newTags = [...value, normalized];
    const tagsValidation = validateTags(newTags);
    if (!tagsValidation.valid) {
      setError(t(tagsValidation.errorKey || 'tags.maxTags', { max: maxTags }));
      setTimeout(() => setError(null), 3000);
      return;
    }

    // 태그 추가
    onChange(newTags);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(0);
    setError(null);

    // 입력 필드에 포커스 유지
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        // 선택된 제안 추가
        handleAddTag(suggestions[selectedSuggestionIndex]);
      } else {
        // 입력값 추가
        handleAddTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // 마지막 태그 삭제
      handleRemoveTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          Math.min(prev + 1, suggestions.length - 1)
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(0);
    }
  };

  return (
    <div className="relative">
      {/* 태그 목록 + 입력 필드 */}
      <div
        className="
          flex flex-wrap items-center gap-2
          p-3
          bg-theme-surface/40
          border border-theme
          rounded-lg
          focus-within:bg-theme-hover/40
          transition-colors
        "
      >
        {value.map((tag) => (
          <TagBadge key={tag} tag={tag} onRemove={() => handleRemoveTag(tag)} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue || allTags.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // 약간의 지연을 두어 클릭 이벤트가 먼저 처리되도록 함
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={value.length === 0 ? (placeholder ?? t('tags.placeholderDefault')) : ''}
          className="
            flex-1 min-w-[120px]
            bg-transparent
            text-theme-primary text-sm
            placeholder:text-theme-tertiary
            focus:outline-none
          "
          aria-label={t('tags.addTagAria')}
          disabled={value.length >= maxTags}
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <p className="mt-1 text-xs text-theme-danger">{error}</p>
      )}

      {/* 자동완성 제안 */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="
            absolute z-10 mt-1 w-full
            bg-theme-elevated/95 backdrop-blur-md
            border border-theme
            rounded-lg
            shadow-2xl
            overflow-hidden
          "
          role="listbox"
          aria-label={t('tags.suggestionsAria')}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              onClick={() => handleAddTag(suggestion)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
              className={`
                w-full text-left px-4 py-2
                text-sm
                transition-colors
                ${
                  index === selectedSuggestionIndex
                    ? 'bg-theme-hover text-theme-primary'
                    : 'text-theme-secondary hover:bg-theme-surface/40'
                }
              `}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* 도움말 */}
      <p className="mt-1 text-xs text-theme-tertiary">
        {t('tags.helpText', { max: maxTags })}
      </p>
    </div>
  );
}
