/**
 * Dashboard E2E Tests
 * v1.13.0 - Dashboard 페이지 테스트
 */

import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Dashboard', () => {
  test('should display dashboard page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // 페이지 제목 확인
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('should display project list or empty state', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // 로딩 완료 대기 (로딩 인디케이터가 사라질 때까지)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // 추가 렌더링 대기

    // 프로젝트 목록 또는 빈 상태 확인
    const hasProjectList = await dashboardPage.projectList.isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/VibeSmith에 오신 것을 환영합니다|Try VibeSmith|Add Your Project/i).isVisible().catch(() => false);
    
    // 둘 중 하나는 표시되어야 함
    expect(hasProjectList || hasEmptyState).toBeTruthy();
  });

  test('should display stats cards or empty state', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    // 로딩 완료 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 통계 카드 또는 빈 상태 확인
    const hasStats = await dashboardPage.isStatsVisible();
    const hasEmptyState = await page.getByText(/VibeSmith에 오신 것을 환영합니다|Try VibeSmith|Add Your Project/i).isVisible().catch(() => false);
    
    // 둘 중 하나는 표시되어야 함
    expect(hasStats || hasEmptyState).toBeTruthy();
  });
});
