/**
 * Settings E2E Tests
 * Settings 페이지 테스트
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../pages/settings.page';

test.describe('Settings Page', () => {
  test('should display settings page', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 페이지 제목 확인
    await expect(settingsPage.pageTitle).toBeVisible();
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('should display all settings sections', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 주요 설정 섹션 확인
    await expect(page.getByRole('heading', { name: '언어', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '코어 스캔 설정', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '디스플레이', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '알림', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '고급', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: '온보딩', level: 2 })).toBeVisible();
  });

  test('should display system status', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 시스템 상태 표시 확인
    await expect(settingsPage.systemStatus).toBeVisible();
  });

  test('should have language selector', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 언어 선택기 확인
    await expect(settingsPage.languageSelector).toBeVisible();
    await expect(settingsPage.languageSelector).toHaveValue('ko');
  });

  test('should have theme options', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 테마 옵션 확인
    await expect(page.getByRole('radio', { name: '라이트' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '다크' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '시스템' })).toBeVisible();
  });

  test('should have rescan button', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 재스캔 버튼 확인
    await expect(settingsPage.rescanButton).toBeVisible();
    await expect(settingsPage.rescanButton).toBeEnabled();
  });

  test('should have tour trigger button', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // 투어 트리거 버튼 확인
    await expect(settingsPage.tourTriggerButton).toBeVisible();
    await expect(settingsPage.tourTriggerButton).toBeEnabled();
  });

  test('should navigate to settings from dashboard', async ({ page }) => {
    // 대시보드에서 설정으로 이동
    await page.goto('/');
    await page.getByRole('link', { name: '설정' }).click();

    // 설정 페이지 확인
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: '설정', level: 1 })).toBeVisible();
  });
});
