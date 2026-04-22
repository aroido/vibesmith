/**
 * Lighthouse CI Configuration
 * 
 * Core Web Vitals 목표 (2026 기준):
 * - LCP (Largest Contentful Paint): < 2.5초
 * - FID (First Input Delay): < 100ms
 * - CLS (Cumulative Layout Shift): < 0.1
 * - FCP (First Contentful Paint): < 2.0초
 * - TTI (Time to Interactive): < 3.5초
 * 
 * Lighthouse 점수 목표:
 * - Performance: ≥ 90점
 * - Accessibility: ≥ 90점
 * - Best Practices: ≥ 90점
 * - SEO: ≥ 80점
 */

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/dashboard',
        'http://localhost:4173/projects',
        'http://localhost:4173/settings',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // 모바일 성능도 측정하려면 아래 주석 해제
        // preset: 'mobile',
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // ========================================
        // 성능 점수 (Performance Score)
        // ========================================
        'categories:performance': ['error', { minScore: 0.9 }],
        
        // ========================================
        // Core Web Vitals
        // ========================================
        
        // FCP (First Contentful Paint) - 첫 콘텐츠 렌더링
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        
        // LCP (Largest Contentful Paint) - 최대 콘텐츠 렌더링
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        
        // CLS (Cumulative Layout Shift) - 레이아웃 이동
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        // TBT (Total Blocking Time) - 메인 스레드 차단 시간
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // SI (Speed Index) - 콘텐츠 표시 속도
        'speed-index': ['error', { maxNumericValue: 3000 }],
        
        // TTI (Time to Interactive) - 상호작용 가능 시간
        'interactive': ['error', { maxNumericValue: 3500 }],
        
        // ========================================
        // 리소스 최적화
        // ========================================
        
        // JavaScript 번들 크기 (500KB 제한)
        'resource-summary:script:size': ['error', { maxNumericValue: 500000 }],
        
        // CSS 번들 크기 (100KB 제한)
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }],
        
        // 이미지 크기 (1MB 제한)
        'resource-summary:image:size': ['warn', { maxNumericValue: 1000000 }],
        
        // 미사용 JavaScript 제거
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        
        // 미사용 CSS 제거
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }],
        
        // ========================================
        // 접근성 (Accessibility)
        // ========================================
        'categories:accessibility': ['error', { minScore: 0.9 }],
        
        // ========================================
        // 베스트 프랙티스 (Best Practices)
        // ========================================
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        
        // ========================================
        // SEO
        // ========================================
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // ========================================
        // 개발 환경 특화 설정 (로컬 개발용)
        // ========================================
        
        // HTTP/2 사용 (로컬 개발 시 off)
        'uses-http2': 'off',
        
        // 긴 캐시 TTL (로컬 개발 시 off)
        'uses-long-cache-ttl': 'off',
        
        // HTTPS 사용 (로컬 개발 시 off)
        'is-on-https': 'off',
        
        // Resource Hints (선택적)
        'uses-rel-preconnect': 'off',
        'uses-rel-preload': 'off',
        
        // ========================================
        // 프로덕션 배포 시 활성화 권장
        // ========================================
        // 'uses-http2': ['warn', { minScore: 1 }],
        // 'uses-long-cache-ttl': ['warn', { minScore: 0.75 }],
        // 'is-on-https': ['error', { minScore: 1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
      // GitHub App Token 설정 시 GitHub에 직접 업로드
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
    },
  },
};
