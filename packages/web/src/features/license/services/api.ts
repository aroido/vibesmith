/**
 * License feature API client
 */

import { apiClient } from '@/common/api';
import type {
  CheckoutRequest,
  CheckoutResponse,
  LicenseResponse,
  LicenseValidateRequest,
} from '../types';

/**
 * POST /api/license/validate
 */
export async function validateLicense(key: string): Promise<LicenseResponse> {
  const payload: LicenseValidateRequest = { key };
  return apiClient<LicenseResponse>('/api/license/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/license/me
 */
export async function fetchMyLicense(licenseKey?: string | null): Promise<LicenseResponse> {
  const headers: HeadersInit = {};
  if (licenseKey?.trim()) {
    headers['X-License-Key'] = licenseKey.trim();
  }

  return apiClient<LicenseResponse>('/api/license/me', {
    headers,
  });
}

/**
 * POST /api/license/checkout
 */
export async function createCheckoutSession(payload: CheckoutRequest): Promise<CheckoutResponse> {
  return apiClient<CheckoutResponse>('/api/license/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
