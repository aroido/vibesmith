import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import i18n from '@/i18n';
import { TreeFilters } from './TreeFilters';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const defaultProps = {
  projects: [
    { id: 'p1', name: 'Project A', isGlobal: false },
    { id: 'p2', name: 'Global', isGlobal: true },
  ],
  selectedProjectId: null as string | null,
  onProjectChange: vi.fn(),
  selectedPlatform: 'all' as const,
  onPlatformChange: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  hideDisabled: false,
  onHideDisabledChange: vi.fn(),
  riskOnly: false,
  onRiskOnlyChange: vi.fn(),
  cycleCount: 0,
  brokenCount: 0,
};

function renderFilters(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mocks for each render
  Object.values(props).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) {
      (v as ReturnType<typeof vi.fn>).mockClear();
    }
  });
  return render(<TreeFilters {...props} />);
}

describe('TreeFilters', () => {
  describe('search input', () => {
    it('renders a search input with placeholder', () => {
      renderFilters();
      const input = screen.getByPlaceholderText('name or id');
      expect(input).toBeInTheDocument();
    });

    it('displays the current search query', () => {
      renderFilters({ searchQuery: 'hello' });
      const input = screen.getByPlaceholderText('name or id') as HTMLInputElement;
      expect(input.value).toBe('hello');
    });

    it('calls onSearchChange when typing', async () => {
      const onSearchChange = vi.fn();
      renderFilters({ onSearchChange });
      const input = screen.getByPlaceholderText('name or id');
      await userEvent.type(input, 'a');
      expect(onSearchChange).toHaveBeenCalledWith('a');
    });
  });

  describe('hideDisabled toggle', () => {
    it('renders the hide disabled checkbox', () => {
      renderFilters();
      expect(screen.getByLabelText('Hide disabled nodes')).toBeInTheDocument();
    });

    it('reflects hideDisabled state', () => {
      renderFilters({ hideDisabled: true });
      const checkbox = screen.getByLabelText('Hide disabled nodes') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('calls onHideDisabledChange when toggled', async () => {
      const onHideDisabledChange = vi.fn();
      renderFilters({ onHideDisabledChange, hideDisabled: false });
      await userEvent.click(screen.getByLabelText('Hide disabled nodes'));
      expect(onHideDisabledChange).toHaveBeenCalledWith(true);
    });
  });

  describe('riskOnly toggle', () => {
    it('renders the risk only checkbox', () => {
      renderFilters();
      expect(screen.getByLabelText('Risk only')).toBeInTheDocument();
    });

    it('reflects riskOnly state', () => {
      renderFilters({ riskOnly: true });
      const checkbox = screen.getByLabelText('Risk only') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('calls onRiskOnlyChange when toggled', async () => {
      const onRiskOnlyChange = vi.fn();
      renderFilters({ onRiskOnlyChange, riskOnly: false });
      await userEvent.click(screen.getByLabelText('Risk only'));
      expect(onRiskOnlyChange).toHaveBeenCalledWith(true);
    });
  });

  describe('risk badges', () => {
    it('does not show badges when counts are 0', () => {
      renderFilters({ cycleCount: 0, brokenCount: 0 });
      expect(screen.queryByText(/Circular Dependencies/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Broken References/)).not.toBeInTheDocument();
    });

    it('shows cycle badge when cycleCount > 0', () => {
      renderFilters({ cycleCount: 3 });
      expect(screen.getByText('3 Circular Dependencies')).toBeInTheDocument();
    });

    it('shows broken badge when brokenCount > 0', () => {
      renderFilters({ brokenCount: 2 });
      expect(screen.getByText('2 Broken References')).toBeInTheDocument();
    });

    it('shows both badges when both counts > 0', () => {
      renderFilters({ cycleCount: 1, brokenCount: 5 });
      expect(screen.getByText('1 Circular Dependencies')).toBeInTheDocument();
      expect(screen.getByText('5 Broken References')).toBeInTheDocument();
    });
  });
});
