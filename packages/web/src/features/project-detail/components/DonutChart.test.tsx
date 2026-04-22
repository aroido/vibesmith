// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DonutChart } from './DonutChart';

describe('DonutChart', () => {
  const segments = [
    { label: 'Skill', value: 10, color: 'var(--color-primary)' },
    { label: 'Agent', value: 5, color: 'var(--color-fg-tertiary)' },
    { label: 'Command', value: 3, color: 'var(--color-state-success)' },
  ];

  it('renders SVG with correct number of circle segments', () => {
    const { container } = render(<DonutChart segments={segments} size={120} />);
    const circles = container.querySelectorAll('circle[data-segment]');
    expect(circles).toHaveLength(3);
  });

  it('renders total count in center', () => {
    render(<DonutChart segments={segments} size={120} />);
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('renders nothing when all values are 0', () => {
    const empty = [{ label: 'A', value: 0, color: 'red' }];
    const { container } = render(<DonutChart segments={empty} size={120} />);
    const circles = container.querySelectorAll('circle[data-segment]');
    expect(circles).toHaveLength(0);
  });
});
