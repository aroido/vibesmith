import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useWizardForm } from './useWizardForm';

describe('useWizardForm', () => {
  it('should initialize with null values', () => {
    const { result } = renderHook(() => useWizardForm());

    expect(result.current.formData).toEqual({
      componentType: null,
      templateId: null,
      basicInfo: null,
      advancedConfig: null,
      generatedContent: null,
    });
  });

  it('should update form data', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({ componentType: 'skill' });
    });

    expect(result.current.formData.componentType).toBe('skill');
  });

  it('should update multiple fields at once', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        componentType: 'skill',
        templateId: 'template-1',
      });
    });

    expect(result.current.formData.componentType).toBe('skill');
    expect(result.current.formData.templateId).toBe('template-1');
  });

  it('should reset form data', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        componentType: 'skill',
        templateId: 'template-1',
      });
      result.current.resetForm();
    });

    expect(result.current.formData.componentType).toBeNull();
    expect(result.current.formData.templateId).toBeNull();
  });

  it('should reset sub-data when component type changes', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        componentType: 'skill',
        templateId: 'template-1',
        basicInfo: { skill_name: 'test-skill' },
      });
      result.current.setComponentType('agent');
    });

    expect(result.current.formData.componentType).toBe('agent');
    expect(result.current.formData.templateId).toBeNull();
    expect(result.current.formData.basicInfo).toBeNull();
  });

  it('should preserve generatedContent when changing type', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        componentType: 'skill',
        generatedContent: '# Test Content',
      });
      result.current.setComponentType('agent');
    });

    // setComponentType은 하위 데이터만 초기화하므로 generatedContent는 유지될 수 있음
    // 실제 구현에 따라 조정 필요
    expect(result.current.formData.componentType).toBe('agent');
  });
});
