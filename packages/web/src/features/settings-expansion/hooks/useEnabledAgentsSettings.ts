/**
 * useEnabledAgentsSettings - Cursor/Claude agent toggles with localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import type { EnabledAgents } from '../types';
import * as storage from '../utils/settingsStorage';

export function useEnabledAgentsSettings() {
  const [enabledAgents, setEnabledAgentsState] = useState<EnabledAgents>(
    storage.getEnabledAgents
  );

  useEffect(() => {
    setEnabledAgentsState(storage.getEnabledAgents());
  }, []);

  const setEnabledAgents = useCallback((value: EnabledAgents) => {
    setEnabledAgentsState(value);
    storage.setEnabledAgents(value);
  }, []);

  const setAgent = useCallback(
    (agent: keyof EnabledAgents, value: boolean) => {
      const next = { ...enabledAgents, [agent]: value };
      setEnabledAgentsState(next);
      storage.setEnabledAgents(next);
    },
    [enabledAgents]
  );

  return { enabledAgents, setEnabledAgents, setAgent };
}
