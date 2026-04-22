import { readFileSync } from 'node:fs';
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const desktopPackage = JSON.parse(
    readFileSync(resolve(__dirname, 'package.json'), 'utf8')
  ) as { version?: string };
  const posthogKey = env.VITE_POSTHOG_KEY ?? '';
  const posthogHost = env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  const appVersion = desktopPackage.version ?? 'unknown';
  const buildFlavor = env.VIBESMITH_BUILD_FLAVOR === 'internal' ? 'internal' : 'release';
  const allowPostHogWebdriver =
    env.VIBESMITH_POSTHOG_ALLOW_WEBDRIVER === 'true' ? 'true' : 'false';

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'electron/main.ts'),
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'electron/preload.ts'),
        },
      },
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      define: {
        __VIBESMITH_POSTHOG_KEY__: JSON.stringify(posthogKey),
        __VIBESMITH_POSTHOG_HOST__: JSON.stringify(posthogHost),
        __VIBESMITH_APP_VERSION__: JSON.stringify(appVersion),
        __VIBESMITH_BUILD_FLAVOR__: JSON.stringify(buildFlavor),
        __VIBESMITH_POSTHOG_ALLOW_WEBDRIVER__: JSON.stringify(
          allowPostHogWebdriver
        ),
      },
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@vibesmith/web': resolve(__dirname, '../web/src'),
          '@': resolve(__dirname, '../web/src'),
          '@features': resolve(__dirname, '../web/src/features'),
          '@components': resolve(__dirname, '../web/src/components'),
          '@common': resolve(__dirname, '../web/src/common'),
          '@hooks': resolve(__dirname, '../web/src/hooks'),
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
