/**
 * TrashPage tests - 목록, 복원, 영구 삭제, 빈 상태, API 오류
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { TrashPage } from './TrashPage';

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TrashPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TrashPage', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
  });

  it('should render trash page structure', async () => {
    renderWithProviders();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /주요 메뉴|main menu/i })).toBeInTheDocument();
  });

  describe('empty state', () => {
    it('should show empty state when trash is empty', async () => {
      server.use(http.get('*/api/trash', () => HttpResponse.json([])));
      renderWithProviders();
      expect(
        await screen.findByText('휴지통이 비어 있습니다')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: '구성요소 목록으로' })
      ).toBeInTheDocument();
    });

    it('should NOT show empty state when API returns error', async () => {
      server.use(
        http.get('*/api/trash', () =>
          HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        )
      );
      renderWithProviders();
      expect(
        await screen.findByText('목록을 불러오지 못했습니다')
      ).toBeInTheDocument();
      expect(screen.queryByText('휴지통이 비어 있습니다')).not.toBeInTheDocument();
    });
  });

  describe('API error', () => {
    it('should show error alert when API fails', async () => {
      server.use(
        http.get('*/api/trash', () =>
          HttpResponse.json({ detail: '서버 오류' }, { status: 500 })
        )
      );
      renderWithProviders();
      expect(
        await screen.findByRole('alert', { name: undefined })
      ).toBeInTheDocument();
      expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
      expect(screen.getByText('서버 오류')).toBeInTheDocument();
    });

    it('should show retry button on error and refetch when clicked', async () => {
      let callCount = 0;
      server.use(
        http.get('*/api/trash', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { detail: '일시적 오류' },
              { status: 503 }
            );
          }
          return HttpResponse.json([]);
        })
      );
      renderWithProviders();
      expect(
        await screen.findByText('목록을 불러오지 못했습니다')
      ).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: '다시 시도' });
      expect(retryBtn).toBeInTheDocument();

      await userEvent.click(retryBtn);
      expect(
        await screen.findByText('휴지통이 비어 있습니다')
      ).toBeInTheDocument();
    });
  });

  describe('list with items', () => {
    it('should display trash list when items exist', async () => {
      renderWithProviders();
      expect(await screen.findByText('git-commit-message')).toBeInTheDocument();
      expect(screen.getByText('pydantic-model')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('should have restore and permanent delete buttons for each item', async () => {
      renderWithProviders();
      await screen.findByText('git-commit-message');
      const cards = screen.getAllByRole('article');
      expect(cards.length).toBeGreaterThanOrEqual(1);
      const firstCard = cards[0];
      expect(
        within(firstCard).getByRole('button', { name: /복원/ })
      ).toBeInTheDocument();
      expect(
        within(firstCard).getByRole('button', { name: /영구 삭제/ })
      ).toBeInTheDocument();
    });

    it('should show empty all and refresh buttons when items exist', async () => {
      renderWithProviders();
      await screen.findByText('git-commit-message');
      expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '휴지통 모두 비우기' })
      ).toBeInTheDocument();
    });
  });
});
