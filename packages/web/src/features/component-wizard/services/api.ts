/**
 * Component Wizard API Client
 * Backend Issue #130/#266/#707 - 실제 API 사용
 */

import { apiClient } from '@/common/api';
import type {
  Template,
  ComponentGenerateRequest,
  ComponentGenerateResponse,
  ComponentSaveRequest,
  ComponentSaveResponse,
  ComponentType,
} from '../types';

// Project 타입 정의 (API §1.1 응답 기반)
interface Project {
  id: string;
  name: string;
  path: string;
  is_global: boolean;
  platforms?: string[];
}

/**
 * 템플릿 목록 조회
 * GET /api/templates
 */
export async function getTemplates(params?: {
  component_type?: ComponentType;
  category?: string;
  difficulty?: string;
}): Promise<{ templates: Template[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.component_type) {
    searchParams.append('component_type', params.component_type);
  }
  if (params?.category) {
    searchParams.append('category', params.category);
  }
  if (params?.difficulty) {
    searchParams.append('difficulty', params.difficulty);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/api/templates?${queryString}` : '/api/templates';

  return apiClient<{ templates: Template[]; total: number }>(url);
}

/**
 * 템플릿 상세 조회
 * GET /api/templates/{template_id}
 */
export async function getTemplateDetail(templateId: string): Promise<Template> {
  return apiClient<Template>(`/api/templates/${templateId}`);
}

/**
 * 컴포넌트 생성 (미리보기)
 * POST /api/components/generate
 */
export async function generateComponent(
  request: ComponentGenerateRequest
): Promise<ComponentGenerateResponse> {
  return apiClient<ComponentGenerateResponse>('/api/components/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * 컴포넌트 저장
 * POST /api/components/save
 */
export async function saveComponent(
  request: ComponentSaveRequest
): Promise<ComponentSaveResponse> {
  return apiClient<ComponentSaveResponse>('/api/components/save', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * 프로젝트 목록 조회
 * GET /api/projects
 */
export async function getProjects(): Promise<Project[]> {
  return apiClient<Project[]>('/api/projects');
}
