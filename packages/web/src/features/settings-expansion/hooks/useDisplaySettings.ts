/**
 * useDisplaySettings - Display settings (font size, layout) with localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import type { FontSize, Layout } from '../types';
import * as storage from '../utils/settingsStorage';

export function useDisplaySettings() {
  const [fontSize, setFontSizeState] = useState<FontSize>(storage.getFontSize);
  const [layout, setLayoutState] = useState<Layout>(storage.getLayout);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const stored = storage.getFontSize();
    setFontSizeState(stored);
  }, []);

  const setFontSize = useCallback((value: FontSize) => {
    setFontSizeState(value);
    storage.setFontSize(value);
  }, []);

  const setLayout = useCallback((value: Layout) => {
    setLayoutState(value);
    storage.setLayout(value);
  }, []);

  return { fontSize, setFontSize, layout, setLayout };
}
