/* eslint-disable react-refresh/only-export-components */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TourProvider, useTour } from './TourContext';

describe('TourContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should start tour automatically on first visit', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.currentStep).toBe(0);
  });

  it('should not start tour if already completed', () => {
    localStorage.setItem(
      'vibesmith_onboarding_status',
      JSON.stringify({ completed: true, completedAt: new Date().toISOString(), skipped: false })
    );

    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isCompleted).toBe(true);
  });

  it('should skip tour when skip is called', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    act(() => {
      result.current.skip();
    });

    expect(result.current.isActive).toBe(false);
    const status = localStorage.getItem('vibesmith_onboarding_status');
    expect(status).toBeTruthy();
    if (status) {
      const parsed = JSON.parse(status);
      expect(parsed.skipped).toBe(true);
    }
  });

  it('should complete tour when complete is called', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    act(() => {
      result.current.complete();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isCompleted).toBe(true);
    const status = localStorage.getItem('vibesmith_onboarding_status');
    expect(status).toBeTruthy();
    if (status) {
      const parsed = JSON.parse(status);
      expect(parsed.completed).toBe(true);
    }
  });

  it('should update step when setStep is called', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    act(() => {
      result.current.setStep(2);
    });

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.setStep(0);
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('should clamp setStep to valid range', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    act(() => {
      result.current.setStep(10);
    });

    expect(result.current.currentStep).toBe(4);

    act(() => {
      result.current.setStep(-1);
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('should reset tour when reset is called', () => {
    localStorage.setItem(
      'vibesmith_onboarding_status',
      JSON.stringify({ completed: true, completedAt: new Date().toISOString(), skipped: false })
    );

    const { result } = renderHook(() => useTour(), {
      wrapper: TourProvider,
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(localStorage.getItem('vibesmith_onboarding_status')).toBeNull();
  });
});
