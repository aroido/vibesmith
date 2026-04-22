/**
 * License feature types
 * Issue #716
 */

export type PlanType = 'free' | 'pro' | 'team';

export interface LicenseResponse {
  valid: boolean;
  plan: PlanType;
  expires_at: string | null;
}

export interface LicenseValidateRequest {
  key: string;
}

export interface CheckoutRequest {
  plan: 'pro' | 'team';
  email: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}
