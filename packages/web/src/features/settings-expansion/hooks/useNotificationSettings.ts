/**
 * useNotificationSettings - Notification settings with localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import type { NotificationTypes } from '../types';
import * as storage from '../utils/settingsStorage';

export function useNotificationSettings() {
  const [enabled, setEnabledState] = useState(storage.getNotificationEnabled);
  const [types, setTypesState] = useState<NotificationTypes>(
    storage.getNotificationTypes
  );

  useEffect(() => {
    const storedEnabled = storage.getNotificationEnabled();
    const storedTypes = storage.getNotificationTypes();
    setEnabledState(storedEnabled);
    setTypesState(storedTypes);
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    storage.setNotificationEnabled(value);
  }, []);

  const setTypes = useCallback((value: NotificationTypes) => {
    setTypesState(value);
    storage.setNotificationTypes(value);
  }, []);

  const setType = useCallback(
    (key: keyof NotificationTypes, value: boolean) => {
      const next = { ...types, [key]: value };
      setTypesState(next);
      storage.setNotificationTypes(next);
    },
    [types]
  );

  return { enabled, setEnabled, types, setTypes, setType };
}
