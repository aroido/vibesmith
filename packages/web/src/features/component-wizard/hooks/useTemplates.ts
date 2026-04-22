/**
 * Component Wizard Templates Hooks
 *
 * Issue #707: Mock API 제거 및 실제 API 사용
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getTemplates,
  getTemplateDetail,
  generateComponent,
} from '../services/api';
import type {
  ComponentType,
  ComponentGenerateRequest,
} from '../types';

// 템플릿 목록 조회
export const useTemplates = (componentType?: ComponentType) => {
  return useQuery({
    queryKey: ['templates', componentType],
    queryFn: () => getTemplates({ component_type: componentType }),
    enabled: !!componentType, // 타입 선택 후에만 실행
    staleTime: 5 * 60 * 1000, // 5분
  });
};

// 템플릿 상세 조회
export const useTemplateDetail = (templateId?: string) => {
  return useQuery({
    queryKey: ['template', templateId],
    queryFn: () => getTemplateDetail(templateId!),
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  });
};

// 컴포넌트 생성 Mutation (미리보기)
export const useGenerateComponent = () => {
  return useMutation({
    mutationFn: (request: ComponentGenerateRequest) => generateComponent(request),
  });
};
