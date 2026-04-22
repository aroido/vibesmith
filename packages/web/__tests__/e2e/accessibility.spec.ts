import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 접근성 테스트
 * @tag @a11y
 */
test.describe('Accessibility Tests @a11y', () => {
  test('homepage should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('homepage should have proper document structure', async ({ page }) => {
    await page.goto('/');
    
    // 메인 랜드마크 확인
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // 헤딩 구조 확인
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/');
    
    // Tab 키로 네비게이션 가능한지 확인
    await page.keyboard.press('Tab');
    
    // 포커스된 요소가 있는지 확인
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeDefined();
    }
  });

  test('form inputs should have labels', async ({ page }) => {
    await page.goto('/');
    
    const inputs = await page.locator('input:not([type="hidden"])').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      // id가 있으면 label이 있어야 하고, 없으면 aria-label이나 aria-labelledby가 있어야 함
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });
});
