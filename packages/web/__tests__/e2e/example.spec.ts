import { test, expect } from '@playwright/test';

test.describe('Example E2E Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // 페이지 타이틀 확인
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');
    
    // 네비게이션 테스트 예시
    // await page.click('text=Dashboard');
    // await expect(page).toHaveURL('/dashboard');
  });
});
