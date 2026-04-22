/**
 * useKeyboardShortcut Hook
 * v1.11.0 - 키보드 단축키 관리
 */

import { useEffect } from 'react';

/**
 * 키보드 단축키 훅
 * 
 * @param key - 키 (예: 'k')
 * @param callback - 단축키 실행 시 호출될 콜백
 * @param options - 옵션 (metaKey, ctrlKey 등)
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {}
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 단축키 무시
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // 단축키 매칭 확인
      const isMetaKey = options.metaKey ? e.metaKey : true;
      const isCtrlKey = options.ctrlKey ? e.ctrlKey : true;
      const isShiftKey = options.shiftKey ? e.shiftKey : !e.shiftKey;
      const isAltKey = options.altKey ? e.altKey : !e.altKey;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        isMetaKey &&
        isCtrlKey &&
        isShiftKey &&
        isAltKey
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}

/**
 * Cmd+K / Ctrl+K 단축키 훅
 * 
 * @param callback - 단축키 실행 시 호출될 콜백
 */
export function useCommandK(callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) 또는 Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}
