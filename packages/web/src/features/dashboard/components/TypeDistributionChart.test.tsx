/**
 * TypeDistributionChart tests
 * Issue #900: Korean legend wrap stabilization
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { TypeDistributionChart } from './TypeDistributionChart';
import type { DashboardStats } from '../types';

const mockStats: DashboardStats = {
  totalSkills: 44,
  totalAgents: 11,
  totalCommands: 13,
  totalHooks: 3,
  totalRules: 103,
  activeCount: 171,
  inactiveCount: 3,
  totalCount: 174,
  trends: {
    skills: { value: 0, percentage: 0, direction: 'neutral' },
    agents: { value: 0, percentage: 0, direction: 'neutral' },
    commands: { value: 0, percentage: 0, direction: 'neutral' },
    hooks: { value: 0, percentage: 0, direction: 'neutral' },
    rules: { value: 0, percentage: 0, direction: 'neutral' },
  },
};

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('TypeDistributionChart', () => {
  it('applies keep-all wrap policy to Korean legend labels', () => {
    render(<TypeDistributionChart stats={mockStats} />);

    const labels = ['스킬', '에이전트', '커맨드', '훅', '룰'];
    for (const label of labels) {
      const labelElement = screen.getByText(label);
      expect(labelElement).toHaveClass('break-keep');
      expect(labelElement).toHaveClass('whitespace-nowrap');
    }
  });

  it('renders percentage texts fully for legend values', () => {
    render(<TypeDistributionChart stats={mockStats} />);

    expect(screen.getByText('(25.3%)')).toBeInTheDocument();
    expect(screen.getByText('(59.2%)')).toBeInTheDocument();
  });
});
