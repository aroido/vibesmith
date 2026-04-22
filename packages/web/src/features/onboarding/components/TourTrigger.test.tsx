import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { TourTrigger } from './TourTrigger';
import { TourProvider } from '../contexts/TourContext';

describe('TourTrigger', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render restart tour button with ko label', async () => {
    await i18n.changeLanguage('ko');
    render(
      <MemoryRouter>
        <TourProvider>
          <TourTrigger />
        </TourProvider>
      </MemoryRouter>
    );

    const label = i18n.t('settings:restartTour');
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeInTheDocument();
  });

  it('should render restart tour button with en label when locale is en', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <TourProvider>
          <TourTrigger />
        </TourProvider>
      </MemoryRouter>
    );

    const label = i18n.t('settings:restartTour');
    expect(label).toBe('Restart guide tour');
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeInTheDocument();
  });

  it('should clear localStorage and restart tour when clicked', async () => {
    await i18n.changeLanguage('ko');
    localStorage.setItem(
      'vibesmith_onboarding_status',
      JSON.stringify({
        completed: true,
        completedAt: new Date().toISOString(),
        skipped: false,
      })
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TourProvider>
          <TourTrigger />
        </TourProvider>
      </MemoryRouter>
    );

    const label = i18n.t('settings:restartTour');
    const button = screen.getByRole('button', { name: label });
    await user.click(button);

    expect(localStorage.getItem('vibesmith_onboarding_status')).toBeNull();
  });
});
