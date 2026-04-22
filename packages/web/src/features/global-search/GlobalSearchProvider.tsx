/**
 * GlobalSearchProvider Component
 * v1.11.0 - 전역 검색 컨텍스트 프로바이더
 * Issue #69: Omnibox (Cmd+K) 통합
 */

import { useState, useMemo } from 'react';
import { Omnibox } from '../omnibox';
import { useCommandK } from './hooks/useKeyboardShortcut';
import { GlobalSearchContext } from './GlobalSearchContext';

interface GlobalSearchProviderProps {
  children: React.ReactNode;
}

/**
 * 전역 검색 Provider
 * 
 * Cmd+K / Ctrl+K 단축키를 등록하고 전역 검색 모달을 관리합니다.
 */
export function GlobalSearchProvider({ children }: GlobalSearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Cmd+K / Ctrl+K 단축키 등록
  useCommandK(() => setIsOpen(true));

  const contextValue = useMemo(
    () => ({
      openSearch: () => setIsOpen(true),
    }),
    []
  );

  return (
    <GlobalSearchContext.Provider value={contextValue}>
      {children}
      <Omnibox isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </GlobalSearchContext.Provider>
  );
}
