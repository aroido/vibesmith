import { useRef, type KeyboardEvent } from 'react';
import {
  Boxes,
  FolderOpen,
  Home,
  Settings2,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScanProgressIndicator } from '@/features/scan/components/ScanProgressIndicator';

export type AppTopNavSection =
  | 'home'
  | 'projects'
  | 'components'
  | 'settings';

interface AppTopNavProps {
  active?: AppTopNavSection;
  className?: string;
}

const NAV_IDS: AppTopNavSection[] = ['home', 'projects', 'components', 'settings'];

const NAV_CONFIG: Record<
  AppTopNavSection,
  { to: string; icon: typeof Home; dataTour?: string }
> = {
  home: { to: '/', icon: Home },
  projects: { to: '/projects', icon: FolderOpen, dataTour: 'projects-menu' },
  components: { to: '/components', icon: Boxes, dataTour: 'components-menu' },
  settings: { to: '/settings', icon: Settings2, dataTour: 'settings-button' },
};

function inferActiveSection(pathname: string): AppTopNavSection {
  if (pathname === '/') return 'home';
  if (pathname === '/projects/usage' || pathname.startsWith('/usage')) {
    return 'components';
  }
  if (
    pathname === '/projects' ||
    pathname.startsWith('/projects/')
  ) {
    return 'projects';
  }
  if (pathname.startsWith('/components')) return 'components';
  if (pathname.startsWith('/dependencies')) return 'components';
  if (
    pathname.startsWith('/team') ||
    pathname.startsWith('/backup') ||
    pathname.startsWith('/trash') ||
    pathname.startsWith('/license') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/checkout/')
  ) {
    return 'settings';
  }
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

export function AppTopNav({ active, className = '' }: AppTopNavProps) {
  const { t } = useTranslation('navigation');
  const { pathname } = useLocation();
  const current = active ?? inferActiveSection(pathname);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const handleNavKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number
  ) => {
    const lastIndex = NAV_IDS.length - 1;
    let nextIndex = index;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    if (nextIndex !== index) {
      event.preventDefault();
      linkRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <nav
      className={`inline-flex max-w-full flex-nowrap gap-2 overflow-x-auto rounded-2xl bg-transparent p-0 md:flex-wrap md:overflow-visible ${className}`}
      aria-label={t('mainMenu')}
    >
      <ScanProgressIndicator />
      {NAV_IDS.map((id, index) => {
        const isActive = id === current;
        const { icon: Icon, to, dataTour } = NAV_CONFIG[id];
        const label = t(`primary.${id}`);
        return (
          <Link
            key={id}
            ref={(node) => {
              linkRefs.current[index] = node;
            }}
            to={to}
            onKeyDown={(event) => handleNavKeyDown(event, index)}
            data-testid={`nav-${id}-link`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            data-tour={dataTour}
            className={`inline-flex h-11 min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] ${
              isActive
                ? 'border-[var(--color-primary)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary)_16%,transparent),color-mix(in_srgb,var(--color-surface)_92%,transparent))] text-[var(--color-text-primary)] shadow-[0_8px_18px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]'
                : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:-translate-y-[1px] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
