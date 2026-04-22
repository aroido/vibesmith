import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Dependency Graph 접근성 테스트
 * @tag @a11y
 */
test.describe('Dependency Graph Accessibility @a11y', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/dependencies');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible graph controls', async ({ page }) => {
    await page.goto('/dependencies');
    await page.waitForLoadState('networkidle');

    // 그래프 컨트롤 버튼들이 접근 가능해야 함
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/dependencies');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
