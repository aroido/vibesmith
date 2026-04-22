import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '@/common/utils';
import { createCheckoutSession, fetchMyLicense, validateLicense } from '../services/api';
import type {
  CheckoutRequest,
  CheckoutResponse,
  LicenseResponse,
} from '../types';

export function useLicenseMe(licenseKey: string | null) {
  return useQuery<LicenseResponse, Error>({
    queryKey: ['license-me', licenseKey ?? 'none'],
    queryFn: () => fetchMyLicense(licenseKey),
    staleTime: 30_000,
    gcTime: 300_000,
    retry: 1,
  });
}

export function useValidateLicense() {
  const { t } = useTranslation('license');

  return useMutation<LicenseResponse, Error, string>({
    mutationFn: (key) => validateLicense(key),
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : t('errors.validateFailed'));
    },
  });
}

export function useCheckoutSession() {
  const { t } = useTranslation('license');

  return useMutation<CheckoutResponse, Error, CheckoutRequest>({
    mutationFn: createCheckoutSession,
    onError: (error) => {
      showErrorToast(error instanceof Error ? error.message : t('errors.checkoutFailed'));
    },
  });
}
