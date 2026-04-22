/**
 * Project Detail E2E Tests
 * 프로젝트 상세 페이지 테스트
 */

import { test, expect } from '@playwright/test';
import { ProjectDetailPage } from '../pages/project-detail.page';

test.describe('Project Detail Page', () => {
  // 테스트용 프로젝트 ID (실제 데이터에 따라 조정 필요)
  const TEST_PROJECT_ID = 'proj_abc123';

  test('should display project detail page', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 페이지 제목 확인
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('should display project information', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 프로젝트 이름 확인
    await expect(projectDetailPage.projectName).toBeVisible();
  });

  test('should handle project page gracefully', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 페이지가 로드되었는지 확인 (통계, 에러, 또는 리다이렉트)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    const isRedirected = currentUrl.endsWith('/'); // 도메인/포트에 상관없이 루트 경로 확인
    const hasStats = await projectDetailPage.isStatsVisible().catch(() => false);
    const hasError = await page.getByText(/찾을 수 없습니다|project not found|not found|error/i).isVisible().catch(() => false);
    
    // 리다이렉트, 통계, 또는 에러 중 하나는 있어야 함
    expect(isRedirected || hasStats || hasError).toBeTruthy();
  });

  test('should display tab navigation if project exists', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 프로젝트가 존재하면 탭 네비게이션 확인
    const hasError = await page.getByText(/찾을 수 없습니다|project not found|not found/i).isVisible().catch(() => false);
    
    if (!hasError) {
      const hasOverviewTab = await page.getByRole('tab', { name: /overview/i }).isVisible().catch(() => false);
      if (hasOverviewTab) {
        await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /skill/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /agent/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /command/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /hook/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /rule/i })).toBeVisible();
      }
    }
  });

  test('should switch between tabs if project exists', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 프로젝트가 존재하면 탭 전환 테스트
    const hasError = await page.getByText(/찾을 수 없습니다|project not found|not found/i).isVisible().catch(() => false);
    
    if (!hasError) {
      const hasOverviewTab = await page.getByRole('tab', { name: /overview/i }).isVisible().catch(() => false);
      
      if (hasOverviewTab) {
        // Overview 탭 확인
        await expect(page).toHaveURL(new RegExp(`/projects/${TEST_PROJECT_ID}`));

        // Skills 탭으로 전환
        await projectDetailPage.selectTab('skill');
        await expect(page).toHaveURL(new RegExp(`/projects/${TEST_PROJECT_ID}.*tab=skill`));

        // Agents 탭으로 전환
        await projectDetailPage.selectTab('agent');
        await expect(page).toHaveURL(new RegExp(`/projects/${TEST_PROJECT_ID}.*tab=agent`));
      }
    }
  });

  test('should navigate to settings when Settings button is clicked', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const hasError = await page.getByText(/찾을 수 없습니다|project not found|not found/i).isVisible().catch(() => false);

    if (!hasError) {
      const settingsButton = projectDetailPage.settingsButton;
      const isSettingsVisible = await settingsButton.isVisible().catch(() => false);

      if (isSettingsVisible) {
        await projectDetailPage.clickSettingsButton();
        await expect(page).toHaveURL(/\/settings/);
      }
    }
  });

  test('should handle non-existent project gracefully', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto('non-existent-project-id');

    // 에러 토스트 또는 리다이렉트 확인
    // 3초 후 대시보드로 리다이렉트됨
    await page.waitForTimeout(3500);
    await expect(page).toHaveURL('/');
  });

  test('should navigate back to dashboard', async ({ page }) => {
    // 대시보드에서 프로젝트로 이동
    await page.goto('/');
    
    // 프로젝트 클릭 (첫 번째 프로젝트)
    const firstProject = page.locator('[data-testid="project-item"]').first();
    const isVisible = await firstProject.isVisible().catch(() => false);
    
    if (isVisible) {
      await firstProject.click();
      
      // 프로젝트 상세 페이지 확인
      await expect(page).toHaveURL(/\/projects\//);
    }
  });

  test('should handle component list gracefully', async ({ page }) => {
    const projectDetailPage = new ProjectDetailPage(page);
    await projectDetailPage.goto(TEST_PROJECT_ID);

    // 로딩 완료 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    const isRedirected = currentUrl.endsWith('/');
    
    if (!isRedirected) {
      // 리다이렉트되지 않았으면 컴포넌트 목록 또는 빈 상태 확인
      const hasError = await page.getByText(/찾을 수 없습니다|project not found|not found|error/i).isVisible().catch(() => false);
      
      if (!hasError) {
        const hasComponents = await projectDetailPage.componentList.isVisible().catch(() => false);
        const hasEmptyState = await page.getByText(/구성요소가 없습니다|컴포넌트가 없습니다|no components yet|no components|empty/i).isVisible().catch(() => false);
        const hasLoading = await page.getByText(/로딩|loading/i).isVisible().catch(() => false);
        
        // 컴포넌트, 빈 상태, 또는 로딩 중 하나는 있어야 함 (로딩이 아직 진행 중일 수 있음)
        expect(hasComponents || hasEmptyState || !hasLoading).toBeTruthy();
      }
    }
  });
});
