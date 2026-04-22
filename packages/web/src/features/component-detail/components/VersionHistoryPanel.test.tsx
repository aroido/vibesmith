import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { VersionHistoryPanel } from './VersionHistoryPanel';

const mockVersions = [
  {
    version: 3,
    content: '---\nname: fastapi-route\n---\n최신 본문',
    created_at: '2026-02-09T16:30:00Z',
  },
  {
    version: 2,
    content: '---\nname: fastapi-route\n---\n이전 본문',
    created_at: '2026-02-09T14:00:00Z',
  },
  {
    version: 1,
    content: '---\nname: fastapi-route\n---\n최초 본문',
    created_at: '2026-02-09T10:00:00Z',
  },
];

const server = setupServer(
  http.get('*/api/components/:id/versions', () => HttpResponse.json(mockVersions)),
  http.post('*/api/components/:id/rollback', async ({ request }) => {
    const body = (await request.json()) as { version: number };
    return HttpResponse.json({
      id: 'comp_001',
      restored_version: body.version,
      new_version: 4,
      message: `버전 ${body.version}로 롤백되었습니다`,
    });
  })
);

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeAll(async () => {
  await i18n.changeLanguage('ko');
  server.listen();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('VersionHistoryPanel', () => {
  it('renders version list and preview', async () => {
    renderWithProviders(
      <VersionHistoryPanel componentId="comp_001" componentName="fastapi-route" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('version-history-item-3')).toBeInTheDocument();
    });

    expect(screen.getByTestId('version-history-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('version-history-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('version-history-preview')).toHaveTextContent('최신 본문');
  });

  it('updates preview and shows diff summary when older version selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <VersionHistoryPanel componentId="comp_001" componentName="fastapi-route" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('version-history-item-2')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('version-history-item-2'));
    expect(screen.getByTestId('version-history-preview')).toHaveTextContent('이전 본문');

    await user.click(screen.getByTestId('version-history-compare-toggle'));
    expect(screen.getByText(/\+\d+\s*\/\s*-\d+/)).toBeInTheDocument();
    expect(screen.getByText(/현재 버전|Current/)).toBeInTheDocument();
    expect(screen.getByText(/선택 버전|Selected/)).toBeInTheDocument();
  });

  it('runs rollback flow and calls success callback', async () => {
    const user = userEvent.setup();
    const onRollbackSuccess = vi.fn();

    renderWithProviders(
      <VersionHistoryPanel
        componentId="comp_001"
        componentName="fastapi-route"
        onRollbackSuccess={onRollbackSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('version-history-item-2')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('version-history-item-2'));
    await user.click(screen.getByTestId('version-history-rollback-button'));

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^롤백$|^Rollback$/ }));

    await waitFor(() => {
      expect(onRollbackSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
