import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'analyze' && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // treemap, sunburst, network
    }),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@components': path.resolve(__dirname, './src/components'),
      '@common': path.resolve(__dirname, './src/common'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
  
  build: {
    sourcemap: mode !== 'production',
    // 번들 크기 경고 임계값 (500KB)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 코드 스플리팅 전략
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // React 관련 라이브러리
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'react-vendor';
          }

          // 데이터 페칭 라이브러리
          if (id.includes('/@tanstack/react-query/')) {
            return 'query-vendor';
          }

          // 공통 UI 라이브러리
          if (id.includes('/lucide-react/') || id.includes('/sonner/')) {
            return 'ui-vendor';
          }

          // reactflow/dagre는 라우트 lazy chunk에 자연스럽게 묶이도록 수동 청크화하지 않음
          return undefined;
        },
      },
    },
  },
  
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/__tests__/e2e/**',
      '**/__tests__/visual/**',
      '**/e2e/**',                 // Playwright E2E 전체 디렉토리 제외 (#322)
      '**/*.visual.spec.ts',
      '**/*.visual.spec.tsx',
      '**/*.e2e.spec.ts',
      '**/*.e2e.spec.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/types/**',
        '**/*.d.ts',
        'vite.config.ts',
        'tailwind.config.ts',
        'playwright.config.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
      all: false,
      clean: true,
      skipFull: false,
    },
  },
}));
