/**
 * SearchInput Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('renders search input', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText('검색어 입력')).toBeInTheDocument();
    expect(screen.getByText('검색')).toBeInTheDocument();
  });

  it('does not call onChange on initial mount', async () => {
    const onChange = vi.fn();

    render(<SearchInput value="" onChange={onChange} debounceMs={100} />);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('displays placeholder', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="테스트 플레이스홀더"
      />
    );

    expect(
      screen.getByPlaceholderText('테스트 플레이스홀더')
    ).toBeInTheDocument();
  });

  it('calls onChange with debounce', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SearchInput value="" onChange={onChange} debounceMs={100} />);

    const input = screen.getByLabelText('검색어 입력');
    await user.type(input, 'test');

    // Should not call immediately
    expect(onChange).not.toHaveBeenCalled();

    // Should call after debounce
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith('test');
      },
      { timeout: 200 }
    );
  });

  it('shows clear button when value is not empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SearchInput value="" onChange={onChange} />);

    const input = screen.getByLabelText('검색어 입력');
    await user.type(input, 'test');

    await waitFor(() => {
      expect(screen.getByLabelText('검색어 지우기')).toBeInTheDocument();
    });
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <SearchInput value="test" onChange={onChange} />
    );

    const clearButton = screen.getByLabelText('검색어 지우기');
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith('');

    // Simulate parent updating value
    rerender(<SearchInput value="" onChange={onChange} />);

    expect(screen.queryByLabelText('검색어 지우기')).not.toBeInTheDocument();
  });

  it('syncs with external value changes', () => {
    const { rerender } = render(
      <SearchInput value="initial" onChange={vi.fn()} />
    );

    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

    rerender(<SearchInput value="updated" onChange={vi.fn()} />);

    expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
  });
});
