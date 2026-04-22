/**
 * ElectronIpcBridge
 * Desktop 앱 메뉴·단축키 IPC 채널을 React 라우팅/모달과 연결
 * Browser에서는 no-op
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DesktopApiBridge } from '@/types/electron.d';

const DESKTOP_OPEN_GLOBAL_SEARCH = 'electron:open-global-search';

/** Desktop에서 전역 검색 모달 열기 요청 시 dispatch */
function dispatchOpenGlobalSearch(): void {
  window.dispatchEvent(new CustomEvent(DESKTOP_OPEN_GLOBAL_SEARCH));
}

/**
 * Electron 메뉴/단축키 IPC를 React와 연결
 * Router 내부에서 렌더링해야 useNavigate 사용 가능
 */
export function ElectronIpcBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const desktopApi: DesktopApiBridge | undefined =
      typeof window !== 'undefined' ? window.api : undefined;
    const menuShortcut = desktopApi?.menuShortcut;
    if (!menuShortcut) return;

    const checkForUpdates =
      desktopApi.checkForUpdates ?? desktopApi.updater?.checkForUpdates;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      menuShortcut.onMenuCheckUpdates(() => {
        void checkForUpdates?.();
      })
    );

    unsubs.push(
      menuShortcut.onMenuNewComponent(() => {
        void navigate('/components/create');
      })
    );

    unsubs.push(
      menuShortcut.onShortcutNewComponent(() => {
        void navigate('/components/create');
      })
    );

    unsubs.push(
      menuShortcut.onShortcutOpenSettings(() => {
        void navigate('/settings');
      })
    );

    unsubs.push(
      menuShortcut.onShortcutSearch(() => {
        dispatchOpenGlobalSearch();
      })
    );

    unsubs.push(
      menuShortcut.onShortcutCommandPalette(() => {
        dispatchOpenGlobalSearch();
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [navigate]);

  return null;
}
