import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from 'react-use-wizard';
import { TemplateCard } from '../TemplateCard';
import { useTemplates } from '../../hooks/useTemplates';
import type { WizardFormData } from '../../types';
import { Loader2 } from 'lucide-react';

interface TemplateSelectStepProps {
  formData: WizardFormData;
  updateFormData: (data: Partial<WizardFormData>) => void;
}

export const TemplateSelectStep: React.FC<TemplateSelectStepProps> = ({
  formData,
  updateFormData,
}) => {
  const { t } = useTranslation('components');
  const { handleStep } = useWizard();
  const { data, isLoading, error } = useTemplates(formData.componentType!);

  const handleSelectTemplate = (templateId: string) => {
    updateFormData({ templateId });
  };

  // 템플릿 선택 여부 검증
  handleStep(() => {
    if (!formData.templateId) {
      throw new Error(t('wizard.selectTemplateValidation'));
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" role="status" aria-label={t('wizard.templateLoading')}>
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-theme-secondary">{t('wizard.templateLoading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-6">
        <div className="alert-theme-danger rounded-lg p-4" role="alert">
          <p>{t('wizard.templateError')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <h3 className="text-lg text-theme-primary mb-2">
        {t('wizard.selectTemplate', { type: formData.componentType ?? '' })}
      </h3>
      <p className="text-sm text-theme-secondary mb-6">
        {t('wizard.templateCount', { count: data?.templates.length ?? 0 })}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={formData.templateId === template.id}
            onSelect={handleSelectTemplate}
          />
        ))}
      </div>
    </div>
  );
};
