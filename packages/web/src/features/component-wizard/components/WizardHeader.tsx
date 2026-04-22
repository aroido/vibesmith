import React from 'react';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import type { WizardFormData } from '../types';

const STEP_KEYS = [
  'wizard.stepTypeSelect',
  'wizard.stepTemplateSelect',
  'wizard.stepBasicInfo',
  'wizard.stepAdvanced',
  'wizard.stepPreview',
  'wizard.stepSave',
] as const;

interface WizardHeaderProps {
  formData: WizardFormData;
  currentStep: number;
  totalSteps: number;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  formData,
  currentStep,
  totalSteps,
}) => {
  const { t } = useTranslation('components');
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="px-6 pt-6 pb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold">{t('wizard.title')}</h2>
        <span className="text-sm text-theme-tertiary" aria-label={t('wizard.stepProgress', { current: currentStep + 1, total: totalSteps })}>
          {t('wizard.stepProgress', { current: currentStep + 1, total: totalSteps })}
        </span>
      </div>

      <p className="text-sm text-theme-secondary mb-3">
        {t(STEP_KEYS[currentStep] ?? 'wizard.stepSave')}
        {formData.componentType && ` - ${formData.componentType}`}
      </p>

      <Progress value={progress} className="h-2" aria-label={t('wizard.stepProgress', { current: currentStep + 1, total: totalSteps })} />
    </div>
  );
};
