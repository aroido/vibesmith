/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

interface OnboardingStatus {
  completed: boolean;
  completedAt?: string;
  skipped: boolean;
  skippedAt?: string;
}

interface TourState {
  isActive: boolean;
  isCompleted: boolean;
  currentStep: number;
}

interface TourActions {
  start: () => void;
  next: () => void;
  back: () => void;
  setStep: (index: number) => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
}

type TourContextValue = TourState & TourActions;

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = 'vibesmith_onboarding_status';
const MAX_STEP_INDEX = 4; // 5 steps (0-4)

function getOnboardingStatus(): OnboardingStatus | null {
  try {
    const status = localStorage.getItem(STORAGE_KEY);
    return status ? (JSON.parse(status) as OnboardingStatus) : null;
  } catch {
    return null;
  }
}

function setOnboardingStatus(status: OnboardingStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  } catch {
    // Ignore localStorage errors
  }
}

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const status = getOnboardingStatus();
    
    // 개발 모드에서는 투어 자동 스킵 (환경 변수로 제어)
    if (import.meta.env.DEV && import.meta.env.VITE_SKIP_TOUR === 'true') {
      if (!status) {
        setOnboardingStatus({
          completed: true,
          completedAt: new Date().toISOString(),
          skipped: false,
        });
      }
      setIsCompleted(true);
      return;
    }
    
    if (!status) {
      // First time user - auto start tour
      setIsActive(true);
    } else {
      setIsCompleted(status.completed);
    }
  }, []);

  const start = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => prev + 1);
  }, []);

  const back = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const setStep = useCallback((index: number) => {
    setCurrentStep(Math.max(0, Math.min(index, MAX_STEP_INDEX)));
  }, []);

  const skip = useCallback(() => {
    setOnboardingStatus({
      completed: false,
      skipped: true,
      skippedAt: new Date().toISOString(),
    });
    setIsActive(false);
  }, []);

  const complete = useCallback(() => {
    setOnboardingStatus({
      completed: true,
      completedAt: new Date().toISOString(),
      skipped: false,
    });
    setIsActive(false);
    setIsCompleted(true);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    setIsActive(true);
    setCurrentStep(0);
    setIsCompleted(false);
  }, []);

  const value: TourContextValue = useMemo(
    () => ({
      isActive,
      isCompleted,
      currentStep,
      start,
      next,
      back,
      setStep,
      skip,
      complete,
      reset,
    }),
    [isActive, isCompleted, currentStep, start, next, back, setStep, skip, complete, reset]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}
