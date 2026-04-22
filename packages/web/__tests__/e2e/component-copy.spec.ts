/**
 * Component Copy E2E Tests
 * Spec: component-copy-api.md §9 Acceptance Criteria
 * 시나리오: Component Detail → 복사 버튼 → 프로젝트 선택 → 복사 → 성공 메시지
 */

import { test, expect } from '@playwright/test';

test.describe('Component Copy E2E', () => {
  test('should open copy modal when copy button clicked', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href^="/components/comp_"]').first();
    await firstLink.click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '다른 프로젝트로 복사' }).click();

    await expect(
      page.getByRole('dialog', { name: /다른 프로젝트로 복사/i })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('대상 프로젝트 선택')).toBeVisible();
  });

  test('should copy component and show success toast', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href^="/components/comp_"]').first();
    await firstLink.click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '다른 프로젝트로 복사' }).click();

    await expect(
      page.getByRole('dialog', { name: /다른 프로젝트로 복사/i })
    ).toBeVisible({ timeout: 5000 });

    const projectSelect = page.getByLabel('대상 프로젝트 선택');
    await projectSelect.selectOption({ index: 1 });

    await page.getByRole('button', { name: '복사' }).click();

    await expect(
      page.getByText('구성요소가 복사되었습니다')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should close modal when cancel clicked', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href^="/components/comp_"]').first();
    await firstLink.click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '다른 프로젝트로 복사' }).click();

    await expect(
      page.getByRole('dialog', { name: /다른 프로젝트로 복사/i })
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '취소' }).click();

    await expect(
      page.getByRole('dialog', { name: /다른 프로젝트로 복사/i })
    ).not.toBeVisible();
  });
});
