/**
 * Renderer Process Entry Point
 * Loads the web app from packages/web
 *
 * Provider 소유권: App.tsx가 QueryClientProvider/Toaster를 단일 제공.
 * 이 엔트리는 최소한의 root mount만 수행 (중복 생성 방지 #350)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@vibesmith/web/styles/globals.css';
import { App } from '@vibesmith/web/App';
import i18n from '@vibesmith/web/i18n';
import { I18nextProvider } from 'react-i18next';
import { initializePostHog } from './analytics/posthog';

initializePostHog();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);
