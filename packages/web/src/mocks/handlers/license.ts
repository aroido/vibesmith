/**
 * License API MSW Handlers
 * Issue #716
 */

import { http, HttpResponse } from 'msw';

const VALID_LICENSES = {
  'VS-VALID-PRO': {
    plan: 'pro',
    expires_at: '2027-02-19T00:00:00Z',
  },
  'VS-VALID-TEAM': {
    plan: 'team',
    expires_at: '2027-06-01T00:00:00Z',
  },
} as const;

type ValidateRequest = {
  key?: string;
};

type CheckoutRequest = {
  plan?: string;
  email?: string;
};

export const licenseHandlers = [
  http.post('*/api/license/validate', async ({ request }) => {
    const body = (await request.json()) as ValidateRequest;
    const key = body.key?.trim().toUpperCase() ?? '';
    const found = VALID_LICENSES[key as keyof typeof VALID_LICENSES];

    if (!found) {
      return HttpResponse.json({
        valid: false,
        plan: 'free',
        expires_at: null,
      });
    }

    return HttpResponse.json({
      valid: true,
      plan: found.plan,
      expires_at: found.expires_at,
    });
  }),

  http.get('*/api/license/me', ({ request }) => {
    const key = request.headers.get('x-license-key')?.trim().toUpperCase() ?? '';
    const found = VALID_LICENSES[key as keyof typeof VALID_LICENSES];

    if (!found) {
      return HttpResponse.json({
        valid: false,
        plan: 'free',
        expires_at: null,
      });
    }

    return HttpResponse.json({
      valid: true,
      plan: found.plan,
      expires_at: found.expires_at,
    });
  }),

  http.post('*/api/license/checkout', async ({ request }) => {
    const body = (await request.json()) as CheckoutRequest;

    if ((body.plan !== 'pro' && body.plan !== 'team') || !body.email) {
      return HttpResponse.json(
        {
          detail: 'Invalid input',
          message_key: 'errors.validation_error',
          message: 'Invalid input',
        },
        { status: 422 }
      );
    }

    return HttpResponse.json({
      checkout_url: `https://checkout.stripe.com/mock-${body.plan}`,
      session_id: `cs_mock_${body.plan}`,
    });
  }),
];
