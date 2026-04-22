/**
 * ComponentTypeDisplay unit tests
 * Spec Appendix B - 읽기 전용 표시
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ComponentTypeDisplay } from './ComponentTypeDisplay';

describe('ComponentTypeDisplay', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should render skill type', () => {
    render(<ComponentTypeDisplay type="skill" />);
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByText(/Component Type/i)).toBeInTheDocument();
  });

  it('should render agent type', () => {
    render(<ComponentTypeDisplay type="agent" />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('should render command type', () => {
    render(<ComponentTypeDisplay type="command" />);
    expect(screen.getByText('Command')).toBeInTheDocument();
  });

  it('should not be editable (read-only)', () => {
    const { container } = render(<ComponentTypeDisplay type="skill" />);
    const input = container.querySelector('input');
    const textarea = container.querySelector('textarea');
    expect(input).not.toBeInTheDocument();
    expect(textarea).not.toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(<ComponentTypeDisplay type="skill" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
