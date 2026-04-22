import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ComponentWorkspaceTabs } from './ComponentWorkspaceTabs';

function renderTabs(active: 'list' | 'dependencies' | 'presets' | 'analysis') {
  return render(
    <MemoryRouter>
      <ComponentWorkspaceTabs active={active} />
    </MemoryRouter>
  );
}

describe('ComponentWorkspaceTabs', () => {
  it('renders all workspace links', () => {
    renderTabs('list');

    expect(screen.getByRole('link', { name: /목록|List/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /의존성 그래프|Dependency Graph/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /프리셋|Presets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /분석|Analysis/i })).toBeInTheDocument();
  });

  it('sets aria-current for active tab', () => {
    renderTabs('analysis');

    const analysisTab = screen.getByRole('link', { name: /분석|Analysis/i });
    expect(analysisTab).toHaveAttribute('aria-current', 'page');
  });
});
