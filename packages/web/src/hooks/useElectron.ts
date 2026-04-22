import { useEffect, useState } from 'react';
import i18n from '../i18n';
import { isElectron, getElectronAPI, type ElectronAPI } from '../types/electron';

/**
 * Electron API를 사용하기 위한 React Hook
 * 
 * @example
 * ```tsx
 * const { electronAPI, isElectronEnv } = useElectron();
 * 
 * if (isElectronEnv && electronAPI) {
 *   const result = await electronAPI.selectFolder();
 *   if (result.success) {
 *     console.log(result.data);
 *   }
 * }
 * ```
 */
export function useElectron() {
  const [electronAPI, setElectronAPI] = useState<ElectronAPI | null>(null);
  const [isElectronEnv, setIsElectronEnv] = useState(false);

  useEffect(() => {
    const isElectronEnvironment = isElectron();
    setIsElectronEnv(isElectronEnvironment);

    if (isElectronEnvironment) {
      setElectronAPI(getElectronAPI());
    }
  }, []);

  return {
    electronAPI,
    isElectronEnv,
  };
}

/**
 * Electron 이벤트를 구독하는 React Hook
 * 
 * @example
 * ```tsx
 * useElectronEvent('folder-selected', (folderPath: string) => {
 *   console.log('Selected folder:', folderPath);
 * });
 * ```
 */
export function useElectronEvent(
  channel: string,
  callback: (...args: unknown[]) => void
) {
  const { electronAPI, isElectronEnv } = useElectron();

  useEffect(() => {
    if (isElectronEnv && electronAPI) {
      electronAPI.on(channel, callback);

      return () => {
        electronAPI.off(channel, callback);
      };
    }
  }, [channel, callback, electronAPI, isElectronEnv]);
}

/**
 * 파일 선택을 위한 React Hook
 * 
 * @example
 * ```tsx
 * const { selectFolder, isSelecting, error } = useFileSelector();
 * 
 * const handleSelectFolder = async () => {
 *   const result = await selectFolder();
 *   if (result) {
 *     console.log('Selected:', result);
 *   }
 * };
 * ```
 */
export function useFileSelector() {
  const { electronAPI, isElectronEnv } = useElectron();
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFolder = async (): Promise<string | null> => {
    if (!isElectronEnv || !electronAPI) {
      // 브라우저 환경: File System Access API 사용 (폴백)
      try {
        // File System Access API 타입 가드
        if (
          'showDirectoryPicker' in window &&
          typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
        ) {
          const picker = (window as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker;
          const dirHandle = await picker();
          return dirHandle.name;
        }
        setError(i18n.t('common:errors.electron.directoryPickerNotSupported'));
        return null;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : i18n.t('common:errors.electron.folderSelectionFailed'));
        return null;
      }
    }

    // Electron 환경: 네이티브 다이얼로그 사용
    setIsSelecting(true);
    setError(null);

    try {
      const result = await electronAPI.selectFolder();
      if (result.success && !result.canceled) {
        return result.data || null;
      }
      return null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t('common:errors.electron.folderSelectionFailed'));
      return null;
    } finally {
      setIsSelecting(false);
    }
  };

  return {
    selectFolder,
    isSelecting,
    error,
    isElectronEnv,
  };
}

/**
 * 파일 읽기/쓰기를 위한 React Hook
 * 
 * @example
 * ```tsx
 * const { readFile, writeFile, isLoading, error } = useFileSystem();
 * 
 * const content = await readFile('/path/to/file');
 * await writeFile('/path/to/file', 'new content');
 * ```
 */
export function useFileSystem() {
  const { electronAPI, isElectronEnv } = useElectron();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (path: string): Promise<string | null> => {
    if (!isElectronEnv || !electronAPI) {
      setError(i18n.t('common:errors.electron.fileSystemNotAvailable'));
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await electronAPI.readFile(path);
      if (result.success) {
        return result.data || null;
      } else {
        setError(result.error || i18n.t('common:errors.electron.readFileFailed'));
        return null;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t('common:errors.electron.readFileFailed'));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const writeFile = async (path: string, content: string): Promise<boolean> => {
    if (!isElectronEnv || !electronAPI) {
      setError(i18n.t('common:errors.electron.fileSystemNotAvailable'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await electronAPI.writeFile(path, content);
      if (result.success) {
        return true;
      } else {
        setError(result.error || i18n.t('common:errors.electron.writeFileFailed'));
        return false;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : i18n.t('common:errors.electron.writeFileFailed'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    readFile,
    writeFile,
    isLoading,
    error,
    isElectronEnv,
  };
}
