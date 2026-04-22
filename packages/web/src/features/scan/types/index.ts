/**
 * Scan feature types
 * POST /api/scan API Request/Response (spec §6.1)
 */

/** POST /api/scan 요청 */
export interface ScanRequest {
  home_path?: string;
  cursor_global_path?: string;
  root_path?: string;
  project_id?: string;
}

/** POST /api/scan 응답 — 비동기 스캔 시작 확인 */
export interface ScanResponse {
  status: 'started' | 'already_running';
  scanned_projects: number;
  total_components: number;
  message: string;
}
