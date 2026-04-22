/**
 * Onboarding Tour Steps
 * driver.js 기반 투어 단계 정의
 */

import i18n from '@/i18n';
import type { DriveStep } from 'driver.js';

/**
 * 투어 단계 생성 함수 (i18n 지원)
 */
export function getTourSteps(): DriveStep[] {
  return [
    {
      element: 'body',
      popover: {
        title: i18n.t('onboarding:tour.welcome.title'),
        description: i18n.t('onboarding:tour.welcome.description'),
        side: 'over',
        align: 'center',
      },
    },
    {
      element: '[data-tour="settings-button"]',
      popover: {
        title: i18n.t('onboarding:tour.scan.title'),
        description: i18n.t('onboarding:tour.scan.description'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="components-menu"]',
      popover: {
        title: i18n.t('onboarding:tour.components.title'),
        description: i18n.t('onboarding:tour.components.description'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="new-component-button"]',
      popover: {
        title: i18n.t('onboarding:tour.create.title'),
        description: i18n.t('onboarding:tour.create.description'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="projects-menu"]',
      popover: {
        title: i18n.t('onboarding:tour.projects.title'),
        description: i18n.t('onboarding:tour.projects.description'),
        side: 'bottom',
        align: 'start',
      },
    },
  ];
}

/**
 * @deprecated Use getTourSteps() instead
 */
export const tourSteps: DriveStep[] = [];
