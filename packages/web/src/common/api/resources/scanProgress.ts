/**
 * Scan Progress API Client
 * GET /api/system/scan-progress
 */

import { apiClient } from '../client';

export interface ScanProgressProject {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'scanning' | 'done';
  progress: number;
}

export interface ScanProgressResponse {
  scanning: boolean;
  projects: ScanProgressProject[];
}

export async function getScanProgress(): Promise<ScanProgressResponse> {
  return apiClient<ScanProgressResponse>('/api/system/scan-progress');
}
