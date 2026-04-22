/**
 * ComponentContent unit tests
 * Read/Edit mode switching, content change handler
 * Spec Appendix B.1
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18n from 'i18next';
import { ComponentContent } from './ComponentContent';

describe('ComponentContent', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
  });
  it('should render content in read mode', () => {
    const content = '# FastAPI Route\n\n## Usage\nHello world';
    render(
      <ComponentContent
        content={content}
        isEditing={false}
        onContentChange={vi.fn()}
      />
    );

    expect(screen.getByRole('article', { name: '본문 내용' })).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('# FastAPI Route'))).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('## Usage'))).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('Hello world'))).toBeInTheDocument();
  });

  it('should render textarea in edit mode', () => {
    const content = 'Initial content';
    render(
      <ComponentContent
        content={content}
        isEditing={true}
        onContentChange={vi.fn()}
      />
    );

    const textarea = screen.getByRole('textbox', { name: '본문 편집' });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Initial content');
  });

  it('should call onContentChange when content changed in edit mode', async () => {
    const user = userEvent.setup();
    const onContentChange = vi.fn();
    render(
      <ComponentContent
        content="Original"
        isEditing={true}
        onContentChange={onContentChange}
      />
    );

    const textarea = screen.getByRole('textbox', { name: '본문 편집' });
    await user.clear(textarea);
    await user.type(textarea, 'Modified content');

    expect(onContentChange).toHaveBeenCalled();
  });

  it('should preserve content when switching to edit mode', () => {
    const content = 'Preserved content';
    const { rerender } = render(
      <ComponentContent
        content={content}
        isEditing={false}
        onContentChange={vi.fn()}
      />
    );

    expect(screen.getByText('Preserved content')).toBeInTheDocument();

    rerender(
      <ComponentContent
        content={content}
        isEditing={true}
        onContentChange={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue('Preserved content');
  });
});
