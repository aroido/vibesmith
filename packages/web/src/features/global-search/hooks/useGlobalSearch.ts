/**
 * useGlobalSearch Hook
 * v1.11.0 - 전역 검색 훅
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Component } from '../../../common/types';
import type { SearchResultItem } from '../types';
import { fuzzySearch } from '../services/fuzzySearch';

/**
 * 전역 구성요소 목록 조회
 */
async function fetchAllComponents(): Promise<Component[]> {
  const response = await fetch('/api/components');
  if (!response.ok) {
    throw new Error('Failed to fetch components');
  }
  return response.json() as Promise<Component[]>;
}

/**
 * 전역 검색 훅
 * 
 * @returns 검색 상태 및 함수
 */
export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 전체 구성요소 조회
  const { data: components = [], isLoading } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: fetchAllComponents,
    staleTime: 60_000, // 1분
  });

  // Fuzzy 검색 수행
  const results = useMemo<SearchResultItem[]>(() => {
    return fuzzySearch(components, query);
  }, [components, query]);

  // 검색어 변경 시 선택 인덱스 초기화
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  }, []);

  // 선택 인덱스 이동
  const moveSelection = useCallback(
    (direction: 'up' | 'down') => {
      setSelectedIndex((prev) => {
        if (direction === 'down') {
          return Math.min(prev + 1, results.length - 1);
        } else {
          return Math.max(prev - 1, 0);
        }
      });
    },
    [results.length]
  );

  return {
    query,
    setQuery: handleQueryChange,
    results,
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    loading: isLoading,
  };
}
