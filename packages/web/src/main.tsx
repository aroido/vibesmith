import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './styles/globals.css';

// Enable MSW for E2E testing and development
async function enableMocking() {
  // Enable MSW if:
  // 1. E2E testing environment (VITE_E2E_MOCK=true)
  // 2. Or development mode with VITE_USE_MOCK=true
  const shouldMock = 
    import.meta.env.VITE_E2E_MOCK === 'true' || 
    import.meta.env.VITE_USE_MOCK === 'true';

  console.log('[MSW] Environment check:', {
    VITE_E2E_MOCK: import.meta.env.VITE_E2E_MOCK,
    VITE_USE_MOCK: import.meta.env.VITE_USE_MOCK,
    shouldMock,
  });

  if (!shouldMock) {
    console.log('[MSW] Mock disabled - using real API');
    return;
  }

  console.log('[MSW] Loading mock worker...');
  const { worker } = await import('./mocks/browser');
  
  const startResult = await worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    serviceWorker: {
      // Use custom service worker URL if needed
      url: '/mockServiceWorker.js',
    },
  });
  
  console.log('[MSW] Worker started successfully!', startResult);
  return startResult;
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
