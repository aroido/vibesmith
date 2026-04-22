/**
 * i18n 초기화 (i18n.md spec)
 * 기본 언어: ko, fallback: en
 * localStorage key: vibesmith-locale
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from './locales/ko/common.json';
import koNavigation from './locales/ko/navigation.json';
import koDashboard from './locales/ko/dashboard.json';
import koComponents from './locales/ko/components.json';
import koSettings from './locales/ko/settings.json';
import koTrash from './locales/ko/trash.json';
import koBackup from './locales/ko/backup.json';
import koDependencyGraph from './locales/ko/dependencyGraph.json';
import koScan from './locales/ko/scan.json';
import koProjectDetail from './locales/ko/projectDetail.json';
import koGlobalSearch from './locales/ko/globalSearch.json';
import koOnboarding from './locales/ko/onboarding.json';
import koFeedback from './locales/ko/feedback.json';
import koLicense from './locales/ko/license.json';
import koTeam from './locales/ko/team.json';
import koOmnibox from '../features/omnibox/locales/ko.json';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enDashboard from './locales/en/dashboard.json';
import enComponents from './locales/en/components.json';
import enSettings from './locales/en/settings.json';
import enTrash from './locales/en/trash.json';
import enBackup from './locales/en/backup.json';
import enDependencyGraph from './locales/en/dependencyGraph.json';
import enScan from './locales/en/scan.json';
import enProjectDetail from './locales/en/projectDetail.json';
import enGlobalSearch from './locales/en/globalSearch.json';
import enOnboarding from './locales/en/onboarding.json';
import enFeedback from './locales/en/feedback.json';
import enLicense from './locales/en/license.json';
import enTeam from './locales/en/team.json';
import enOmnibox from '../features/omnibox/locales/en.json';

const STORAGE_KEY = 'vibesmith-locale';
const SUPPORTED: readonly ['ko', 'en'] = ['ko', 'en'];

export type SupportedLocale = (typeof SUPPORTED)[number];

function getStoredLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'ko';
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return 'ko';
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === 'ko' || stored === 'en') return stored;
  return 'ko';
}

function persistLocale(lng: string): void {
  if (typeof window === 'undefined') return;
  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== 'function') return;
  storage.setItem(STORAGE_KEY, lng);
}

void i18n.use(initReactI18next).init({
  resources: {
    ko: {
      common: koCommon,
      navigation: koNavigation,
      dashboard: koDashboard,
      components: koComponents,
      settings: koSettings,
      trash: koTrash,
      backup: koBackup,
      dependencyGraph: koDependencyGraph,
      scan: koScan,
      projectDetail: koProjectDetail,
      globalSearch: koGlobalSearch,
      onboarding: koOnboarding,
      feedback: koFeedback,
      license: koLicense,
      team: koTeam,
      omnibox: koOmnibox,
    },
    en: {
      common: enCommon,
      navigation: enNavigation,
      dashboard: enDashboard,
      components: enComponents,
      settings: enSettings,
      trash: enTrash,
      backup: enBackup,
      dependencyGraph: enDependencyGraph,
      scan: enScan,
      projectDetail: enProjectDetail,
      globalSearch: enGlobalSearch,
      onboarding: enOnboarding,
      feedback: enFeedback,
      license: enLicense,
      team: enTeam,
      omnibox: enOmnibox,
    },
  },
  lng: getStoredLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common',
    'navigation',
    'dashboard',
    'components',
    'settings',
    'trash',
    'backup',
    'dependencyGraph',
    'scan',
    'projectDetail',
    'globalSearch',
    'onboarding',
    'feedback',
    'license',
    'team',
    'omnibox',
  ],
  interpolation: {
    escapeValue: false,
  },
  debug: import.meta.env.DEV,
  react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', (lng) => {
  persistLocale(lng);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

// 초기 HTML lang 설정
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
}

/** 현재 locale (API 헤더 등에서 사용) */
export function getCurrentLocale(): string {
  return i18n.language;
}

/** 지원 언어 목록 */
export const SUPPORTED_LOCALES = SUPPORTED;

/** localStorage 키 (테스트용) */
export { STORAGE_KEY };

/** i18n 인스턴스 (기본 export) */
export default i18n;
