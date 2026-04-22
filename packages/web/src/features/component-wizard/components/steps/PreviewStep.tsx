import React, { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from 'react-use-wizard';
import { Button } from '@/components/ui/button';
import { useGenerateComponent } from '../../hooks/useTemplates';
import { showSuccessToast, showErrorToast } from '@/common/utils';
import type { WizardFormData } from '../../types';
import { Lightbulb, Loader2, RefreshCw } from 'lucide-react';

// Lazy load MDEditor for better initial bundle size
const MDEditor = lazy(() => import('@uiw/react-md-editor'));

interface PreviewStepProps {
  formData: WizardFormData;
  updateFormData: (data: Partial<WizardFormData>) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  formData,
  updateFormData,
}) => {
  const { t } = useTranslation('components');
  const { handleStep } = useWizard();
  const generateMutation = useGenerateComponent();

  // 컴포넌트 생성
  const handleGenerate = async () => {
    if (!formData.componentType || !formData.templateId || !formData.basicInfo) {
      showErrorToast(t('wizard.requiredInfoMissing'));
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        component_type: formData.componentType,
        template_id: formData.templateId,
        name: String(formData.basicInfo.skill_name ?? formData.basicInfo.agent_name ?? 'component'),
        description: String(formData.basicInfo.description ?? ''),
        config: formData.basicInfo,
      });

      updateFormData({ generatedContent: result.content });
      showSuccessToast(t('wizard.generateSuccess'));
    } catch (error) {
      showErrorToast(t('wizard.generateFailed'));
      console.error(error);
    }
  };

  // 최초 진입 시 자동 생성
  useEffect(() => {
    if (!formData.generatedContent && !generateMutation.isPending) {
      void handleGenerate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 다음 단계 검증
  handleStep(() => {
    if (!formData.generatedContent) {
      throw new Error(t('wizard.pleaseGenerate'));
    }
  });

  if (generateMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20" role="status" aria-label={t('wizard.generating')}>
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-theme-secondary">{t('wizard.generating')}</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{t('wizard.preview')}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={generateMutation.isPending}
          aria-label={t('wizard.regenerate')}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {t('wizard.regenerate')}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[500px] bg-theme-elevated" role="status" aria-label={t('wizard.generating')}>
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            </div>
          }
        >
          <MDEditor
            value={formData.generatedContent || ''}
            onChange={(value) => updateFormData({ generatedContent: value })}
            height={500}
            preview="live"
          />
        </Suspense>
      </div>

      <p className="text-sm text-theme-tertiary mt-2">
        <span className="inline-flex items-center gap-1">
          <Lightbulb className="h-4 w-4" aria-hidden />
          {t('wizard.editManually')}
        </span>
      </p>
    </div>
  );
};
