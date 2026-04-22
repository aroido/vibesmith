/**
 * Component Edit E2E Tests
 * Spec Appendix B.3: 상세→편집 이동, 데이터 로드, 편집→저장, 상세 복귀, 에러 처리 (404, 400, 500)
 */

import { test, expect } from '@playwright/test';

test.describe('Component Edit E2E', () => {
  test('should navigate from detail page to edit page', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Edit' }).click();

    await expect(page).toHaveURL(/\/components\/[^/]+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Component' })).toBeVisible();
  });

  test('should load existing data and fill form', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();

    await page.waitForLoadState('networkidle');

    const nameInput = page.getByLabel(/Name/i);
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toHaveValue('');

    const backLink = page.getByRole('link', { name: /Back to Detail/i });
    await expect(backLink).toBeVisible();
  });

  test('should edit metadata and save', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();

    await page.waitForLoadState('networkidle');

    const descInput = page.getByLabel(/Description/i);
    await descInput.fill('E2E 수정된 설명');

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(/\/components\/[^/]+$/);
    await expect(page.getByText('저장되었습니다')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to detail after save', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(/\/components\/[^/]+$/);
    await expect(page).not.toHaveURL(/\/edit$/);
  });

  test('should show Back to Detail link', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();

    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();

    await page.waitForLoadState('networkidle');

    const backLink = page.getByRole('link', { name: /Back to Detail/i });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await expect(page).toHaveURL(/\/components\/[^/]+$/);
  });
});

test.describe('Component Edit E2E - Error Handling', () => {
  test('should show 404 when component not found', async ({ page }) => {
    await page.goto('/components/nonexistent-id-999/edit');

    await page.waitForLoadState('networkidle');

    await expect
      .poll(
        async () => {
          const text = await page.textContent('body');
          return text?.includes('찾을 수 없습니다') ?? false;
        },
        { timeout: 10000 }
      )
      .toBe(true);

    const listLink = page.getByRole('link', { name: /목록으로 돌아가기/i });
    await expect(listLink).toBeVisible({ timeout: 5000 });
  });

  test('should show error message on 400 (bad request)', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.waitForLoadState('networkidle');

    await page.route('**/api/components/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: '잘못된 요청입니다' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect
      .poll(
        async () => {
          const alert = page.getByRole('alert');
          const count = await alert.count();
          if (count === 0) return false;
          const text = await alert.first().textContent();
          return /잘못된 요청|bad request|error/i.test(text ?? '');
        },
        { timeout: 8000 }
      )
      .toBe(true);
  });

  test('should show error message on 500 (server error)', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstItem = page.getByRole('link', { name: /comp_|skill|agent|command/i }).first();
    await firstItem.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.waitForLoadState('networkidle');

    await page.route('**/api/components/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal Server Error' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect
      .poll(
        async () => {
          const alert = page.getByRole('alert');
          const count = await alert.count();
          if (count === 0) return false;
          const text = await alert.first().textContent();
          return /일시적인 오류|server error|500/i.test(text ?? '');
        },
        { timeout: 8000 }
      )
      .toBe(true);
  });
});
