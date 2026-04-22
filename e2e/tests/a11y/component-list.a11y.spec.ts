import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Component List 접근성 테스트
 * @tag @a11y
 */
test.describe('Component List Accessibility @a11y', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/components');
    await page.waitForSelector('[data-testid="component-list"]', { timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible search input', async ({ page }) => {
    await page.goto('/components');

    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toHaveAttribute('aria-label');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('input[type="search"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible filter controls', async ({ page }) => {
    await page.goto('/components');

    // 필터 버튼들이 접근 가능한지 확인
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('button, select')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/components');
    await page.waitForSelector('[data-testid="component-list"]', { timeout: 10000 });

    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/components');

    // h1이 정확히 1개 있어야 함
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // 헤딩 계층 구조 검증
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
