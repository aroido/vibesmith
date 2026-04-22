/**
 * DocumentViewer 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { DocumentViewer } from '../components/DocumentViewer';

vi.mock('@/common/utils/toast', () => ({
  showSuccessToast: vi.fn(),
}));

describe('DocumentViewer', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    fileName: 'test-skill.md',
    content: '# Hello\n\nThis is **markdown** content.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file name in header', () => {
    render(<DocumentViewer {...defaultProps} />);
    expect(screen.getByText('test-skill.md')).toBeInTheDocument();
  });

  it('renders markdown content as rendered HTML', () => {
    render(<DocumentViewer {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText(/This is/)).toBeInTheDocument();
    const bold = document.querySelector('strong');
    expect(bold).toHaveTextContent('markdown');
  });

  it('shows view mode selector with preview/source/split buttons', () => {
    render(<DocumentViewer {...defaultProps} />);
    expect(screen.getByTestId('document-viewer-view-preview')).toBeInTheDocument();
    expect(screen.getByTestId('document-viewer-view-source')).toBeInTheDocument();
    expect(screen.getByTestId('document-viewer-view-split')).toBeInTheDocument();
  });

  it('switches to edit mode when Edit button clicked', async () => {
    const user = userEvent.setup();
    render(<DocumentViewer {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: /편집|Edit/i });
    await user.click(editBtn);
    expect(screen.getByTestId('document-viewer-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /저장|Save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /취소|Cancel/i })).toBeInTheDocument();
  });

  it('calls onSave callback when Save clicked in edit mode', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<DocumentViewer {...defaultProps} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /편집|Edit/i }));
    const editor = screen.getByTestId('document-viewer-editor');
    await user.clear(editor);
    await user.type(editor, 'Updated content');
    await user.click(screen.getByRole('button', { name: /저장|Save/i }));
    expect(onSave).toHaveBeenCalledWith('Updated content');
  });

  it('cancels edit and reverts when Cancel clicked', async () => {
    const user = userEvent.setup();
    render(<DocumentViewer {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /편집|Edit/i }));
    const editor = screen.getByTestId('document-viewer-editor');
    await user.clear(editor);
    await user.type(editor, 'Temp edit');
    await user.click(screen.getByRole('button', { name: /취소|Cancel/i }));
    expect(screen.queryByTestId('document-viewer-editor')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
  });

  it('has fullscreen toggle button', () => {
    render(<DocumentViewer {...defaultProps} />);
    const fullscreenBtn = screen.getByRole('button', {
      name: /전체화면|Fullscreen/i,
    });
    expect(fullscreenBtn).toBeInTheDocument();
  });
});
