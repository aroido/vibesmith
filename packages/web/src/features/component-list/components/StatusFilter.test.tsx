/**
 * StatusFilter unit tests
 * Spec: toggle-enhancement.md Appendix B.1
 * - 옵션 렌더링 (모든 상태, 활성화됨, 비활성화됨)
 * - onChange 호출
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'jest-axe';
import { StatusFilter } from './StatusFilter';

describe('StatusFilter', () => {
  it('should render all options', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);

    expect(screen.getByLabelText('활성화 상태 필터')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '모든 상태' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '활성화됨' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '비활성화됨' })).toBeInTheDocument();
  });

  it('should call onChange when option selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);

    const select = screen.getByLabelText('활성화 상태 필터');
    await user.selectOptions(select, 'enabled');

    expect(onChange).toHaveBeenCalledWith('enabled');
  });

  it('should call onChange with disabled when 비활성화됨 selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('활성화 상태 필터'), 'disabled');

    expect(onChange).toHaveBeenCalledWith('disabled');
  });

  it('should display current value as selected', () => {
    render(<StatusFilter value="enabled" onChange={vi.fn()} />);

    const select = screen.getByLabelText('활성화 상태 필터');
    expect(select).toHaveValue('enabled');
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <StatusFilter value="all" onChange={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
