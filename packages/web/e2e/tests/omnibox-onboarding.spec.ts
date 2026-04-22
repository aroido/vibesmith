import { test, expect } from '@playwright/test';

test.describe('Omnibox and Onboarding regressions', () => {
  test('navigates to projects from Omnibox quick action', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('dashboard-search-button').click();
    await expect(page.locator('.omnibox-overlay')).toBeVisible();

    await page.getByRole('option', { name: /프로젝트 보기|View Projects/i }).click();
    await expect(page).toHaveURL('/projects');
  });

  test('restarts onboarding tour from settings', async ({ page }) => {
    await page.goto('/settings');

    await page
      .getByRole('button', { name: /가이드 투어 다시 보기|Restart guide tour/i })
      .click();

    await expect(page).toHaveURL('/');
    await expect(page.locator('.driver-popover')).toBeVisible();

    await page.getByRole('button', { name: /close/i }).click();
    await expect(page.locator('.driver-popover')).toHaveCount(0);
  });
});
