import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTour } from '../contexts/TourContext';

export function TourTrigger() {
  const navigate = useNavigate();
  const { reset } = useTour();
  const { t } = useTranslation('settings');

  const handleRestart = () => {
    void navigate('/');
    reset();
  };

  const label = t('restartTour');

  return (
    <button
      type="button"
      onClick={handleRestart}
      className="px-4 py-2 btn-theme-primary-soft rounded-lg font-medium transition-all"
      aria-label={label}
    >
      {label}
    </button>
  );
}
