import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'jest-axe';
import App from './App';

const isTeamFeatureEnabled = import.meta.env.VITE_ENABLE_TEAM_FEATURE === 'true';

function renderAt(pathname = '/') {
  window.history.pushState({}, '', pathname);
  return render(<App />);
}

describe('App', () => {
  it('renders without crashing', async () => {
    const { container } = renderAt('/');
    // 앱이 렌더링되는지만 확인 (특정 요소에 의존하지 않음)
    expect(container).toBeInTheDocument();
    
    // 초기 로딩/실패 상태와 무관하게 메인 랜드마크가 렌더링되는지 확인
    await waitFor(
      () => {
        const main = container.querySelector('[role="main"]');
        expect(main).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
  });

  it('redirects /usage to component analysis workspace', async () => {
    renderAt('/usage');

    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/components/analysis');
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /컴포넌트 분석|Component Analysis/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('redirects /projects/usage to component analysis workspace', async () => {
    renderAt('/projects/usage');

    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/components/analysis');
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /컴포넌트 분석|Component Analysis/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders projects workspace at /projects', async () => {
    renderAt('/projects');

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /프로젝트|Projects/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders component presets workspace at /components/presets', async () => {
    renderAt('/components/presets');

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /프리셋 워크스페이스|Preset Workspace/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders components workspace at /components', async () => {
    renderAt('/components');

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /구성요소|Components/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders component analysis workspace at /components/analysis', async () => {
    renderAt('/components/analysis');

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /컴포넌트 분석|Component Analysis/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders dependency graph workspace at /components/dependencies', async () => {
    renderAt('/components/dependencies');

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /의존성 그래프|Dependency Graph/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('handles /team route based on feature flag', async () => {
    renderAt('/team');

    await waitFor(
      () => {
        if (isTeamFeatureEnabled) {
          expect(window.location.pathname).toBe('/settings/team');
          expect(
            screen.getByRole('heading', {
              level: 1,
              name: /팀|Team/i,
            })
          ).toBeInTheDocument();
          return;
        }

        expect(window.location.pathname).toBe('/settings');
      },
      { timeout: 3000 }
    );
  });

  it('renders backup page when navigating to /backup', async () => {
    renderAt('/backup');

    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/settings/data/backup');
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /백업|Backups/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('renders trash page when navigating to /trash', async () => {
    renderAt('/trash');

    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/components/trash');
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: /휴지통|Trash/i,
          })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('redirects unknown routes to dashboard', async () => {
    renderAt('/not-a-real-route');

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('should not have accessibility violations', async () => {
    const { container } = renderAt('/');
    
    // 앱이 로드될 때까지 대기
    await waitFor(
      () => {
        const main = container.querySelector('[role="main"]');
        expect(main).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
    
    const results = await axe(container);
    const actionableViolations = results.violations.filter(
      (violation) => violation.id !== 'landmark-no-duplicate-banner',
    );
    expect(actionableViolations).toHaveLength(0);
  });
});
