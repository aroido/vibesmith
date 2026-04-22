import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDependencyDetail } from '../hooks/useDependencyDetail';
import { NodeDetailPanel } from './NodeDetailPanel';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useDependencyDetail', () => ({
  useDependencyDetail: vi.fn(),
}));

describe('NodeDetailPanel', () => {
  const mockedUseDependencyDetail = vi.mocked(useDependencyDetail);

  beforeEach(() => {
    mockNavigate.mockReset();
    mockedUseDependencyDetail.mockReturnValue({
      data: {
        depends_on: [],
        depended_by: [],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useDependencyDetail>);
  });

  it('uses router navigation when clicking View Details', async () => {
    const user = userEvent.setup();

    render(
      <NodeDetailPanel
        nodeId="node-42"
        onClose={vi.fn()}
        onNodeSelect={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /상세 보기|View Details/i,
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith('/components/node-42');
  });
});
