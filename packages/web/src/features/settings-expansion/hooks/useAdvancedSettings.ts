/**
 * useAdvancedSettings - Advanced settings (auto scan, experimental) with localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import * as storage from '../utils/settingsStorage';

export function useAdvancedSettings() {
  const [autoScan, setAutoScanState] = useState(storage.getAutoScan);
  const [experimental, setExperimentalState] = useState(
    storage.getExperimental
  );

  useEffect(() => {
    setAutoScanState(storage.getAutoScan());
    setExperimentalState(storage.getExperimental());
  }, []);

  const setAutoScan = useCallback((value: boolean) => {
    setAutoScanState(value);
    storage.setAutoScan(value);
  }, []);

  const setExperimental = useCallback((value: boolean) => {
    setExperimentalState(value);
    storage.setExperimental(value);
  }, []);

  return { autoScan, setAutoScan, experimental, setExperimental };
}
