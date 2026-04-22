import type { ReactNode } from 'react';
import type { AppTopNavSection } from './AppTopNav';
import { AppHeader } from './AppHeader';

interface PageFrameProps {
  activeNav: AppTopNavSection;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  /** title 영역 위에 렌더링할 콘텐츠 */
  beforeTitle?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  mainClassName?: string;
}

export function PageFrame({
  activeNav,
  title,
  subtitle,
  actions,
  status,
  beforeTitle,
  children,
  contentClassName = 'max-w-[88rem] mx-auto',
  mainClassName = 'min-h-screen bg-[var(--color-background)] text-theme-primary p-4 md:p-6',
}: PageFrameProps) {
  const hasPageHeading = Boolean(title);
  const showInlineActions = !hasPageHeading && Boolean(actions);
  const hasUtilityHeader = showInlineActions || hasPageHeading || Boolean(status);

  return (
    <>
      <AppHeader activeNav={activeNav} />
      <main id="main-content" className={mainClassName} role="main">
        <div className={contentClassName}>
          {beforeTitle}
          {hasUtilityHeader && (
            <header className="mb-6 space-y-4">
              {showInlineActions && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {actions}
                </div>
              )}

              {hasPageHeading && (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold font-display text-theme-primary tracking-[-0.02em]">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="mt-2 text-sm text-theme-secondary font-mono">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
              )}

              {status}
            </header>
          )}

          {children}
        </div>
      </main>
    </>
  );
}
