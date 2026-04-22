/**
 * CopyToProjectModal unit tests
 * Spec: component-copy-api.md §9 Acceptance Criteria
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { CopyToProjectModal } from './CopyToProjectModal';

const mockProjects = [
  {
    id: 'proj_source',
    name: 'vibesmith',
    path: '/Users/user/Projects/vibesmith',
    is_global: false,
    component_count: 12,
  },
  {
    id: 'proj_target',
    name: 'other-project',
    path: '/Users/user/Projects/other-project',
    is_global: false,
    component_count: 5,
  },
  {
    id: 'proj_global',
    name: 'global',
    path: '/Users/user/.claude',
    is_global: true,
    component_count: 3,
  },
];

const mockCopyResponse = {
  copied: [
    {
      original_id: 'comp_001',
      new_id: 'comp_copy_001',
      name: 'fastapi-route',
      type: 'skill',
    },
  ],
};

const server = setupServer(
  http.get('*/api/projects', () => HttpResponse.json(mockProjects)),
  http.post('*/api/components/:id/copy', async ({ request }) => {
    const body = (await request.json()) as {
      target_project_id: string;
      include_dependencies?: boolean;
    };
    if (body.target_project_id === 'proj_collision') {
      return HttpResponse.json(
        { detail: '대상 프로젝트에 동일 이름 구성요소가 이미 존재합니다' },
        { status: 400 }
      );
    }
    return HttpResponse.json(mockCopyResponse, { status: 201 });
  })
);

function renderModal(
  props: Partial<React.ComponentProps<typeof CopyToProjectModal>> = {}
) {
  const defaultProps = {
    isOpen: true,
    componentId: 'comp_001',
    componentName: 'fastapi-route',
    sourceProjectId: 'proj_source',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...props,
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CopyToProjectModal {...defaultProps} />
    </QueryClientProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('ko');
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('CopyToProjectModal', () => {
  it('should render project list in dropdown', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    const select = screen.getByLabelText(/대상 프로젝트 선택|Select target project/);
    expect(select).toBeInTheDocument();

    const options = Array.from(select.querySelectorAll('option')).filter(
      (o) => o.value !== ''
    );
    expect(options).toHaveLength(2); // source excluded
    expect(options.map((o) => o.value)).toContain('proj_target');
    expect(options.map((o) => o.value)).toContain('proj_global');
    expect(options.map((o) => o.value)).not.toContain('proj_source');
  });

  it('should exclude source project from options', async () => {
    renderModal({ sourceProjectId: 'proj_source' });

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    const select = screen.getByLabelText(/대상 프로젝트 선택|Select target project/);
    const options = Array.from(select.querySelectorAll('option')).filter(
      (o) => o.value !== ''
    );

    const projectIds = options.map((o) => o.value);
    expect(projectIds).not.toContain('proj_source');
    expect(projectIds).toContain('proj_target');
    expect(projectIds).toContain('proj_global');
  });

  it('should toggle include dependencies checkbox', async () => {
    const user = userEvent.setup();
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    const checkbox = screen.getByLabelText(/종속성 포함|Include Dependencies/);
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('should call onSuccess when copy succeeds', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderModal({ onSuccess, onClose });

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    await user.selectOptions(
      screen.getByLabelText(/대상 프로젝트 선택|Select target project/),
      'proj_target'
    );
    await user.click(screen.getByRole('button', { name: /복사|Copy/ }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockCopyResponse);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('should show loading state while copying', async () => {
    let resolveCopy: () => void = () => {};
    const copyPromise = new Promise<void>((resolve) => {
      resolveCopy = resolve;
    });

    server.use(
      http.post('*/api/components/:id/copy', async () => {
        await copyPromise;
        return HttpResponse.json(mockCopyResponse, { status: 201 });
      })
    );

    const user = userEvent.setup();
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    await user.selectOptions(
      screen.getByLabelText(/대상 프로젝트 선택|Select target project/),
      'proj_target'
    );
    await user.click(screen.getByRole('button', { name: /복사|Copy/ }));

    expect(screen.getByRole('button', { name: /복사 중|Copying/ })).toBeDisabled();

    resolveCopy();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /복사 중|Copying/ })
      ).not.toBeInTheDocument();
    });
  });

  it('should display error message on 400', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/components/:id/copy', () =>
        HttpResponse.json(
          { detail: '대상 프로젝트에 동일 이름 구성요소가 이미 존재합니다' },
          { status: 400 }
        )
      )
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText(/대상 프로젝트 선택|Select target project/)).not.toBeDisabled();
    });

    await user.selectOptions(
      screen.getByLabelText(/대상 프로젝트 선택|Select target project/),
      'proj_target'
    );
    await user.click(screen.getByRole('button', { name: /복사|Copy/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/대상 프로젝트에 동일 이름 구성요소가 이미 존재합니다/)
      ).toBeInTheDocument();
    });
  });

  it('should show "복사할 프로젝트가 없습니다" when no projects available', async () => {
    server.use(
      http.get('*/api/projects', () => HttpResponse.json([mockProjects[0]]))
    );

    renderModal({ sourceProjectId: 'proj_source' });

    await waitFor(() => {
      expect(
        screen.getByText(/복사할 프로젝트가 없습니다/)
      ).toBeInTheDocument();
    });

    const copyButton = screen.getByRole('button', { name: /복사|Copy/ });
    expect(copyButton).toBeDisabled();
  });

  it('should not render when isOpen is false', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should call onClose when cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderModal({ onClose });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /취소|Cancel/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /취소|Cancel/ }));

    expect(onClose).toHaveBeenCalled();
  });
});
