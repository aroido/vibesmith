/**
 * ConflictBadgeWidget unit tests
 * Issue #159
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictBadgeWidget } from '../components/ConflictBadgeWidget';
import * as api from '../services/api';
import type { Conflict } from '../types';

vi.mock('../services/api');

const mockConflicts: Conflict[] = [
  {
    id: 'conflict_1',
    name: 'git-commit',
    type: 'skill',
    globalComponentId: 'comp_global_1',
    projectComponentId: 'comp_proj_1',
    projectName: 'vibesmith',
    priority: 'project',
    isIntentional: false,
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ConflictBadgeWidget', () => {
  beforeEach(() => {
    vi.mocked(api.getConflicts).mockResolvedValue(mockConflicts);
  });

  it('should render loading state initially', () => {
    const { container } = render(<ConflictBadgeWidget />, {
      wrapper: createWrapper(),
    });
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('should render conflict badge when conflicts exist', async () => {
    const { container } = render(<ConflictBadgeWidget />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(api.getConflicts).toHaveBeenCalled();
    });

    await waitFor(() => {
      const section = container.querySelector('section[aria-label*="충돌"]');
      expect(section).toBeInTheDocument();
    });
  });

  it('should open modal when View button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<ConflictBadgeWidget />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(api.getConflicts).toHaveBeenCalled();
    });

    await waitFor(() => {
      const button = container.querySelector('button[aria-label*="보기"]');
      expect(button).toBeInTheDocument();
    });

    const button = container.querySelector('button[aria-label*="보기"]');
    if (button) {
      await user.click(button as HTMLElement);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    }
  });

  it('should return null when no conflicts', async () => {
    vi.mocked(api.getConflicts).mockResolvedValue([]);

    const { container } = render(<ConflictBadgeWidget />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(api.getConflicts).toHaveBeenCalled();
    });

    await waitFor(() => {
      const section = container.querySelector('section');
      expect(section).not.toBeInTheDocument();
    });
  });
});
