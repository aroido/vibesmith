/**
 * System Tray Module
 * 
 * macOS 메뉴바 및 시스템 트레이 통합:
 * - 트레이 아이콘
 * - 컨텍스트 메뉴
 * - 윈도우 보이기/숨기기
 * - 빠른 액세스 메뉴
 */

import { app, Tray, Menu, BrowserWindow, nativeImage, type NativeImage } from 'electron';
import { logger } from './logger';
import { resolveResourcePath } from './resource-path';

let tray: Tray | null = null;
const MACOS_TRAY_ICON_SIZE = 18;

function normalizeTrayIcon(icon: NativeImage, options?: { template?: boolean }): NativeImage {
  const normalized = process.platform === 'darwin'
    ? icon.resize({ width: MACOS_TRAY_ICON_SIZE, height: MACOS_TRAY_ICON_SIZE })
    : icon;

  if (process.platform === 'darwin' && options?.template) {
    normalized.setTemplateImage(true);
  }

  return normalized;
}

function createMacTemplateFallbackIcon(): NativeImage {
  // Keep a compact monochrome silhouette so it renders correctly in macOS menu bar.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="2.25" y="2.25" width="13.5" height="13.5" rx="2.6" fill="#000" opacity="0.92"/>
      <rect x="4.9" y="4.6" width="8.2" height="2.15" rx="0.95" fill="#000" opacity="0.55"/>
      <circle cx="6.0" cy="9.2" r="1.15" fill="#000"/>
      <circle cx="9.0" cy="9.2" r="1.15" fill="#000"/>
      <circle cx="12.0" cy="9.2" r="1.15" fill="#000"/>
      <circle cx="6.0" cy="12.0" r="1.15" fill="#000"/>
      <circle cx="9.0" cy="12.0" r="1.15" fill="#000"/>
      <circle cx="12.0" cy="12.0" r="1.15" fill="#000"/>
    </svg>
  `;

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  return normalizeTrayIcon(nativeImage.createFromDataURL(dataUrl), { template: true });
}

/**
 * 트레이 아이콘 생성
 */
export function createTray(mainWindow: BrowserWindow | null): Tray {
  logger.info('[Tray] Creating system tray...');

  const templateResource = resolveResourcePath('tray-icon-Template.png');
  const fallbackResource = resolveResourcePath('icon.png');

  const isMac = process.platform === 'darwin';

  // macOS는 템플릿 아이콘 우선 사용. 템플릿 누락 시 코드 기반 템플릿 아이콘을 생성한다.
  // Windows/Linux는 icon.png 폴백을 허용한다.
  let icon = nativeImage.createEmpty();
  let selectedResourceName = 'empty';
  let selectedResourcePath: string | null = null;

  const candidates = isMac
    ? [{ name: 'tray-icon-template', resource: templateResource, template: true }]
    : [
        { name: 'tray-icon-template', resource: templateResource, template: false },
        { name: 'icon-png-fallback', resource: fallbackResource, template: false },
      ];

  for (const candidate of candidates) {
    if (candidate.resource.source !== 'resolved') {
      continue;
    }

    try {
      const loaded = nativeImage.createFromPath(candidate.resource.path);
      if (!loaded.isEmpty()) {
        icon = normalizeTrayIcon(loaded, { template: candidate.template });
        selectedResourceName = candidate.name;
        selectedResourcePath = candidate.resource.path;
        break;
      }
    } catch {
      // 다음 후보 경로로 계속 탐색
    }
  }

  if (icon.isEmpty() && isMac) {
    icon = createMacTemplateFallbackIcon();
    selectedResourceName = 'generated-template-fallback';
  }

  logger.logEvent(
    'tray.icon.resolved',
    {
      selected_name: selectedResourceName,
      selected_path: selectedResourcePath,
      template_source: templateResource.source,
      template_checked_paths: templateResource.checkedPaths,
      fallback_source: fallbackResource.source,
      fallback_checked_paths: fallbackResource.checkedPaths,
    },
    selectedResourcePath ? 'debug' : 'warn',
    { process: 'main' }
  );

  tray = new Tray(icon);
  tray.setToolTip('VibeSmith');

  // 트레이 메뉴 생성
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
          logger.debug('[Tray] Window shown');
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'New Component',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('menu-new-component');
          logger.debug('[Tray] New component triggered');
        }
      },
    },
    {
      label: 'Settings',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('shortcut-open-settings');
          logger.debug('[Tray] Settings triggered');
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Check for Updates...',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('menu-check-updates');
          logger.debug('[Tray] Check updates triggered');
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        logger.info('[Tray] Quit triggered from tray');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 트레이 아이콘 클릭 시 (Windows/Linux) 윈도우 표시/숨기기
  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
  }

  logger.info('[Tray] System tray created');
  return tray;
}

/**
 * 트레이 아이콘 업데이트
 */
export function updateTrayTitle(title: string): void {
  if (tray && process.platform === 'darwin') {
    tray.setTitle(title);
  }
}

/**
 * 트레이 제거
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    logger.info('[Tray] System tray destroyed');
  }
}

/**
 * 트레이 메뉴 업데이트 (동적 메뉴)
 */
export function updateTrayMenu(mainWindow: BrowserWindow | null, customItems?: Electron.MenuItemConstructorOptions[]): void {
  if (!tray) return;

  const defaultItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      type: 'separator',
    },
  ];

  const menuItems = customItems
    ? [...defaultItems, ...customItems]
    : Menu.buildFromTemplate(defaultItems).items.map(item => item);

  const contextMenu = Menu.buildFromTemplate([
    ...menuItems,
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export { tray };
