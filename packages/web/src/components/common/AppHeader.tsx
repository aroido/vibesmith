import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from './ThemeToggle';
import { AppTopNav, type AppTopNavSection } from './AppTopNav';
import { ThemeContext } from '@/contexts/theme-context';

interface AppHeaderProps {
  activeNav?: AppTopNavSection;
  logoExtra?: React.ReactNode;
}

export function AppHeader({ activeNav, logoExtra }: AppHeaderProps) {
  const { t } = useTranslation(['dashboard', 'navigation']);
  const themeContext = useContext(ThemeContext);
  const showStyleTicker = (themeContext?.stylePreset ?? 'classic') !== 'classic';
  const tickerItems = [
    t('dashboard:header.ticker.localFirst'),
    t('dashboard:header.ticker.multiAgent'),
    t('dashboard:header.ticker.dependency'),
    t('dashboard:header.ticker.release'),
    t('dashboard:header.ticker.recovery'),
  ];

  return (
    <>
      {showStyleTicker && (
        <div className="vs-theme-ticker" aria-hidden>
          <div className="vs-theme-ticker-track">
            {Array.from({ length: 2 }).flatMap((_, groupIndex) =>
              tickerItems.map((item, itemIndex) => (
                <span key={`${groupIndex}-${itemIndex}`}>{item}</span>
              ))
            )}
          </div>
        </div>
      )}
      <header className="vs-app-header sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-header-bg)]/95 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="mx-auto flex w-full max-w-[88rem] items-center gap-4">
          <Link
            to="/"
            data-testid="header-home-link"
            className="group flex shrink-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(145deg,var(--color-primary),var(--color-state-warning))] shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-theme-primary transition-colors">
                VibeSmith
              </h1>
              <p className="hidden text-xs font-mono text-theme-secondary lg:block">
                {t('dashboard:header.title')}
              </p>
            </div>
          </Link>

          {logoExtra && (
            <div className="flex shrink-0 items-center gap-2">
              {logoExtra}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {activeNav && (
              <AppTopNav
                active={activeNav}
                className="ml-auto w-full max-w-[56rem] justify-start md:justify-end"
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
