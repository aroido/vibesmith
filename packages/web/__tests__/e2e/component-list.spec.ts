/**
 * Component List E2E Tests
 * Dashboard → Component List navigation, type filter behavior
 */

import { test, expect } from '@playwright/test';

test.describe('Component List E2E', () => {
  test('should navigate from dashboard to component list', async ({ page }) => {
    await page.goto('/');

    // Dashboard에서 Components 링크 클릭
    await page.getByRole('link', { name: 'Components' }).click();

    await expect(page).toHaveURL('/components');
    await expect(page.getByRole('heading', { name: 'Component List' })).toBeVisible();
  });

  test('should display component list page with type tabs', async ({ page }) => {
    await page.goto('/components');

    // 타입 탭 표시 확인
    await expect(page.getByRole('tablist', { name: '구성요소 타입 필터' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /All 필터/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills 필터/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Agents 필터/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Commands 필터/i })).toBeVisible();
  });

  test('should filter by type when tab clicked', async ({ page }) => {
    await page.goto('/components');

    // 로딩 완료 대기 (목록 또는 빈 상태)
    await page.waitForLoadState('networkidle');

    // Skills 탭 클릭
    await page.getByRole('tab', { name: /Skills 필터/i }).click();

    // 탭이 선택됨 확인
    await expect(page.getByRole('tab', { name: /Skills 필터/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Commands 탭 클릭
    await page.getByRole('tab', { name: /Commands 필터/i }).click();
    await expect(page.getByRole('tab', { name: /Commands 필터/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('should navigate back to dashboard from component list', async ({ page }) => {
    await page.goto('/components');

    await page.getByRole('link', { name: 'Dashboard' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /VibeSmith/i })).toBeVisible();
  });

  test('should have proper document structure', async ({ page }) => {
    await page.goto('/components');

    const main = page.locator('main');
    await expect(main).toBeVisible();

    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Component List');
  });

  test('should display status filter and filter by status', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    // Status 필터 표시 확인
    await expect(page.getByLabel('활성화 상태 필터')).toBeVisible();

    // 비활성화 상태로 필터
    await page.getByLabel('활성화 상태 필터').selectOption('disabled');

    // URL에 status=disabled 반영
    await expect(page).toHaveURL(/status=disabled/);
  });
});
