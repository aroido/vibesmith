/**
 * ComponentStatus unit tests
 * Spec: toggle-enhancement.md - 시각적 상태 표시
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ComponentStatus } from './ComponentStatus';

describe('ComponentStatus', () => {
  it('should render status icon when enabled', () => {
    render(<ComponentStatus enabled={true} />);

    const el = screen.getByLabelText('활성화됨');
    expect(el).toBeInTheDocument();
    expect(el.querySelector('svg')).toBeInTheDocument();
  });

  it('should render status icon when disabled', () => {
    render(<ComponentStatus enabled={false} />);

    const el = screen.getByLabelText('비활성화됨');
    expect(el).toBeInTheDocument();
    expect(el.querySelector('svg')).toBeInTheDocument();
  });
});
