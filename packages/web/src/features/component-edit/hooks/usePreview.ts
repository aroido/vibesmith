/**
 * usePreview Hook
 * 마크다운 미리보기 가시성 관리
 */

import { useState, useCallback } from 'react';

export function usePreview() {
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const togglePreview = useCallback(() => {
    setIsPreviewVisible((prev) => !prev);
  }, []);

  const showPreview = useCallback(() => {
    setIsPreviewVisible(true);
  }, []);

  const hidePreview = useCallback(() => {
    setIsPreviewVisible(false);
  }, []);

  return {
    isPreviewVisible,
    togglePreview,
    showPreview,
    hidePreview,
  };
}
