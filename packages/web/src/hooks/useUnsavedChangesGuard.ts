import { useEffect } from 'react';
import { useBeforeUnload } from 'react-router-dom';

export function useUnsavedChangesGuard(when: boolean, message: string) {
  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = message;
  });

  useEffect(() => {
    if (!when) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.getAttribute('target') === '_blank') return;

      const confirmed = window.confirm(message);
      if (confirmed) return;

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [message, when]);
}
