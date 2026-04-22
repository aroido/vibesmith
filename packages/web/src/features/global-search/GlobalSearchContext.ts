/**
 * GlobalSearchContext - 전역 검색 모달 제어
 */

import { createContext, useContext } from 'react';

interface GlobalSearchContextValue {
  openSearch: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch(): GlobalSearchContextValue {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error('useGlobalSearch must be used within GlobalSearchProvider');
  }
  return context;
}

export { GlobalSearchContext };
