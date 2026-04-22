/**
 * NotificationSettings tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationSettings } from '../components/NotificationSettings';

describe('NotificationSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders notification section with enable toggle and type checkboxes', () => {
    const { getByRole } = render(<NotificationSettings />);
    expect(getByRole('heading', { name: /알림|Notification/i })).toBeInTheDocument();
    const enabledCheckbox = getByRole('checkbox', { name: /알림 활성화|Enable notifications/i });
    expect(enabledCheckbox).toBeInTheDocument();
    expect(enabledCheckbox).toBeChecked();
  });

  it('toggles notification enabled and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<NotificationSettings />);
    const checkbox = getByRole('checkbox', { name: /알림 활성화|Enable notifications/i });
    await user.click(checkbox);
    expect(localStorage.getItem('vibesmith-notification-enabled')).toBe('false');
  });

  it('shows type checkboxes when enabled', () => {
    const { getByRole } = render(<NotificationSettings />);
    expect(getByRole('checkbox', { name: /성공|Success/i })).toBeInTheDocument();
    expect(getByRole('checkbox', { name: /에러|Error/i })).toBeInTheDocument();
  });
});
