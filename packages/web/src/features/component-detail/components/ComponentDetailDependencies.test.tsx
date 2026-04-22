/**
 * ComponentDetailDependencies unit tests
 * depends_on, depended_by, empty "없음"
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import i18n from 'i18next';
import { MemoryRouter } from 'react-router-dom';
import { ComponentDetailDependencies } from './ComponentDetailDependencies';
import type { DependencyInfo } from '../types';

describe('ComponentDetailDependencies', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ko');
  });

  it('should render depends_on list', () => {
    const dependencies: DependencyInfo = {
      depends_on: [
        { id: 'comp_010', name: 'pydantic-model', type: 'skill' },
        { id: 'comp_011', name: 'sqlite-schema', type: 'skill' },
      ],
      depended_by: [],
    };

    render(
      <MemoryRouter>
        <ComponentDetailDependencies dependencies={dependencies} />
      </MemoryRouter>
    );

    expect(screen.getByText(/참조하는 것 \(depends_on\)|Depends on \(depends_on\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pydantic-model/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sqlite-schema/ })).toBeInTheDocument();
  });

  it('should render depended_by list', () => {
    const dependencies: DependencyInfo = {
      depends_on: [],
      depended_by: [
        { id: 'comp_020', name: 'my-agent', type: 'agent' },
      ],
    };

    render(
      <MemoryRouter>
        <ComponentDetailDependencies dependencies={dependencies} />
      </MemoryRouter>
    );

    expect(screen.getByText(/참조되는 것 \(depended_by\)|Depended by \(depended_by\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my-agent/ })).toBeInTheDocument();
  });

  it('should show "없음" when both arrays are empty', () => {
    const dependencies: DependencyInfo = {
      depends_on: [],
      depended_by: [],
    };

    render(
      <MemoryRouter>
        <ComponentDetailDependencies dependencies={dependencies} />
      </MemoryRouter>
    );

    const 없음Texts = screen.getAllByText(/없음|None/);
    expect(없음Texts).toHaveLength(2);
  });
});
