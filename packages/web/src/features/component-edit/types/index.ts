/**
 * Component Edit feature types
 */

import type { ComponentType } from '@/common/types';
import type { ComponentDetailResponse } from '@/common/api';

/** API 수정 요청 타입 (docs/03_API_SPEC.md §2.4) */
export interface UpdateComponentDto {
  content?: string;
  tags?: string[];
}

/** Feature 편집 상태 */
export interface ComponentEditState {
  componentId: string;
  originalData: ComponentDetailResponse | null;
  name: string;
  description: string;
  tags: string[];
  content: string;
  loading: boolean;
  saving: boolean;
  error: Error | null;
}

export type { ComponentType };
