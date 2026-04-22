/**
 * TagFilter Component Tests
 * 다중 태그 선택, 자동완성
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';
import { TagFilter } from './TagFilter';
import * as commonApi from '@/common/api';

vi.mock('@/common/api', async (importOriginal) => {
  const actual = await importOriginal() as object;
  return {
    ...actual,
    getAvailableTags: vi.fn(),
  };
});

const mockTags: Array<{ name: string; count: number }> = [
  { name: 'python', count: 15 },
  { name: 'react', count: 10 },
  { name: 'fastapi', count: 8 },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('TagFilter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
    vi.mocked(commonApi.getAvailableTags).mockResolvedValue(mockTags);
  });

  it('renders tag search input', async () => {
    renderWithQueryClient(
      <TagFilter
        selectedTags={[]}
        onTagsChange={vi.fn()}
        tagFilterMode="or"
        onTagFilterModeChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('태그 검색')).toBeInTheDocument();
    expect(screen.getByText('태그')).toBeInTheDocument();
  });

  it('shows suggestions when typing', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <TagFilter
        selectedTags={[]}
        onTagsChange={vi.fn()}
        tagFilterMode="or"
        onTagFilterModeChange={vi.fn()}
      />
    );

    await waitFor(() => expect(commonApi.getAvailableTags).toHaveBeenCalled());

    const input = screen.getByLabelText('태그 검색');
    await user.click(input);
    await user.type(input, 'py');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText(/python/)).toBeInTheDocument();
    });
  });

  it('calls onTagsChange when adding tag from suggestion', async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    renderWithQueryClient(
      <TagFilter
        selectedTags={[]}
        onTagsChange={onTagsChange}
        tagFilterMode="or"
        onTagFilterModeChange={vi.fn()}
      />
    );

    await waitFor(() => expect(commonApi.getAvailableTags).toHaveBeenCalled());

    const input = screen.getByLabelText('태그 검색');
    await user.click(input);
    await user.type(input, 'python');

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    const option = screen.getByRole('option', { name: /python/ });
    await user.click(option);

    expect(onTagsChange).toHaveBeenCalledWith(['python']);
  });

  it('shows AND/OR toggle when multiple tags selected', async () => {
    renderWithQueryClient(
      <TagFilter
        selectedTags={['python', 'react']}
        onTagsChange={vi.fn()}
        tagFilterMode="or"
        onTagFilterModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('OR (하나라도)')).toBeInTheDocument();
    expect(screen.getByText('AND (모두)')).toBeInTheDocument();
  });
});
