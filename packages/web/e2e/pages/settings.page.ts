/**
 * Settings Page Object
 * Settings 페이지 Page Object
 */

import { Page, Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly languageSelector: Locator;
  readonly rescanButton: Locator;
  readonly systemStatus: Locator;
  readonly themeRadios: Locator;
  readonly fontSizeSelector: Locator;
  readonly layoutSelector: Locator;
  readonly notificationToggle: Locator;
  readonly tourTriggerButton: Locator;
  readonly workspacePathInput: Locator;
  readonly addPathButton: Locator;
  readonly crashReportingCheckbox: Locator;
  readonly performanceMonitoringCheckbox: Locator;
  readonly usageAnalyticsCheckbox: Locator;
  readonly exportDiagnosticBundleButton: Locator;
  readonly checkForUpdatesButton: Locator;
  readonly downloadNowButton: Locator;
  readonly restartNowButton: Locator;
  readonly releaseNotesDialog: Locator;
  readonly mainContent: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainContent = page.locator('#main-content');
    this.pageTitle = page.getByRole('heading', { name: /언어|Language/i, level: 2 });
    this.languageSelector = page.getByRole('combobox', { name: '언어 선택' });
    this.rescanButton = page.getByRole('button', {
      name: /동기화 실행|Rescan filesystem projects/i,
    });
    this.systemStatus = page.getByRole('region', {
      name: /운영 요약|Operations summary/i,
    });
    this.themeRadios = page.getByRole('radio');
    this.fontSizeSelector = page.getByRole('combobox', { name: '폰트 크기' });
    this.layoutSelector = page.getByRole('combobox', { name: '레이아웃' });
    this.notificationToggle = page.getByRole('checkbox', { name: '알림 활성화' });
    this.tourTriggerButton = page.getByRole('button', {
      name: /가이드 투어 다시 보기|Restart tour|View tour again/i,
    });
    this.workspacePathInput = page.getByRole('textbox', {
      name: /워크스페이스 경로|Workspace path/i,
    });
    this.addPathButton = page.getByRole('button', {
      name: /경로 추가|Add path/i,
    });
    this.crashReportingCheckbox = page.getByRole('checkbox', {
      name: /문제 리포트|Crash reports/i,
    });
    this.performanceMonitoringCheckbox = page.getByRole('checkbox', {
      name: /성능 진단 데이터|Performance diagnostics/i,
    });
    this.usageAnalyticsCheckbox = page.getByRole('checkbox', {
      name: /사용 통계|Usage analytics/i,
    });
    this.exportDiagnosticBundleButton = this.mainContent.getByRole('button', {
      name: /진단 번들 내보내기|Export Diagnostic Bundle/i,
    });
    this.checkForUpdatesButton = this.mainContent.getByRole('button', {
      name: /업데이트 확인|Check for updates/i,
    });
    this.downloadNowButton = this.mainContent.getByRole('button', {
      name: /지금 다운로드|Download now/i,
    });
    this.restartNowButton = this.mainContent.getByRole('button', {
      name: /지금 재시작|Restart now/i,
    });
    this.releaseNotesDialog = page.getByRole('dialog');
  }

  async goto() {
    await this.page.goto('/settings');
    await this.pageTitle.waitFor();
  }

  async changeLanguage(language: 'ko' | 'en') {
    await this.languageSelector.selectOption({ value: language });
  }

  async selectTheme(theme: '라이트' | '다크' | '시스템') {
    await this.page.getByRole('radio', { name: theme }).check();
  }

  async changeFontSize(size: '작게' | '보통' | '크게') {
    await this.fontSizeSelector.selectOption({ label: size });
  }

  async changeLayout(layout: '컴팩트' | '일반') {
    await this.fontSizeSelector.selectOption({ label: layout });
  }

  async toggleNotifications() {
    await this.notificationToggle.click();
  }

  async clickRescan() {
    await this.rescanButton.click();
  }

  async clickTourTrigger() {
    await this.tourTriggerButton.click();
  }

  async addWorkspacePath(path: string) {
    await this.workspacePathInput.fill(path);
    await this.addPathButton.click();
  }

  async isSystemLive(): Promise<boolean> {
    const text = await this.systemStatus.textContent();
    return text?.includes('실시간') || text?.includes('Live') || false;
  }
}
