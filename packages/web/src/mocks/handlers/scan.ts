/**
 * Scan API MSW Handlers
 * Based on docs/api/spec.md §5
 */

import { http, HttpResponse } from 'msw';

export const scanHandlers = [
  // POST /api/scan — 비동기 스캔 시작
  http.post('*/api/scan', async () => {
    return HttpResponse.json({
      status: 'started',
      scanned_projects: 0,
      total_components: 0,
      message: 'Scan started in background',
    });
  }),
];
