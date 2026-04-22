import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { PricingPage } from './PricingPage';

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
        <PricingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PricingPage', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it('renders plan cards', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: /플랜 선택|Choose a plan/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /무료|Free/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /프로|Pro/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /팀|Team/i })
    ).toBeInTheDocument();
  });

  it('requests checkout and redirects when email is provided', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderPage();

    await user.type(screen.getByLabelText(/이메일|Email/i), 'user@example.com');
    await user.click(
      screen.getByRole('button', {
        name: /프로 결제 시작|Start Pro checkout/i,
      })
    );

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });
});
