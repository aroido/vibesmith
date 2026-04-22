/**
 * ProjectDisplay unit tests
 * Spec Appendix B - 읽기 전용 표시
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ProjectDisplay } from './ProjectDisplay';

describe('ProjectDisplay', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('should render project name', () => {
    render(<ProjectDisplay projectName="vibesmith" />);
    expect(screen.getByText('vibesmith')).toBeInTheDocument();
    expect(screen.getByText(/Project/i)).toBeInTheDocument();
  });

  it('should not be editable (read-only)', () => {
    const { container } = render(<ProjectDisplay projectName="vibesmith" />);
    const input = container.querySelector('input');
    const select = container.querySelector('select');
    expect(input).not.toBeInTheDocument();
    expect(select).not.toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(<ProjectDisplay projectName="vibesmith" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
