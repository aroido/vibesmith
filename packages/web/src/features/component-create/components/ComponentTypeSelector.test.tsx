/**
 * ComponentTypeSelector unit tests
 * Radio rendering, type change events (spec Appendix B)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ComponentTypeSelector } from './ComponentTypeSelector';

describe('ComponentTypeSelector', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('should render all type options (Skill, Agent, Command)', () => {
    const onTypeChange = vi.fn();
    render(
      <ComponentTypeSelector selectedType="skill" onTypeChange={onTypeChange} />
    );

    expect(screen.getByRole('radio', { name: /Skill/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Agent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Command/i })).toBeInTheDocument();
    const radiogroupLabel = i18n.t('components:create.typeRadiogroupAria');
    expect(screen.getByRole('radiogroup', { name: radiogroupLabel })).toBeInTheDocument();
  });

  it('should call onTypeChange when type selected', async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    render(
      <ComponentTypeSelector selectedType="skill" onTypeChange={onTypeChange} />
    );

    await user.click(screen.getByRole('radio', { name: /Agent/i }));

    expect(onTypeChange).toHaveBeenCalledWith('agent');
  });

  it('should mark selected type as checked', () => {
    render(
      <ComponentTypeSelector
        selectedType="command"
        onTypeChange={vi.fn()}
      />
    );

    const commandRadio = screen.getByRole('radio', { name: /Command/i });
    expect(commandRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('should have required indicator on legend', () => {
    render(
      <ComponentTypeSelector selectedType="skill" onTypeChange={vi.fn()} />
    );

    const componentTypeLabel = i18n.t('components:create.componentType');
    const legend = screen.getByText(
      new RegExp(componentTypeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      { selector: 'legend' }
    );
    expect(legend).toBeInTheDocument();
    expect(legend).toHaveTextContent(/\*/);
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ComponentTypeSelector selectedType="skill" onTypeChange={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
