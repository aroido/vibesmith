/**
 * Backup API mock handlers
 * docs/api/spec.md §7.5
 */

import { http, HttpResponse } from 'msw';

interface MockBackupItem {
  id: string;
  version: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
}

const initialBackups: MockBackupItem[] = [
  {
    id: 'backup_20260223_080000',
    version: '1.0.0',
    size_bytes: 12453,
    checksum: 'sha256-2ecce9ab0f18c3d1fa0a',
    created_at: '2026-02-23T08:00:00Z',
  },
  {
    id: 'backup_20260222_210000',
    version: '1.0.0',
    size_bytes: 11204,
    checksum: 'sha256-f533a2f3c0b280ac9f22',
    created_at: '2026-02-22T21:00:00Z',
  },
];

let backupsStore = [...initialBackups];

export const backupHandlers = [
  // POST /api/backup/create
  http.post('*/api/backup/create', () => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const id = `backup_${stamp}`;

    const created: MockBackupItem = {
      id,
      version: '1.0.0',
      size_bytes: 10000 + Math.floor(Math.random() * 5000),
      checksum: `sha256-${id}`,
      created_at: now.toISOString(),
    };

    backupsStore = [created, ...backupsStore];
    return HttpResponse.json(created, { status: 201 });
  }),

  // GET /api/backup/list
  http.get('*/api/backup/list', () => {
    const sorted = [...backupsStore].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return HttpResponse.json(sorted);
  }),

  // POST /api/backup/restore
  http.post('*/api/backup/restore', async ({ request }) => {
    const body = (await request.json()) as { backup_id?: string };
    const backupId = body?.backup_id;
    if (!backupId) {
      return HttpResponse.json({ detail: 'backup_id is required' }, { status: 422 });
    }

    const target = backupsStore.find((item) => item.id === backupId);
    if (!target) {
      return HttpResponse.json({ detail: 'Backup not found' }, { status: 404 });
    }

    return HttpResponse.json({
      restored_projects: 2,
      restored_components: 9,
      restored_tags: 6,
      restored_dependencies: 4,
      restored_versions: 3,
    });
  }),

  // GET /api/backup/{backup_id}
  http.get('*/api/backup/:id', ({ params }) => {
    const backupId = params.id as string;
    const target = backupsStore.find((item) => item.id === backupId);
    if (!target) {
      return HttpResponse.json({ detail: 'Backup not found' }, { status: 404 });
    }

    return HttpResponse.json({
      ...target,
      payload: {
        version: target.version,
        timestamp: target.created_at,
        user_id: null,
        data: {
          projects: [],
          components: [],
          tags: [],
          dependencies: [],
          versions: [],
        },
        checksum: target.checksum,
      },
    });
  }),

  // DELETE /api/backup/{backup_id}
  http.delete('*/api/backup/:id', ({ params }) => {
    const backupId = params.id as string;
    const next = backupsStore.filter((item) => item.id !== backupId);
    if (next.length === backupsStore.length) {
      return HttpResponse.json({ detail: 'Backup not found' }, { status: 404 });
    }

    backupsStore = next;
    return HttpResponse.json({
      message: 'Deleted',
      message_key: 'common.deleted',
    });
  }),
];

export function resetBackupStore() {
  backupsStore = [...initialBackups];
}
