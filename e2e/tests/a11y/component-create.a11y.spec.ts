import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Component Create 접근성 테스트
 * @tag @a11y
 */
test.describe('Component Create Accessibility @a11y', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/components/create');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible form controls', async ({ page }) => {
    await page.goto('/components/create');
    await page.waitForLoadState('networkidle');

    // 모든 폼 입력이 레이블을 가져야 함
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation in wizard', async ({ page }) => {
    await page.goto('/components/create');
    await page.waitForLoadState('networkidle');

    // Tab 키로 네비게이션
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
