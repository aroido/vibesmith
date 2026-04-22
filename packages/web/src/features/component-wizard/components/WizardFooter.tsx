import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from 'react-use-wizard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WizardFooterProps {
  onClose: () => void;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({ onClose }) => {
  const { t } = useTranslation('components');
  const { previousStep, nextStep, isFirstStep, isLastStep } = useWizard();

  const handleNext = async () => {
    try {
      await nextStep();
    } catch (error) {
      // 유효성 검사 실패 시 에러 메시지는 각 Step에서 처리
      console.error('Step validation failed:', error);
    }
  };

  return (
    <div className="px-6 py-4 border-t flex justify-between items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="text-theme-secondary"
      >
        <X className="mr-2 h-4 w-4" />
        {t('wizard.cancel')}
      </Button>

      <div className="flex gap-2">
        {!isFirstStep && (
          <Button variant="outline" onClick={previousStep}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('wizard.previous')}
          </Button>
        )}

        <Button onClick={() => void handleNext()}>
          {isLastStep ? t('wizard.complete') : t('wizard.next')}
          {!isLastStep && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
