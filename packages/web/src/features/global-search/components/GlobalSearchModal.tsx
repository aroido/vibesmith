/**
 * GlobalSearchModal Component
 * v1.11.0 - 전역 검색 모달
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ComponentIcon, ModalPortal } from '@/components/common';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { highlightMatches } from '../services/fuzzySearch';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { t, i18n } = useTranslation('globalSearch');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    loading,
  } = useGlobalSearch();

  const {
    recentSearches,
    addSearch,
    removeSearch,
  } = useSearchHistory();

  // 컴포넌트 선택 핸들러
  const handleSelect = useCallback((componentId: string) => {
    // 검색 기록 추가
    if (query.trim()) {
      addSearch(query);
    }
    
    // 상세 페이지로 이동
    void navigate(`/components/${componentId}`);
    onClose();
  }, [query, addSearch, navigate, onClose]);

  // 모달 열릴 때 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results, moveSelection, onClose, handleSelect]);

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  const handleRemoveRecentSearch = (recentQuery: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSearch(recentQuery);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2147483100] flex items-start justify-center pt-20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
      >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-2xl
          bg-theme-elevated/95 backdrop-blur-md
          panel-theme-search
          rounded-xl
          shadow-2xl
          overflow-hidden
        "
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-theme">
          <Search className="h-5 w-5 text-theme-secondary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="
              flex-1 bg-transparent
              text-theme-primary text-lg
              placeholder:text-theme-tertiary
              focus:outline-none
            "
            aria-label={t('ariaSearchLabel')}
            id="search-modal-title"
          />
          <kbd className="px-2 py-1 text-xs text-theme-secondary bg-theme-surface rounded border border-theme">
            Esc
          </kbd>
        </div>

        {/* Recent Searches (Should Have) */}
        {!query && recentSearches.length > 0 && (
          <div className="p-4 border-b border-theme">
            <p className="text-xs text-theme-secondary mb-2">{t('recentSearches')}</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((recentQuery) => (
                <div
                  key={recentQuery}
                  className="
                    group flex items-center gap-1
                    px-3 py-1.5 rounded-lg
                    bg-theme-surface/40 hover:bg-theme-surface
                    border border-theme
                    transition-all duration-200
                  "
                >
                  <button
                    type="button"
                    onClick={() => handleRecentSearchClick(recentQuery)}
                    className="
                      text-theme-secondary hover:text-primary
                      transition-colors
                      text-sm
                    "
                  >
                    • {recentQuery}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecentSearch(recentQuery, e)}
                    className="
                      opacity-0 group-hover:opacity-100
                      text-theme-tertiary hover:text-theme-danger
                      transition-opacity
                      ml-1
                    "
                    aria-label={t('ariaRemoveLabel', { query: recentQuery })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current text-primary mx-auto mb-2" />
              <p className="text-theme-secondary text-sm">{t('loading')}</p>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="p-8 text-center">
              <p className="text-theme-secondary">{t('noResultsFor', { query })}</p>
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="p-8 text-center">
              <p className="text-theme-secondary">{t('typeToSearch')}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div role="listbox" aria-label={t('ariaResultsLabel')}>
              { }
              {results.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleSelect(result.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full text-left p-4
                    border-b border-theme last:border-b-0
                    transition-colors
                    ${
                      index === selectedIndex
                        ? 'row-theme-active'
                        : 'hover:bg-theme-surface/40'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <ComponentIcon type={result.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-semibold truncate ${
                            result.enabled ? 'text-theme-primary' : 'text-theme-secondary'
                          }`}
                          dangerouslySetInnerHTML={{
                            __html: result.matches?.name
                              ? highlightMatches(result.name, result.matches.name)
                              : result.name,
                          }}
                        />
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded ${
                            result.enabled
                              ? 'badge-theme-success'
                              : 'badge-theme-muted'
                          }`}
                        >
                          {result.enabled ? t('active') : t('inactive')}
                        </span>
                      </div>
                      {result.description && (
                        <p
                          className="text-sm text-theme-secondary mt-1 line-clamp-2"
                          dangerouslySetInnerHTML={{
                            __html: result.matches?.description
                              ? highlightMatches(result.description, result.matches.description)
                              : result.description,
                          }}
                        />
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-theme-tertiary">
                        <span className="capitalize">{result.type}</span>
                        <span>•</span>
                        <span>{result.project_id}</span>
                        <span>•</span>
                        <span>
                          {t('updated', {
                            date: new Date(result.updated_at).toLocaleDateString(
                              i18n.language === 'ko' ? 'ko-KR' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            ),
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              { }
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-theme bg-theme-elevated">
          <div className="flex items-center justify-center gap-4 text-xs text-theme-secondary">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-theme-surface rounded border border-theme">↑↓</kbd>
              {t('navigate')}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-theme-surface rounded border border-theme">↵</kbd>
              {t('select')}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-theme-surface rounded border border-theme">Esc</kbd>
              {t('close')}
            </span>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
