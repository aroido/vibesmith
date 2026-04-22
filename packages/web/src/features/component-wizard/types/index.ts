import type { ComponentType } from '@/common/types';

export type { ComponentType };

export interface Template {
  id: string;
  name: string;
  description: string;
  component_type: ComponentType;
  category: string;
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: string;
  fields: TemplateField[];
  tags: string[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  default?: unknown;
  help_text?: string;
  validation?: {
    pattern?: string;
    message?: string;
  };
}

export interface WizardFormData {
  componentType: ComponentType | null;
  templateId: string | null;
  basicInfo: Record<string, unknown> | null;
  advancedConfig: Record<string, unknown> | null;
  generatedContent: string | null;
}

export interface ComponentGenerateRequest {
  component_type: ComponentType;
  template_id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
}

export interface ComponentGenerateResponse {
  content: string;
  preview_id: string;
  expires_at: string;
  component_type: ComponentType;
  file_name: string;
}

export interface ComponentSaveRequest {
  type: ComponentType;           // API는 'type' 사용
  name: string;
  project_id: string;
  content: string;
  tags?: string[];
  platform: 'claude_code' | 'cursor';
}

export interface ComponentSaveResponse {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
  project_id: string;
  path: string;                  // API는 'path' 사용
  created_at: string;
  updated_at: string;
  platform: string;
}
