/**
 * AdvancedSettings tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedSettings } from '../components/AdvancedSettings';

describe('AdvancedSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders advanced section with auto scan and experimental toggles', () => {
    const { getByRole } = render(<AdvancedSettings />);
    expect(getByRole('heading', { name: /고급|Advanced/i })).toBeInTheDocument();
    expect(getByRole('checkbox', { name: /자동 스캔|Auto scan/i })).toBeInTheDocument();
    expect(getByRole('checkbox', { name: /실험적 기능|Experimental features/i })).toBeInTheDocument();
  });

  it('toggles auto scan and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<AdvancedSettings />);
    const checkbox = getByRole('checkbox', { name: /자동 스캔|Auto scan/i });
    await user.click(checkbox);
    expect(localStorage.getItem('vibesmith-auto-scan')).toBe('false');
  });

  it('toggles experimental and persists to localStorage', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<AdvancedSettings />);
    const checkbox = getByRole('checkbox', { name: /실험적 기능|Experimental features/i });
    await user.click(checkbox);
    expect(localStorage.getItem('vibesmith-experimental')).toBe('true');
  });
});
