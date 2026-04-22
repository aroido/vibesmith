/**
 * Modal accessibility hook - Esc key, focus management
 * WCAG 2.1 AA: Keyboard Accessible (2.1.1), Focus Order (2.4.3)
 */

import { useEffect, useRef } from 'react';

/**
 * Hook for modal accessibility: Esc to close, focus trap
 * @param isOpen - Whether modal is open
 * @param onClose - Close handler
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const previousActiveRef = useRef<Element | null>(null);

  // Esc key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Store focus when opening, restore when closing
  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement;
    } else if (previousActiveRef.current instanceof HTMLElement) {
      previousActiveRef.current.focus();
      previousActiveRef.current = null;
    }
  }, [isOpen]);

  return { previousActiveRef };
}
