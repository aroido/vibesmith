import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useWizard } from 'react-use-wizard';
import { Form } from '@/components/ui/form';
import { FieldRenderer } from '../FieldRenderer';
import { useTemplateDetail } from '../../hooks/useTemplates';
import { createValidationSchema } from '../../schemas/validation';
import type { WizardFormData } from '../../types';
import { Loader2 } from 'lucide-react';

interface BasicInfoStepProps {
  formData: WizardFormData;
  updateFormData: (data: Partial<WizardFormData>) => void;
}

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  formData,
  updateFormData,
}) => {
  const { handleStep } = useWizard();
  const { t } = useTranslation('components');
  const { data: template, isLoading } = useTemplateDetail(formData.templateId!);

  const schema = React.useMemo(
    () => (template ? createValidationSchema(template.fields, t) : null),
    [template, t]
  );

  const form = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: formData.basicInfo || {},
  });

  // 유효성 검사 및 다음 단계 이동
  handleStep(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      throw new Error(t('wizard.validationError'));
    }
    const data = form.getValues();
    updateFormData({ basicInfo: data });
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-theme-secondary">{t('wizard.templateLoadingLabel')}</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-8 py-6">
        <div className="alert-theme-danger rounded-lg p-4">
          <p className="text-theme-danger">{t('wizard.templateNotFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <h3 className="text-lg text-theme-primary mb-2">
        {t('wizard.basicInfoTitle')}
      </h3>
      <p className="text-sm text-theme-secondary mb-6">
        {t('wizard.templateLabel', { name: template.name })}
      </p>

      <Form {...form}>
        <form className="space-y-6">
          {template.fields.map((field) => (
            <FieldRenderer key={field.name} field={field} control={form.control} />
          ))}
        </form>
      </Form>
    </div>
  );
};
