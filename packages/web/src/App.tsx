import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ErrorFallback } from './components/common/ErrorFallback';
import { ElectronIpcBridge } from './components/ElectronIpcBridge';
import { RouteAnalyticsTracker } from './components/analytics/RouteAnalyticsTracker';
import { OfflineBanner } from './components/common/OfflineBanner';
import { SkipToContent } from './components/common/SkipToContent';
import { UpdateNotification } from './components/updater/UpdateNotification';
import { queryClient } from './common/lib/queryClient';
import { TourProvider, OnboardingTour } from './features/onboarding';
import { GlobalSearchProvider } from './features/global-search';
import { ThemeProvider } from './contexts/ThemeContext';
import * as settingsStorage from './features/settings-expansion/utils/settingsStorage';
import { FeedbackButton } from './features/feedback';

// Electron 환경 감지
const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
const isTeamFeatureEnabled = import.meta.env.VITE_ENABLE_TEAM_FEATURE === 'true';
const Router = isElectron ? HashRouter : BrowserRouter;

// 라우트 레벨 lazy loading
const DashboardPage = lazy(() =>
  import('./features/dashboard').then((m) => ({ default: m.DashboardPage }))
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
);
const ComponentListPage = lazy(() =>
  import('./features/component-list').then((m) => ({
    default: m.ComponentListPage,
  }))
);
const ComponentPresetsPage = lazy(() =>
  import('./pages/ComponentPresetsPage').then((m) => ({
    default: m.ComponentPresetsPage,
  }))
);
const ComponentPresetDetailPage = lazy(() =>
  import('./pages/ComponentPresetDetailPage').then((m) => ({
    default: m.ComponentPresetDetailPage,
  }))
);
const ComponentPresetEditPage = lazy(() =>
  import('./pages/ComponentPresetEditPage').then((m) => ({
    default: m.ComponentPresetEditPage,
  }))
);
const ComponentAnalysisPage = lazy(() =>
  import('./pages/ComponentAnalysisPage').then((m) => ({
    default: m.ComponentAnalysisPage,
  }))
);
const ComponentDetailPage = lazy(() =>
  import('./features/component-detail').then((m) => ({
    default: m.ComponentDetailPage,
  }))
);
const ComponentCreatePage = lazy(() =>
  import('./features/component-create').then((m) => ({
    default: m.ComponentCreatePage,
  }))
);
const ComponentEditPage = lazy(() =>
  import('./features/component-edit').then((m) => ({
    default: m.ComponentEditPage,
  }))
);
const DependencyGraphPage = lazy(() =>
  import('./features/dependency-graph').then((m) => ({
    default: m.DependencyGraphPage,
  }))
);
const TeamPage = lazy(() =>
  import('./features/team').then((m) => ({ default: m.TeamPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const LicensePage = lazy(() =>
  import('./features/license').then((m) => ({ default: m.LicensePage }))
);
const PricingPage = lazy(() =>
  import('./features/license').then((m) => ({ default: m.PricingPage }))
);
const CheckoutSuccessPage = lazy(() =>
  import('./features/license').then((m) => ({ default: m.CheckoutSuccessPage }))
);
const CheckoutCancelPage = lazy(() =>
  import('./features/license').then((m) => ({ default: m.CheckoutCancelPage }))
);
const BackupPage = lazy(() =>
  import('./features/backup').then((m) => ({ default: m.BackupPage }))
);
const ProjectDetailPage = lazy(() =>
  import('./features/project-detail').then((m) => ({
    default: m.ProjectDetailPage,
  }))
);
const TrashPage = lazy(() =>
  import('./features/trash').then((m) => ({ default: m.TrashPage }))
);

/** 라우트 로딩 시 표시할 최소한의 스켈레톤 */
function PageSkeleton() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        <p className="text-sm text-[var(--color-text-secondary)]">{t('loading')}</p>
      </div>
    </div>
  );
}

function LegacyRouteRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function AppContent() {
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-font-size',
      settingsStorage.getFontSize()
    );
  }, []);

  return (
    <ErrorBoundary
      fallback={(error, errorInfo) => (
        <ErrorFallback error={error} errorInfo={errorInfo} />
      )}
    >
      <QueryClientProvider client={queryClient}>
        <TourProvider>
          <SkipToContent />
          <OfflineBanner />
          <Toaster richColors position="top-right" offset="80px" />
          <UpdateNotification />
          <OnboardingTour />
          <Router>
            <RouteAnalyticsTracker />
            <ElectronIpcBridge />
            <GlobalSearchProvider>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route
                    path="/projects/usage"
                    element={<LegacyRouteRedirect to="/components/analysis" />}
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/data/backup" element={<BackupPage />} />
                  <Route
                    path="/settings/data/trash"
                    element={<LegacyRouteRedirect to="/components/trash" />}
                  />
                  {isTeamFeatureEnabled ? (
                    <Route path="/settings/team" element={<TeamPage />} />
                  ) : (
                    <Route
                      path="/settings/team"
                      element={<LegacyRouteRedirect to="/settings" />}
                    />
                  )}
                  <Route
                    path="/usage"
                    element={<LegacyRouteRedirect to="/components/analysis" />}
                  />
                  <Route path="/license" element={<LicensePage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                  <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
                  <Route
                    path="/backup"
                    element={<LegacyRouteRedirect to="/settings/data/backup" />}
                  />
                  <Route
                    path="/team"
                    element={
                      <LegacyRouteRedirect
                        to={isTeamFeatureEnabled ? '/settings/team' : '/settings'}
                      />
                    }
                  />
                  <Route
                    path="/projects/:id"
                    element={<ProjectDetailPage />}
                  />
                  <Route
                    path="/components/create"
                    element={<ComponentCreatePage />}
                  />
                  <Route
                    path="/components/:id/edit"
                    element={<ComponentEditPage />}
                  />
                  <Route
                    path="/components/:id"
                    element={<ComponentDetailPage />}
                  />
                  <Route
                    path="/components/presets"
                    element={<ComponentPresetsPage />}
                  />
                  <Route
                    path="/components/presets/:id"
                    element={<ComponentPresetDetailPage />}
                  />
                  <Route
                    path="/components/presets/:id/edit"
                    element={<ComponentPresetEditPage />}
                  />
                  <Route
                    path="/components/analysis"
                    element={<ComponentAnalysisPage />}
                  />
                  <Route path="/components" element={<ComponentListPage />} />
                  <Route
                    path="/components/dependencies"
                    element={<DependencyGraphPage />}
                  />
                  <Route
                    path="/dependencies"
                    element={<LegacyRouteRedirect to="/components/dependencies" />}
                  />
                  <Route path="/components/trash" element={<TrashPage />} />
                  <Route
                    path="/trash"
                    element={<LegacyRouteRedirect to="/components/trash" />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              <FeedbackButton />
            </GlobalSearchProvider>
          </Router>
        </TourProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
export { App };
