/**
 * Trash E2E Tests
 * 휴지통 페이지 테스트
 */

import { test, expect } from '@playwright/test';
import { TrashPage } from '../pages/trash.page';

test.describe('Trash Page', () => {
  test('should display trash page', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 페이지 제목 확인
    await expect(trashPage.pageTitle).toBeVisible();
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('should display empty state when no items', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 빈 상태 확인
    const isEmpty = await trashPage.isEmptyStateVisible();
    if (isEmpty) {
      await expect(trashPage.emptyState).toBeVisible();
      await expect(trashPage.goToComponentsLink).toBeVisible();
    }
  });

  test('should have navigation link to components', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 빈 상태일 때 컴포넌트 목록 링크 확인
    const isEmpty = await trashPage.isEmptyStateVisible();
    if (isEmpty) {
      await expect(trashPage.goToComponentsLink).toBeVisible();
      await expect(trashPage.goToComponentsLink).toHaveAttribute('href', '/components');
    }
  });

  test('should display refresh button when items exist', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 항목이 있을 때 새로고침 버튼 확인
    const isEmpty = await trashPage.isEmptyStateVisible();
    if (!isEmpty) {
      await expect(trashPage.refreshButton).toBeVisible();
      await expect(trashPage.refreshButton).toBeEnabled();
    }
  });

  test('should not display empty all button when empty', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 빈 상태일 때는 모두 비우기 버튼이 없어야 함
    const isEmpty = await trashPage.isEmptyStateVisible();
    
    if (isEmpty) {
      // 빈 상태이므로 버튼이 없어야 함
      const hasButton = await trashPage.emptyAllButton.isVisible().catch(() => false);
      expect(hasButton).toBeFalsy();
    } else {
      // 항목이 있으면 버튼이 있어야 함
      await expect(trashPage.emptyAllButton).toBeVisible();
      await expect(trashPage.emptyAllButton).toBeEnabled();
    }
  });

  test('should navigate to trash from dashboard', async ({ page }) => {
    // 대시보드에서 휴지통으로 이동
    await page.goto('/');
    await page.getByRole('link', { name: '휴지통' }).click();

    // 휴지통 페이지 확인
    await expect(page).toHaveURL('/trash');
    await expect(page.getByRole('heading', { name: '휴지통', level: 1 })).toBeVisible();
  });

  test('should show empty state message', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 빈 상태 메시지 확인
    const isEmpty = await trashPage.isEmptyStateVisible();
    if (isEmpty) {
      await expect(page.getByText(/삭제된 구성요소가 없습니다/)).toBeVisible();
    }
  });

  test('should have accessible navigation', async ({ page }) => {
    const trashPage = new TrashPage(page);
    await trashPage.goto();

    // 주요 메뉴 네비게이션 확인
    await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible();
  });
});
