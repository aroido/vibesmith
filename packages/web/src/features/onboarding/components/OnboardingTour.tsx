/**
 * Onboarding Tour Component
 * driver.js 기반 인터랙티브 가이드 투어
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../styles/tour.css';
import { useTour } from '../contexts/TourContext';
import { getTourSteps } from '../data/tourSteps';

export function OnboardingTour() {
  const { t } = useTranslation('settings');
  const { isActive, complete, skip } = useTour();

  useEffect(() => {
    if (!isActive) return;

    const steps = getTourSteps();
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps,
      nextBtnText: t('tour.nextBtn'),
      prevBtnText: t('tour.prevBtn'),
      doneBtnText: t('tour.doneBtn'),
      progressText: t('tour.progressText'),
      onDestroyed: () => {
        // 투어 종료 시 항상 complete 처리
        // (마지막 단계에서 "완료" 클릭하거나 중간에 "스킵" 클릭 모두)
        const currentIndex = driverObj.getActiveIndex();
        if (currentIndex === steps.length - 1 || currentIndex === undefined) {
          // 마지막 단계이거나 이미 종료된 경우
          complete();
        } else {
          // 중간에 스킵한 경우
          skip();
        }
      },
      popoverClass: 'vibesmith-tour-popover',
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      smoothScroll: true,
    });

    driverObj.drive();

    return () => {
      driverObj.destroy();
    };
  }, [isActive, complete, skip, t]);

  return null;
}
