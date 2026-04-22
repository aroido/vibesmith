/**
 * ComponentTypeFilter unit tests
 * Multi-select rendering, click events
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'jest-axe';
import i18n from 'i18next';
import { ComponentTypeFilter } from './ComponentTypeFilter';

describe('ComponentTypeFilter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('should render all type buttons', () => {
    const onTypesChange = vi.fn();
    render(
      <ComponentTypeFilter selectedTypes={[]} onTypesChange={onTypesChange} />
    );

    const labels = ['typeTabAll', 'typeTabSkill', 'typeTabAgent', 'typeTabCommand', 'typeTabHook', 'typeTabRule'].map(
      (key) => i18n.t('components:list.typeTabAria', { label: i18n.t(`components:list.${key}`) })
    );
    labels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('should add selected type when button clicked', async () => {
    const user = userEvent.setup();
    const onTypesChange = vi.fn();
    render(
      <ComponentTypeFilter selectedTypes={[]} onTypesChange={onTypesChange} />
    );

    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    await user.click(screen.getByRole('button', { name: skillsLabel }));

    expect(onTypesChange).toHaveBeenCalledWith(['skill']);
  });

  it('should remove selected type when clicked again', async () => {
    const user = userEvent.setup();
    const onTypesChange = vi.fn();
    render(
      <ComponentTypeFilter selectedTypes={['skill']} onTypesChange={onTypesChange} />
    );

    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    await user.click(screen.getByRole('button', { name: skillsLabel }));

    expect(onTypesChange).toHaveBeenCalledWith([]);
  });

  it('should support multi select', async () => {
    const user = userEvent.setup();
    const onTypesChange = vi.fn();
    render(
      <ComponentTypeFilter selectedTypes={['skill']} onTypesChange={onTypesChange} />
    );

    const agentsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabAgent'),
    });
    await user.click(screen.getByRole('button', { name: agentsLabel }));

    expect(onTypesChange).toHaveBeenCalledWith(['skill', 'agent']);
  });

  it('should reset to all when all button clicked', async () => {
    const user = userEvent.setup();
    const onTypesChange = vi.fn();
    render(
      <ComponentTypeFilter selectedTypes={['skill', 'agent']} onTypesChange={onTypesChange} />
    );

    const allLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabAll'),
    });
    await user.click(screen.getByRole('button', { name: allLabel }));

    expect(onTypesChange).toHaveBeenCalledWith([]);
  });

  it('should set aria-pressed on selected buttons', () => {
    render(
      <ComponentTypeFilter selectedTypes={['skill']} onTypesChange={vi.fn()} />
    );

    const skillsLabel = i18n.t('components:list.typeTabAria', {
      label: i18n.t('components:list.typeTabSkill'),
    });
    const skillsButton = screen.getByRole('button', { name: skillsLabel });
    expect(skillsButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should render type button group with aria-label', () => {
    render(
      <ComponentTypeFilter selectedTypes={[]} onTypesChange={vi.fn()} />
    );

    const tablistAria = i18n.t('components:list.typeTablistAria');
    expect(screen.getByRole('group', { name: tablistAria })).toBeInTheDocument();
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <ComponentTypeFilter selectedTypes={[]} onTypesChange={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
