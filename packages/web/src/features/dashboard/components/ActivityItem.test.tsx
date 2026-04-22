/**
 * ActivityItem unit tests
 * Rendering, scope display, live indicator
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../../i18n';
import { axe } from 'jest-axe';
import { ActivityItem } from './ActivityItem';
import type { Component } from '../types';

function createComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: 'comp_001',
    name: 'git-commit',
    type: 'skill',
    scope: 'global',
    isActive: true,
    lastUsed: new Date('2026-02-12T10:00:00Z'),
    path: '~/.cursor/skills/git-commit',
    ...overrides,
  };
}

describe('ActivityItem', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should render component name', () => {
    const component = createComponent({ name: 'git-commit' });
    render(<ActivityItem component={component} />);
    expect(screen.getByText('git-commit')).toBeInTheDocument();
  });

  it('should display type badge', () => {
    const component = createComponent({ type: 'skill' });
    render(<ActivityItem component={component} />);
    expect(screen.getByText('skill')).toBeInTheDocument();
  });

  it('should display Global for global scope', () => {
    const component = createComponent({ scope: 'global' });
    render(<ActivityItem component={component} />);
    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('should display project name for project scope', () => {
    const component = createComponent({
      scope: 'project',
      projectName: 'vibesmith',
    });
    render(<ActivityItem component={component} />);
    expect(screen.getByText('vibesmith')).toBeInTheDocument();
  });

  it('should display Never when lastUsed is undefined', () => {
    const component = createComponent({ lastUsed: undefined });
    render(<ActivityItem component={component} />);
    expect(screen.getByText(/Never|없음/)).toBeInTheDocument();
  });

  it('should display live indicator when isLive is true', () => {
    const component = createComponent();
    const { container } = render(
      <ActivityItem component={component} isLive={true} />
    );
    const dot = container.querySelector('.bg-theme-success');
    expect(dot).toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const component = createComponent();
    const { container } = render(<ActivityItem component={component} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
