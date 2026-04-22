import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppTopNav } from './AppTopNav';

vi.mock('@/features/scan/components/ScanProgressIndicator', () => ({
  ScanProgressIndicator: () => null,
}));

function renderNav(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppTopNav />
    </MemoryRouter>
  );
}

describe('AppTopNav', () => {
  it('renders 4 top-level tabs', () => {
    renderNav('/');

    expect(screen.getByTestId('nav-home-link')).toBeInTheDocument();
    expect(screen.getByTestId('nav-projects-link')).toBeInTheDocument();
    expect(screen.getByTestId('nav-components-link')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings-link')).toBeInTheDocument();
  });

  it('maps legacy settings routes to settings active tab', () => {
    renderNav('/backup');

    expect(screen.getByTestId('nav-settings-link')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('maps project detail routes to projects active tab', () => {
    renderNav('/projects/abc123');

    expect(screen.getByTestId('nav-projects-link')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('maps legacy usage routes to components active tab', () => {
    renderNav('/projects/usage');

    expect(screen.getByTestId('nav-components-link')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('supports arrow-key navigation between tabs', () => {
    renderNav('/');

    const homeLink = screen.getByTestId('nav-home-link');
    const projectsLink = screen.getByTestId('nav-projects-link');

    homeLink.focus();
    fireEvent.keyDown(homeLink, { key: 'ArrowRight' });

    expect(projectsLink).toHaveFocus();
  });
});
