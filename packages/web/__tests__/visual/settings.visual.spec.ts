import { test, expect } from '@playwright/test';

/**
 * Settings 페이지 시각적 회귀 테스트
 * 
 * 목적: 설정 페이지 UI의 시각적 변경 감지
 */

test.describe('Settings Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should match full settings page', async ({ page }) => {
    await expect(page).toHaveScreenshot('settings-full.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match settings form', async ({ page }) => {
    const settingsForm = page.locator('[data-testid="settings-form"]').first();
    
    if (await settingsForm.isVisible()) {
      await expect(settingsForm).toHaveScreenshot('settings-form.png');
    }
  });

  test('should match theme toggle', async ({ page }) => {
    const themeSection = page.locator('[data-testid="theme-section"]').first();
    
    if (await themeSection.isVisible()) {
      await expect(themeSection).toHaveScreenshot('settings-theme.png');
    }
  });
});

test.describe('Settings Responsive', () => {
  test('should match mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('settings-mobile.png', {
      fullPage: true,
    });
  });
});
