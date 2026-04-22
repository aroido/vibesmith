import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSubmitFeedback } from '../hooks/useSubmitFeedback';
import { FeedbackDialog } from './FeedbackDialog';
import type { FeedbackRequest, FeedbackResponse } from '../types';

export function FeedbackButton() {
  const { t } = useTranslation('feedback');
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useSubmitFeedback();

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    setIsOpen(false);
  };

  const handleSubmit = async (payload: FeedbackRequest): Promise<FeedbackResponse> => {
    return mutation.mutateAsync(payload);
  };

  return (
    <>
      <button
        type="button"
        data-testid="feedback-open-button"
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 shadow-xl btn-theme-primary-soft"
        aria-label={t('buttonAria')}
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
        <span className="hidden text-sm font-medium sm:inline">{t('buttonText')}</span>
      </button>

      <FeedbackDialog
        isOpen={isOpen}
        isSubmitting={mutation.isPending}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </>
  );
}
