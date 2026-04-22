/**
 * BackupPage tests
 * 목록, 빈 상태, 생성/복원/삭제, 에러 상태
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { BackupPage } from './BackupPage';

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
        <BackupPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const backupItem = {
  id: 'backup_001',
  version: '1.0.0',
  size_bytes: 12453,
  checksum: 'sha256-abcdef1234567890',
  created_at: '2026-02-23T08:00:00Z',
};

describe('BackupPage', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  beforeEach(() => {
    server.resetHandlers();
  });

  it('renders backup list when data exists', async () => {
    server.use(http.get('*/api/backup/list', () => HttpResponse.json([backupItem])));

    renderWithProviders();

    expect(await screen.findByText('backup_001')).toBeInTheDocument();
    expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /복원|Restore/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /삭제|Delete/ })).toBeInTheDocument();
  });

  it('renders empty state when no backups', async () => {
    server.use(http.get('*/api/backup/list', () => HttpResponse.json([])));

    renderWithProviders();

    expect(await screen.findByText(/백업이 없습니다|No backups yet/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /백업 생성|Create Backup/ }).length
    ).toBeGreaterThan(0);
  });

  it('creates backup after confirmation', async () => {
    const user = userEvent.setup();
    let createCalled = false;
    let listCallCount = 0;

    server.use(
      http.get('*/api/backup/list', () => {
        listCallCount += 1;
        if (listCallCount === 1) return HttpResponse.json([]);
        return HttpResponse.json([backupItem]);
      }),
      http.post('*/api/backup/create', () => {
        createCalled = true;
        return HttpResponse.json(backupItem, { status: 201 });
      })
    );

    renderWithProviders();
    expect(await screen.findByText(/백업이 없습니다|No backups yet/)).toBeInTheDocument();

    const createButtons = screen.getAllByRole('button', {
      name: /백업 생성|Create Backup/,
    });
    await user.click(createButtons[0]!);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /백업 생성|Create Backup/ }));

    await waitFor(() => {
      expect(createCalled).toBe(true);
    });
    expect(await screen.findByText('backup_001')).toBeInTheDocument();
  });

  it('restores selected backup after confirmation', async () => {
    const user = userEvent.setup();
    let restoredId = '';

    server.use(
      http.get('*/api/backup/list', () => HttpResponse.json([backupItem])),
      http.post('*/api/backup/restore', async ({ request }) => {
        const body = (await request.json()) as { backup_id: string };
        restoredId = body.backup_id;
        return HttpResponse.json({
          restored_projects: 1,
          restored_components: 4,
          restored_tags: 3,
          restored_dependencies: 2,
          restored_versions: 1,
        });
      })
    );

    renderWithProviders();
    expect(await screen.findByText('backup_001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /복원|Restore/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /복원|Restore/ }));

    await waitFor(() => {
      expect(restoredId).toBe('backup_001');
    });
  });

  it('deletes selected backup after confirmation', async () => {
    const user = userEvent.setup();
    let deletedId = '';

    server.use(
      http.get('*/api/backup/list', () => HttpResponse.json([backupItem])),
      http.delete('*/api/backup/:id', ({ params }) => {
        deletedId = params.id as string;
        return HttpResponse.json({ message: '삭제되었습니다', message_key: 'common.deleted' });
      })
    );

    renderWithProviders();
    expect(await screen.findByText('backup_001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /삭제|Delete/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /삭제|Delete/ }));

    await waitFor(() => {
      expect(deletedId).toBe('backup_001');
    });
  });

  it('shows error state when list API fails', async () => {
    server.use(
      http.get('*/api/backup/list', () =>
        HttpResponse.json({ detail: '서버 오류' }, { status: 500 })
      )
    );

    renderWithProviders();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/목록을 불러오지 못했습니다|Failed to load backup list/)).toBeInTheDocument();
  });
});
