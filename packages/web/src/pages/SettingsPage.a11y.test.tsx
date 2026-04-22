/**
 * SettingsPage Accessibility Tests (axe-core)
 * WCAG 2.1 AA 준수 검증
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TourProvider } from '../features/onboarding';
import { SettingsPage } from './SettingsPage';

const mockSystemStatus = {
  is_live: true,
  last_scan_at: '2026-02-12T10:00:00Z',
  active_workers: { watcher: true, usage_scanner: true },
  health_score: 98,
};

const server = setupServer(
  http.get('*/api/system/status', () => HttpResponse.json(mockSystemStatus))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TourProvider>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </TourProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('SettingsPage Accessibility', () => {
  it('should have no axe accessibility violations', async () => {
    const { container } = renderSettings();
    await screen.findByRole('main');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have main landmark with id for skip link', async () => {
    renderSettings();
    const main = await screen.findByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });
});
