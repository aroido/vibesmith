/**
 * GlobalSearchModal unit tests
 * i18n, rendering, accessibility strings
 */

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from '@/i18n';
import { GlobalSearchModal } from './GlobalSearchModal';

const mockComponents = [
  {
    id: 'comp_001',
    type: 'skill',
    name: 'git-commit',
    description: 'Git commit message',
    enabled: true,
    tags: ['git'],
    project_id: 'proj_global',
    project_name: 'global',
    path: '~/.cursor/skills/git-commit',
    created_at: '2026-02-09T10:00:00Z',
    updated_at: '2026-02-12T10:00:00Z',
  },
];

const server = setupServer(
  http.get('*/api/components', () => HttpResponse.json(mockComponents))
);

beforeAll(() => server.listen());
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GlobalSearchModal isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GlobalSearchModal', () => {
  it('should render with English i18n strings when locale is en', async () => {
    await i18n.changeLanguage('en');
    renderModal();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search components... (type to filter)')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Search components')).toBeInTheDocument();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should render with Korean i18n strings when locale is ko', async () => {
    await i18n.changeLanguage('ko');
    renderModal();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('구성요소 검색... (입력하여 필터)')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('구성요소 검색')).toBeInTheDocument();
    expect(screen.getByText('이동')).toBeInTheDocument();
    expect(screen.getByText('선택')).toBeInTheDocument();
    expect(screen.getByText('닫기')).toBeInTheDocument();
  });

  it('should show no raw i18n keys', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/globalSearch:|placeholder|ariaSearchLabel/);
  });
});
