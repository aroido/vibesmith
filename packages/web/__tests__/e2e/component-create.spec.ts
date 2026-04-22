/**
 * Component Create E2E Tests
 * Spec Appendix B.3: 전체 플로우, 타입 선택→템플릿, 프로젝트 선택, 생성, 상세 이동, 중복 이름 에러
 */

import { test, expect } from '@playwright/test';

test.describe('Component Create E2E', () => {
  test('should navigate from list to create page', async ({ page }) => {
    await page.goto('/components');

    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Create Component' }).click();

    await expect(page).toHaveURL('/components/create');
    await expect(
      page.getByRole('heading', { name: 'Create Component' })
    ).toBeVisible();
  });

  test('should display create form with type selector', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    expect(
      page.getByRole('radiogroup', { name: '구성요소 타입' })
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: /Skill/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Agent/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Command/i })).toBeVisible();
  });

  test('should load template when type changes', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    const contentArea = page.getByLabel(/Content/i);
    const initialContent = await contentArea.inputValue();

    await page.getByRole('radio', { name: /Agent/i }).click();

    await expect
      .poll(async () => {
        const newContent = await contentArea.inputValue();
        return newContent !== initialContent && newContent.includes('specialized agent');
      })
      .toBe(true);
  });

  test('should allow project selection', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    const projectSelect = page.getByLabel('프로젝트 선택');
    await expect(projectSelect).toBeVisible();
    await expect(projectSelect).toBeEnabled();

    await projectSelect.selectOption({ index: 1 });
    await expect(projectSelect).toHaveValue(/.+/);
  });

  test('should create component and navigate to detail', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    const uniqueName = `e2e-skill-${Date.now()}`;

    await page.getByLabel(/Name/i).fill(uniqueName);
    await page.getByLabel('프로젝트 선택').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create Component' }).click();

    await expect(page).toHaveURL(/\/components\/comp_/);
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });
  });

  test('should show toast on success', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    const uniqueName = `e2e-toast-${Date.now()}`;

    await page.getByLabel(/Name/i).fill(uniqueName);
    await page.getByLabel('프로젝트 선택').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Create Component' }).click();

    await expect(page.getByText('생성되었습니다')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for duplicate name', async ({ page }) => {
    const duplicateName = `e2e-dup-${Date.now()}`;

    await page.goto('/components/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('프로젝트 선택').selectOption({ index: 1 });
    await page.getByLabel(/Name/i).fill(duplicateName);
    await page.getByRole('button', { name: 'Create Component' }).click();

    await expect(page).toHaveURL(/\/components\/comp_/, { timeout: 10000 });

    await page.goto('/components/create');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('프로젝트 선택').selectOption({ index: 1 });
    await page.getByLabel(/Name/i).fill(duplicateName);
    await page.getByRole('button', { name: 'Create Component' }).click();

    await expect
      .poll(
        async () => {
          const alert = page.getByRole('alert');
          const count = await alert.count();
          if (count === 0) return false;
          const text = await alert.first().textContent();
          return /이미 존재|already exists|duplicate/i.test(text ?? '');
        },
        { timeout: 10000 }
      )
      .toBe(true);
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/components/create');

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Component' }).click();

    await expect(page.getByRole('alert')).toContainText(/이름을 입력해주세요/);
  });

  test('should have Back to Components link', async ({ page }) => {
    await page.goto('/components/create');

    const backLink = page.getByRole('link', { name: /Back to Components/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/components');

    await backLink.click();
    await expect(page).toHaveURL('/components');
  });
});
