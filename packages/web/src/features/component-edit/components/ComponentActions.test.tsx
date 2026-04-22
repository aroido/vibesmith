/**
 * ComponentActions unit tests
 * Button click handlers - Edit, Toggle, Delete
 * Spec Appendix B.1
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from 'i18next';
import { ComponentActions } from './ComponentActions';

describe('ComponentActions', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });
  it('should render edit, toggle, delete buttons when not editing', () => {
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ComponentActions
        enabled={true}
        isEditing={false}
        onEdit={onEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '비활성화' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('should call onEdit when edit button clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ComponentActions
        enabled={true}
        isEditing={false}
        onEdit={onEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: '편집' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('should call onToggle when toggle button clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ComponentActions
        enabled={true}
        isEditing={false}
        onEdit={onEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: '비활성화' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <ComponentActions
        enabled={true}
        isEditing={false}
        onEdit={onEdit}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('should show Save and Cancel when isEditing', () => {
    render(
      <ComponentActions
        enabled={true}
        isEditing={true}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
  });

  it('should show Toggle On when disabled', () => {
    render(
      <ComponentActions
        enabled={false}
        isEditing={false}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '활성화' })).toBeInTheDocument();
  });
});
