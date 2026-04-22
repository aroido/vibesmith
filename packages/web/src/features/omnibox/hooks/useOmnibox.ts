/**
 * useOmnibox Hook
 * Issue #69: 통합 검색 및 빠른 액션
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Component } from '@/common/types';
import type { SearchResultItem } from '../../global-search/types';
import { fuzzySearch } from '../../global-search/services/fuzzySearch';

interface Project {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  component_count: number;
}

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
 * 프로젝트 목록 조회
 */
async function fetchAllProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  return response.json() as Promise<Project[]>;
}

/**
 * Omnibox 통합 검색 훅
 */
export function useOmnibox() {
  const [query, setQuery] = useState('');

  // 전체 구성요소 조회
  const { data: components = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: fetchAllComponents,
    staleTime: 60_000, // 1분
  });

  // 전체 프로젝트 조회
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchAllProjects,
    staleTime: 60_000, // 1분
  });

  // 컴포넌트 Fuzzy 검색
  const componentResults = useMemo<SearchResultItem[]>(() => {
    if (!query.trim()) return [];
    return fuzzySearch(components, query);
  }, [components, query]);

  // 프로젝트 Fuzzy 검색
  const projectResults = useMemo<Project[]>(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.path.toLowerCase().includes(lowerQuery)
    );
  }, [projects, query]);

  return {
    query,
    setQuery,
    componentResults,
    projectResults,
    loading: componentsLoading || projectsLoading,
  };
}
