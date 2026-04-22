/**
 * useSearchHistory Hook
 * v1.11.0 - 검색 기록 관리 (LocalStorage)
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'vibesmith-search-history';
const MAX_HISTORY_SIZE = 10;

/**
 * 검색 기록 관리 훅
 * 
 * @returns 검색 기록 및 관리 함수
 */
export function useSearchHistory() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // LocalStorage에서 검색 기록 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setRecentSearches(parsed);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // 검색 기록 추가
  const addSearch = (query: string) => {
    if (!query.trim()) return;

    setRecentSearches((prev) => {
      // 중복 제거 및 최신 검색어를 맨 앞에 추가
      const filtered = prev.filter((q) => q !== query);
      const updated = [query, ...filtered].slice(0, MAX_HISTORY_SIZE);

      // LocalStorage에 저장
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }

      return updated;
    });
  };

  // 검색 기록 삭제
  const removeSearch = (query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((q) => q !== query);

      // LocalStorage에 저장
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }

      return updated;
    });
  };

  // 검색 기록 전체 삭제
  const clearHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  };

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearHistory,
  };
}
