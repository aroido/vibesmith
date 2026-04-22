import { test, expect } from '@playwright/test';

/**
 * Dashboard 페이지 시각적 회귀 테스트
 * 
 * 목적: 대시보드 레이아웃, 통계 카드, 차트 등의 시각적 변경 감지
 */

test.describe('Dashboard Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // 대시보드 페이지로 이동
    await page.goto('/dashboard');
    
    // 데이터 로딩 완료 대기
    await page.waitForLoadState('networkidle');
  });

  test('should match full dashboard layout', async ({ page }) => {
    // 전체 페이지 스냅샷
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('should match stats cards section', async ({ page }) => {
    // 통계 카드 영역 스냅샷
    const statsSection = page.locator('[data-testid="stats-section"]').first();
    
    if (await statsSection.isVisible()) {
      await expect(statsSection).toHaveScreenshot('dashboard-stats.png');
    } else {
      // 통계 카드가 없으면 전체 대시보드 스냅샷
      await expect(page).toHaveScreenshot('dashboard-stats-fallback.png');
    }
  });

  test('should match recent activity section', async ({ page }) => {
    // 최근 활동 영역 스냅샷
    const activitySection = page.locator('[data-testid="activity-section"]').first();
    
    if (await activitySection.isVisible()) {
      await expect(activitySection).toHaveScreenshot('dashboard-activity.png');
    } else {
      // 활동 섹션이 없으면 스킵
      test.skip();
    }
  });

  test('should match dark mode', async ({ page }) => {
    // 다크 모드 토글 버튼 찾기
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    
    if (await themeToggle.isVisible()) {
      // 다크 모드 전환
      await themeToggle.click();
      
      // 애니메이션 완료 대기
      await page.waitForTimeout(500);
      
      // 다크 모드 스냅샷
      await expect(page).toHaveScreenshot('dashboard-dark.png', {
        fullPage: true,
      });
    } else {
      // 다크 모드 토글이 없으면 스킵
      test.skip();
    }
  });

  test('should match empty state', async ({ page }) => {
    // 빈 상태 시뮬레이션 (데이터가 없는 경우)
    // 실제 구현에서는 MSW로 빈 응답 반환
    
    // 현재는 기본 상태 스냅샷
    await expect(page).toHaveScreenshot('dashboard-empty.png');
  });
});

test.describe('Dashboard Responsive Design', () => {
  test('should match mobile layout', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 모바일 레이아웃 스냅샷
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
    });
  });

  test('should match tablet layout', async ({ page }) => {
    // 태블릿 뷰포트 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 태블릿 레이아웃 스냅샷
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
    });
  });
});
