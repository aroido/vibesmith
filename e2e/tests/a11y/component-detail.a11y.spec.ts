import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Component Detail 접근성 테스트
 * @tag @a11y
 */
test.describe('Component Detail Accessibility @a11y', () => {
  test('should not have accessibility violations', async ({ page }) => {
    // Mock 데이터가 있는 컴포넌트로 이동
    await page.goto('/components');
    await page.waitForSelector('[data-testid="component-list"]', { timeout: 10000 });

    // 첫 번째 컴포넌트 클릭
    const firstComponent = page.locator('[data-testid="component-list"] a').first();
    if (await firstComponent.count() > 0) {
      await firstComponent.click();
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should have accessible action buttons', async ({ page }) => {
    await page.goto('/components');
    await page.waitForSelector('[data-testid="component-list"]', { timeout: 10000 });

    const firstComponent = page.locator('[data-testid="component-list"] a').first();
    if (await firstComponent.count() > 0) {
      await firstComponent.click();
      await page.waitForLoadState('networkidle');

      // 모든 버튼이 접근 가능한 이름을 가져야 함
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['button-name'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/components');
    await page.waitForSelector('[data-testid="component-list"]', { timeout: 10000 });

    const firstComponent = page.locator('[data-testid="component-list"] a').first();
    if (await firstComponent.count() > 0) {
      await firstComponent.click();
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['aria-allowed-attr', 'aria-required-attr', 'aria-valid-attr-value'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
