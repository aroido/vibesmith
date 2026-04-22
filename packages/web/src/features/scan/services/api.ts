/**
 * Scan API client
 * POST /api/scan (spec §7.1)
 */

import type { ScanRequest, ScanResponse } from '../types';
import { apiClient } from '@/common/api';

/**
 * 스캔 실행
 * POST /api/scan
 */
export async function scan(request: ScanRequest = {}): Promise<ScanResponse> {
  return apiClient<ScanResponse>('/api/scan', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
