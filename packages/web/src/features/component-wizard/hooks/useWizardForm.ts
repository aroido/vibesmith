import { useState } from 'react';
import type { WizardFormData, ComponentType } from '../types';

const initialFormData: WizardFormData = {
  componentType: null,
  templateId: null,
  basicInfo: null,
  advancedConfig: null,
  generatedContent: null,
};

export const useWizardForm = () => {
  const [formData, setFormData] = useState<WizardFormData>(initialFormData);

  const updateFormData = (data: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const setComponentType = (type: ComponentType) => {
    // 타입 변경 시 템플릿 및 이후 데이터 초기화
    setFormData({
      ...initialFormData,
      componentType: type,
    });
  };

  return {
    formData,
    updateFormData,
    resetForm,
    setComponentType,
  };
};
