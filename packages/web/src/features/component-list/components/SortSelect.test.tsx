/**
 * SortSelect 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortSelect } from './SortSelect';

describe('SortSelect', () => {
  it('현재 선택된 정렬 옵션을 표시한다', () => {
    render(<SortSelect value="name-asc" onChange={vi.fn()} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('name-asc');
  });

  it('정렬 옵션 변경 시 onChange를 호출한다', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<SortSelect value="name-asc" onChange={handleChange} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'date-desc');

    expect(handleChange).toHaveBeenCalledWith('date-desc');
  });

  it('4가지 정렬 옵션을 제공한다', () => {
    render(<SortSelect value="name-asc" onChange={vi.fn()} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveValue('name-asc');
    expect(options[1]).toHaveValue('name-desc');
    expect(options[2]).toHaveValue('date-asc');
    expect(options[3]).toHaveValue('date-desc');
  });
});
