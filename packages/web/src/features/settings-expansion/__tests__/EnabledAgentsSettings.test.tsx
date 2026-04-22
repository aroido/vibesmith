/**
 * EnabledAgentsSettings tests
 * Claude 체크박스 렌더링, 체크/해제, 저장 동작 (#497)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnabledAgentsSettings } from '../components/EnabledAgentsSettings';

describe('EnabledAgentsSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Cursor and Claude checkboxes', () => {
    render(<EnabledAgentsSettings />);
    expect(screen.getByRole('checkbox', { name: /Cursor/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Claude.*Claude Code/i })).toBeInTheDocument();
  });

  it('both checkboxes are checked by default', () => {
    render(<EnabledAgentsSettings />);
    expect(screen.getByRole('checkbox', { name: /Cursor/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Claude.*Claude Code/i })).toBeChecked();
  });

  it('toggles Claude checkbox and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<EnabledAgentsSettings />);
    const claudeCheckbox = screen.getByRole('checkbox', { name: /Claude.*Claude Code/i });
    await user.click(claudeCheckbox);
    expect(claudeCheckbox).not.toBeChecked();
    const stored = JSON.parse(localStorage.getItem('vibesmith-enabled-agents') ?? '{}');
    expect(stored.claude).toBe(false);
  });

  it('toggles Cursor checkbox and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<EnabledAgentsSettings />);
    const cursorCheckbox = screen.getByRole('checkbox', { name: /Cursor/i });
    await user.click(cursorCheckbox);
    expect(cursorCheckbox).not.toBeChecked();
    const stored = JSON.parse(localStorage.getItem('vibesmith-enabled-agents') ?? '{}');
    expect(stored.cursor).toBe(false);
  });

  it('shows warning when both options are disabled', async () => {
    const user = userEvent.setup();
    render(<EnabledAgentsSettings />);
    await user.click(screen.getByRole('checkbox', { name: /Cursor/i }));
    await user.click(screen.getByRole('checkbox', { name: /Claude.*Claude Code/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/both options are disabled|두 옵션이 모두 해제/i)).toBeInTheDocument();
  });

  it('does not show warning when at least one is enabled', () => {
    render(<EnabledAgentsSettings />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
