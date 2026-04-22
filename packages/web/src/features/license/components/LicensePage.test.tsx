import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { LicensePage } from './LicensePage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LicensePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LicensePage', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    localStorage.clear();
  });
  afterAll(() => server.close());

  it('shows free plan by default', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /라이선스 관리|License Management/i,
      })
    ).toBeInTheDocument();

    expect(await screen.findByText(/무료|Free/i)).toBeInTheDocument();
  });

  it('validates entered key and updates plan', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/라이선스 키|License key/i), 'VS-VALID-PRO');
    await user.click(screen.getByRole('button', { name: /검증|Validate/i }));

    await waitFor(() => {
      const planLabel = screen.getByText(/^(플랜|Plan)$/i);
      const planCard = planLabel.closest('article');

      expect(planCard).not.toBeNull();
      expect(within(planCard!).getByText(/프로|Pro/i)).toBeInTheDocument();
    });
  });
});
