/**
 * TagFilter - 다중 태그 선택, AND/OR 모드, 자동완성
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTagStats } from '@/features/tag-management';
import { TagBadge } from '@/features/tag-management';
import { Tag, ChevronDown } from 'lucide-react';

export type TagFilterMode = 'or' | 'and';

export interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  tagFilterMode: TagFilterMode;
  onTagFilterModeChange: (mode: TagFilterMode) => void;
}

function filterSuggestions(
  query: string,
  allTags: Array<{ tag: string; count: number }>,
  exclude: string[]
): Array<{ tag: string; count: number }> {
  const lower = query.toLowerCase().trim();
  return allTags
    .filter((t) => !exclude.includes(t.tag))
    .filter((t) => !lower || t.tag.toLowerCase().includes(lower))
    .slice(0, 8);
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  tagFilterMode,
  onTagFilterModeChange,
}: TagFilterProps) {
  const { t } = useTranslation('components');
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tagStats = [], isLoading } = useTagStats();
  const suggestions = filterSuggestions(
    inputValue,
    tagStats.map((t) => ({ tag: t.tag, count: t.count })),
    selectedTags
  );

  useEffect(() => {
    if (isOpen) setHighlightedIndex(0);
  }, [isOpen, inputValue, selectedTags]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleAddTag(suggestions[highlightedIndex]?.tag ?? suggestions[0].tag);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label
        htmlFor="tag-filter-input"
        className="block text-sm font-medium text-theme-secondary"
      >
        {t('list.tagLabel')}
      </label>
      <div
        className={`
          relative min-h-[48px]
          flex flex-wrap items-center gap-1.5
          pl-10 pr-8 py-2
          rounded-lg
          bg-theme-surface border border-theme
          focus-within:bg-theme-hover
          transition-colors
        `}
      >
        <Tag
          className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary shrink-0"
          size={18}
          aria-hidden
        />
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-[80px]">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              size="sm"
              onRemove={() => handleRemoveTag(tag)}
            />
          ))}
          <input
            ref={inputRef}
            id="tag-filter-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTags.length === 0 ? t('list.tagSearchPlaceholder') : ''}
            disabled={isLoading}
            className="flex-1 min-w-[60px] bg-transparent text-theme-primary text-sm placeholder:text-theme-tertiary focus:outline-none disabled:opacity-50"
            aria-label={t('list.tagSearchAria')}
            aria-autocomplete="list"
            aria-controls={isOpen ? 'tag-suggestions' : undefined}
          />
        </div>
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </div>

      {/* AND/OR 토글 - 다중 선택 시에만 */}
      {selectedTags.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-theme-tertiary">{t('list.filterMode')}:</span>
          <div className="inline-flex rounded-md border border-theme p-0.5">
            <button
              type="button"
              onClick={() => onTagFilterModeChange('or')}
              className={`px-2 py-0.5 text-xs rounded ${
                tagFilterMode === 'or'
                  ? 'btn-theme-primary-soft'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
              aria-pressed={tagFilterMode === 'or'}
            >
              {t('list.orMode')}
            </button>
            <button
              type="button"
              onClick={() => onTagFilterModeChange('and')}
              className={`px-2 py-0.5 text-xs rounded ${
                tagFilterMode === 'and'
                  ? 'btn-theme-primary-soft'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
              aria-pressed={tagFilterMode === 'and'}
            >
              {t('list.andMode')}
            </button>
          </div>
        </div>
      )}

      {/* 자동완성 드롭다운 */}
      {isOpen && (inputValue || tagStats.length > 0) && (
        <ul
          id="tag-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-theme bg-theme-surface shadow-xl"
        >
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-theme-tertiary">
              {inputValue ? t('list.noSearchResults') : t('list.noTags')}
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li key={s.tag}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlightedIndex}
                  onClick={() => handleAddTag(s.tag)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                    i === highlightedIndex
                      ? 'bg-theme-hover text-theme-primary'
                      : 'text-theme-secondary hover:bg-theme-surface'
                  }`}
                >
                  <span>{s.tag}</span>
                  <span className="text-xs text-theme-tertiary">({s.count})</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
