import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wizard } from 'react-use-wizard';
import { WizardHeader } from './WizardHeader';
import { WizardFooter } from './WizardFooter';
import { TypeSelectStep } from './steps/TypeSelectStep';
import { TemplateSelectStep } from './steps/TemplateSelectStep';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { PreviewStep } from './steps/PreviewStep';
import { SaveStep } from './steps/SaveStep';
import { useWizardForm } from '../hooks/useWizardForm';

interface WizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (componentId: string) => void;
}

export const WizardModal: React.FC<WizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation('components');
  const { formData, updateFormData, resetForm, setComponentType } = useWizardForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const hasUnsavedChanges = () => {
    return !!(formData.componentType || formData.templateId || formData.basicInfo);
  };

  const handleClose = () => {
    // 데이터가 있으면 확인 다이얼로그 표시
    if (hasUnsavedChanges()) {
      setShowConfirmDialog(true);
    } else {
      resetForm();
      onClose();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    resetForm();
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <VisuallyHidden>
            <DialogTitle>{t('wizard.title')}</DialogTitle>
            <DialogDescription>{t('wizard.description')}</DialogDescription>
          </VisuallyHidden>
          <Wizard
            onStepChange={(stepIndex) => setCurrentStep(stepIndex)}
            header={
              <WizardHeader
                formData={formData}
                currentStep={currentStep}
                totalSteps={5}
              />
            }
            footer={<WizardFooter onClose={handleClose} />}
          >
            <TypeSelectStep formData={formData} setComponentType={setComponentType} />
            <TemplateSelectStep formData={formData} updateFormData={updateFormData} />
            <BasicInfoStep formData={formData} updateFormData={updateFormData} />
            <PreviewStep formData={formData} updateFormData={updateFormData} />
            <SaveStep formData={formData} onComplete={onComplete} />
          </Wizard>
        </DialogContent>
      </Dialog>

      {/* 닫기 확인 AlertDialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wizard.confirmCloseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wizard.confirmCloseDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>
              {t('wizard.confirmCloseContinue')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>
              {t('wizard.confirmCloseOk')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
