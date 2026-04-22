import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Settings 접근성 테스트
 * @tag @a11y
 */
test.describe('Settings Accessibility @a11y', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible form controls', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // 모든 폼 컨트롤이 레이블을 가져야 함
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label', 'aria-input-field-name'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/settings');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
