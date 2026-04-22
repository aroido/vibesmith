/**
 * Component Create API client
 * 공통 API resources를 재사용
 */

import type { CreateComponentDto, ComponentCreateResponse } from '../types';
import type { Project } from '@/common/types';
import {
  createComponent as createComponentApi,
  getProjects as getProjectsApi,
} from '@/common/api';

/**
 * 구성요소 생성 (공통 API 래퍼)
 * POST /api/components
 */
export async function createComponent(
  data: CreateComponentDto
): Promise<ComponentCreateResponse> {
  return createComponentApi(data) as Promise<ComponentCreateResponse>;
}

/**
 * 프로젝트 목록 조회 (공통 API 래퍼)
 * GET /api/projects
 */
export async function getProjects(): Promise<Project[]> {
  return getProjectsApi() as Promise<Project[]>;
}
