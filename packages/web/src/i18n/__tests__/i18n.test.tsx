/**
 * i18n 테스트 (i18n.md spec §9)
 * - 초기화
 * - 언어 전환
 * - fallback
 * - localStorage 저장
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { getCurrentLocale, STORAGE_KEY } from '../index';

// 테스트용 컴포넌트
function TestComponent() {
  const { t, i18n } = useTranslation(['common', 'navigation']);
  return (
    <div>
      <span data-testid="common-loading">{t('common:loading')}</span>
      <span data-testid="nav-home">{t('navigation:primary.home')}</span>
      <span data-testid="lang">{i18n.language}</span>
    </div>
  );
}

describe('i18n', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ko');
  });

  it('should have default locale ko after reset', () => {
    expect(getCurrentLocale()).toBe('ko');
  });

  it('should render Korean translations by default', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('common-loading')).toHaveTextContent('로딩 중...');
    expect(screen.getByTestId('nav-home')).toHaveTextContent('홈');
    expect(screen.getByTestId('lang')).toHaveTextContent('ko');
  });

  it('should switch to English when changeLanguage is called', async () => {
    render(<TestComponent />);
    await i18n.changeLanguage('en');
    expect(screen.getByTestId('common-loading')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('nav-home')).toHaveTextContent('Home');
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('should persist locale to localStorage on language change', async () => {
    await i18n.changeLanguage('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');

    await i18n.changeLanguage('ko');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ko');
  });

  it('should fallback for missing keys', () => {
    const result = i18n.t('common:nonexistent.key', { defaultValue: 'fallback' });
    expect(result).toBe('fallback');
  });

  it('should support interpolation', () => {
    const result = i18n.t('dashboard:componentCreated', { id: 'abc123' });
    expect(result).toContain('abc123');
  });

  it('should translate dashboard keys in Korean', () => {
    expect(i18n.t('dashboard:newSkill')).toBe('새 스킬 기능 곧 출시!');
    expect(i18n.t('dashboard:matrixModeActivated')).toBe('매트릭스 모드 활성화');
    expect(i18n.t('dashboard:matrixModeDeactivated')).toBe('매트릭스 모드 비활성화');
    expect(i18n.t('dashboard:searchFeatureComingSoon')).toBe('검색 기능 곧 출시!');
  });

  it('should translate dashboard keys in English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('dashboard:searchFeatureComingSoon')).toBe('Search feature coming soon!');
    expect(i18n.t('dashboard:newSkill')).toBe('New Skill feature coming soon!');
  });

  it('should translate settings live/offline in Korean', () => {
    expect(i18n.t('settings:live')).toBe('실시간');
    expect(i18n.t('settings:offline')).toBe('오프라인');
  });

  describe('ko/en switch smoke (CI i18n regression)', () => {
    it('should render ko then en then ko without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('common:loading')).toBe('로딩 중...');
      expect(i18n.t('common:loading')).not.toMatch(/^common:|^loading$/);

      await i18n.changeLanguage('en');
      expect(i18n.t('common:loading')).toBe('Loading...');
      expect(i18n.t('common:loading')).not.toMatch(/^common:|^loading$/);

      await i18n.changeLanguage('ko');
      expect(i18n.t('common:loading')).toBe('로딩 중...');
    });

    it('should switch navigation labels ko↔en', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('navigation:primary.home')).toBe('홈');
      expect(i18n.t('navigation:primary.components')).toBe('컴포넌트');

      await i18n.changeLanguage('en');
      expect(i18n.t('navigation:primary.home')).toBe('Home');
      expect(i18n.t('navigation:primary.components')).toBe('Components');

      await i18n.changeLanguage('ko');
      expect(i18n.t('navigation:primary.settings')).toBe('설정');
      expect(i18n.t('navigation:legacy.dashboard')).toBe('대시보드');
    });

    it('should switch dashboard emptyState ko↔en', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('dashboard:emptyState.welcome')).toContain('VibeSmith');
      expect(i18n.t('dashboard:emptyState.welcome')).not.toMatch(/^dashboard:|emptyState/);

      await i18n.changeLanguage('en');
      expect(i18n.t('dashboard:emptyState.welcome')).toContain('VibeSmith');
      expect(i18n.t('dashboard:emptyState.welcome')).toContain('Welcome');
    });
  });

  describe('common locale (components/common)', () => {
    it('should translate common error/offline/skip keys in Korean without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('common:errorOccurred')).toBe('오류가 발생했습니다');
      expect(i18n.t('common:errorUnexpected')).toBe('예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.');
      expect(i18n.t('common:showDetails')).toBe('상세 정보 보기');
      expect(i18n.t('common:refreshPage')).toBe('페이지 새로고침');
      expect(i18n.t('common:previousPage')).toBe('이전 페이지');
      expect(i18n.t('common:errorDetails')).toBe('오류 상세 정보');
      expect(i18n.t('common:stackTraceNotAvailable')).toBe('스택 추적을 사용할 수 없습니다');
      expect(i18n.t('common:offlineMessage')).toBe('인터넷 연결이 끊어졌습니다. 읽기 전용 모드로 전환되었습니다.');
      expect(i18n.t('common:reconnectedMessage')).toBe('인터넷에 다시 연결되었습니다.');
      expect(i18n.t('common:skipToContent')).toBe('본문으로 건너뛰기');
      expect(i18n.t('common:tryAgain')).toBe('다시 시도');
      expect(i18n.t('common:confirm')).toBe('확인');
      expect(i18n.t('common:cancel')).toBe('취소');
    });

    it('should translate common error/offline/skip keys in English without raw key exposure', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('common:errorOccurred')).toBe('An error occurred');
      expect(i18n.t('common:errorUnexpected')).toBe('An unexpected error occurred. Please refresh the page or try again later.');
      expect(i18n.t('common:showDetails')).toBe('Show details');
      expect(i18n.t('common:refreshPage')).toBe('Refresh page');
      expect(i18n.t('common:previousPage')).toBe('Previous page');
      expect(i18n.t('common:errorDetails')).toBe('Error details');
      expect(i18n.t('common:stackTraceNotAvailable')).toBe('Stack trace not available');
      expect(i18n.t('common:offlineMessage')).toBe('Internet connection lost. Switched to read-only mode.');
      expect(i18n.t('common:reconnectedMessage')).toBe('Internet reconnected.');
      expect(i18n.t('common:skipToContent')).toBe('Skip to main content');
      expect(i18n.t('common:tryAgain')).toBe('Try again');
      expect(i18n.t('common:confirm')).toBe('Confirm');
      expect(i18n.t('common:cancel')).toBe('Cancel');
    });
  });

  describe('Dashboard locale smoke', () => {
    it('should translate dashboard keys in Korean without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('dashboard:emptyState.welcome')).toBe('VibeSmith에 오신 것을 환영합니다!');
      expect(i18n.t('dashboard:header.title')).toBe('AI 에이전트 명령 센터');
      expect(i18n.t('dashboard:optimizer.contextOptimized')).toBe('컨텍스트가 최적화되어 있습니다');
    });

    it('should translate dashboard keys in English without raw key exposure', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('dashboard:emptyState.welcome')).toBe('Welcome to VibeSmith!');
      expect(i18n.t('dashboard:header.title')).toBe('Your AI Agent Command Center');
      expect(i18n.t('dashboard:optimizer.contextOptimized')).toBe('Context is optimized');
    });

    it('should support dashboard interpolation', () => {
      expect(i18n.t('dashboard:optimizer.disableSuccess', { count: 3 })).toContain('3');
      expect(i18n.t('dashboard:suggestions.foundCount', { count: 5 })).toContain('5');
    });
  });

  describe('projectDetail locale', () => {
    it('should translate projectDetail keys in Korean', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('projectDetail:empty.noSearchResults')).toBe('검색 결과가 없습니다');
      expect(i18n.t('projectDetail:empty.noComponents')).toBe('아직 구성요소가 없습니다');
      expect(i18n.t('projectDetail:header.backButton')).toBe('프로젝트 목록');
      expect(i18n.t('projectDetail:error.projectNotFound')).toBe('프로젝트를 찾을 수 없습니다');
      expect(i18n.t('projectDetail:stats.tablistAria')).toBe('프로젝트 구성요소 타입');
      expect(i18n.t('projectDetail:presetApply.scopeLabel')).toBe('콜렉션 범위');
      expect(i18n.t('projectDetail:presetApply.previewMismatchHint')).toContain('프리뷰를 다시');
    });

    it('should translate projectDetail keys in English', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('projectDetail:empty.noSearchResults')).toBe('No search results');
      expect(i18n.t('projectDetail:empty.noComponents')).toBe('No components yet');
      expect(i18n.t('projectDetail:header.backButton')).toBe('Back to Projects');
      expect(i18n.t('projectDetail:error.projectNotFound')).toBe('Project not found');
      expect(i18n.t('projectDetail:stats.tablistAria')).toBe('Project component types');
      expect(i18n.t('projectDetail:presetApply.scopeLabel')).toBe('Collection scope');
      expect(i18n.t('projectDetail:presetApply.previewMismatchHint')).toContain('Selection changed');
    });

    it('should support projectDetail interpolation', () => {
      expect(i18n.t('projectDetail:component.viewDetailAria', { name: 'my-skill' })).toContain('my-skill');
      expect(i18n.t('projectDetail:component.showing', { count: 5 })).toContain('5');
      expect(i18n.t('projectDetail:statCard.ariaLabelWithActive', { title: 'Skills', count: 10, active: 8 })).toContain('10');
    });
  });

  describe('globalSearch locale', () => {
    it('should translate globalSearch keys in Korean without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('globalSearch:placeholder')).toBe('구성요소 검색... (입력하여 필터)');
      expect(i18n.t('globalSearch:ariaSearchLabel')).toBe('구성요소 검색');
      expect(i18n.t('globalSearch:recentSearches')).toBe('최근 검색');
      expect(i18n.t('globalSearch:loading')).toBe('로딩 중...');
      expect(i18n.t('globalSearch:typeToSearch')).toBe('구성요소를 검색하려면 입력하세요');
      expect(i18n.t('globalSearch:ariaResultsLabel')).toBe('검색 결과');
      expect(i18n.t('globalSearch:active')).toBe('활성');
      expect(i18n.t('globalSearch:inactive')).toBe('비활성');
      expect(i18n.t('globalSearch:navigate')).toBe('이동');
      expect(i18n.t('globalSearch:select')).toBe('선택');
      expect(i18n.t('globalSearch:close')).toBe('닫기');
    });

    it('should translate globalSearch keys in English without raw key exposure', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('globalSearch:placeholder')).toBe('Search components... (type to filter)');
      expect(i18n.t('globalSearch:ariaSearchLabel')).toBe('Search components');
      expect(i18n.t('globalSearch:recentSearches')).toBe('Recent Searches');
      expect(i18n.t('globalSearch:loading')).toBe('Loading...');
      expect(i18n.t('globalSearch:typeToSearch')).toBe('Type to search components');
      expect(i18n.t('globalSearch:ariaResultsLabel')).toBe('Search results');
      expect(i18n.t('globalSearch:active')).toBe('Active');
      expect(i18n.t('globalSearch:inactive')).toBe('Inactive');
      expect(i18n.t('globalSearch:navigate')).toBe('Navigate');
      expect(i18n.t('globalSearch:select')).toBe('Select');
      expect(i18n.t('globalSearch:close')).toBe('Close');
    });

    it('should support globalSearch interpolation', () => {
      expect(i18n.t('globalSearch:ariaRemoveLabel', { query: 'skill-1' })).toContain('skill-1');
      expect(i18n.t('globalSearch:noResultsFor', { query: 'test' })).toContain('test');
      expect(i18n.t('globalSearch:updated', { date: 'Jan 15' })).toContain('Jan 15');
    });
  });

  describe('tagManagement locale', () => {
    it('should translate tagManagement keys in Korean without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('settings:tagManagement.title')).toBe('태그 관리');
      expect(i18n.t('settings:tagManagement.description')).toBe('구성요소에서 사용 중인 태그 목록입니다. 태그 색상을 커스터마이징할 수 있습니다.');
      expect(i18n.t('settings:tagManagement.noTags')).toBe('사용 중인 태그가 없습니다');
      expect(i18n.t('settings:tagManagement.addTagsHint')).toBe('구성요소 편집에서 태그를 추가해보세요');
      expect(i18n.t('settings:tagManagement.componentCount', { count: 5 })).toBe('(5개 구성요소)');
      expect(i18n.t('settings:tagManagement.applyColor', { colorName: '파랑' })).toBe('파랑 색상 적용');
      expect(i18n.t('settings:tagManagement.defaultColor')).toBe('기본 색상');
      expect(i18n.t('settings:tagManagement.cancel')).toBe('취소');
      expect(i18n.t('settings:tagManagement.changeColor')).toBe('색상 변경');
    });

    it('should translate tagManagement keys in English without raw key exposure', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('settings:tagManagement.title')).toBe('Tag management');
      expect(i18n.t('settings:tagManagement.description')).toBe('List of tags used in components. You can customize tag colors.');
      expect(i18n.t('settings:tagManagement.noTags')).toBe('No tags in use');
      expect(i18n.t('settings:tagManagement.addTagsHint')).toBe('Add tags in component edit');
      expect(i18n.t('settings:tagManagement.componentCount', { count: 5 })).toBe('(5 components)');
      expect(i18n.t('settings:tagManagement.applyColor', { colorName: 'Blue' })).toBe('Apply Blue color');
      expect(i18n.t('settings:tagManagement.defaultColor')).toBe('Default color');
      expect(i18n.t('settings:tagManagement.cancel')).toBe('Cancel');
      expect(i18n.t('settings:tagManagement.changeColor')).toBe('Change color');
    });

    it('should support tagManagement color interpolation', () => {
      expect(i18n.t('settings:tagManagement.colors.blue')).toBeDefined();
      expect(i18n.t('settings:tagManagement.colors.cyan')).toBeDefined();
    });
  });

  describe('tags (components) locale', () => {
    it('should translate tags keys in Korean without raw key exposure', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('components:tags.placeholderDefault')).toBe('태그 추가...');
      expect(i18n.t('components:tags.tagExists')).toBe('이미 존재하는 태그입니다');
      expect(i18n.t('components:tags.invalidTag')).toBe('잘못된 태그입니다');
      expect(i18n.t('components:tags.maxTags', { max: 10 })).toBe('최대 10개까지 태그 추가 가능');
      expect(i18n.t('components:tags.addTagAria')).toBe('태그 추가');
      expect(i18n.t('components:tags.suggestionsAria')).toBe('태그 제안');
      expect(i18n.t('components:tags.filterByTag', { tag: 'skill' })).toBe('skill 태그로 필터');
      expect(i18n.t('components:tags.removeTag', { tag: 'skill' })).toBe('skill 태그 제거');
    });

    it('should translate tags keys in English without raw key exposure', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('components:tags.placeholderDefault')).toBe('Add tag...');
      expect(i18n.t('components:tags.tagExists')).toBe('Tag already exists');
      expect(i18n.t('components:tags.invalidTag')).toBe('Invalid tag');
      expect(i18n.t('components:tags.maxTags', { max: 10 })).toBe('Maximum 10 tags allowed');
      expect(i18n.t('components:tags.addTagAria')).toBe('Add tag');
      expect(i18n.t('components:tags.suggestionsAria')).toBe('Tag suggestions');
      expect(i18n.t('components:tags.filterByTag', { tag: 'skill' })).toBe('Filter by skill tag');
      expect(i18n.t('components:tags.removeTag', { tag: 'skill' })).toBe('Remove skill tag');
    });

    it('should support tags helpText interpolation', () => {
      expect(i18n.t('components:tags.helpText', { max: 10 })).toContain('10');
    });
  });

  describe('feedback locale', () => {
    it('should translate feedback keys in Korean', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('feedback:buttonText')).toBe('피드백');
      expect(i18n.t('feedback:dialog.title')).toBe('피드백 보내기');
      expect(i18n.t('feedback:actions.submit')).toBe('피드백 제출');
    });

    it('should translate feedback keys in English', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('feedback:buttonText')).toBe('Feedback');
      expect(i18n.t('feedback:dialog.title')).toBe('Send Feedback');
      expect(i18n.t('feedback:actions.submit')).toBe('Submit feedback');
    });
  });

  describe('license locale', () => {
    it('should translate license keys in Korean', async () => {
      await i18n.changeLanguage('ko');
      expect(i18n.t('license:entry.title')).toBe('라이선스 및 결제');
      expect(i18n.t('license:pages.license.title')).toBe('라이선스 관리');
      expect(i18n.t('license:actions.validate')).toBe('검증');
      expect(i18n.t('license:plans.pro.name')).toBe('프로');
    });

    it('should translate license keys in English', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('license:entry.title')).toBe('License & Billing');
      expect(i18n.t('license:pages.license.title')).toBe('License Management');
      expect(i18n.t('license:actions.validate')).toBe('Validate');
      expect(i18n.t('license:plans.pro.name')).toBe('Pro');
    });
  });
});
