/**
 * Feedback API MSW Handlers
 * POST /api/feedback
 */

import { http, HttpResponse } from 'msw';

type FeedbackBody = {
  title?: string;
  description?: string;
  category?: string;
};

async function createFeedbackResponse(request: Request) {
  const body = (await request.json()) as FeedbackBody;

  const validCategory =
    body.category === 'bug' || body.category === 'feature' || body.category === 'question';

  if (!body.title || !body.description || !validCategory) {
    return HttpResponse.json(
      {
        detail: 'Invalid input',
        message_key: 'errors.validation_error',
        message: 'Invalid input',
      },
      { status: 422 }
    );
  }

  return HttpResponse.json(
    {
      issue_url: 'https://github.com/aroido/vibesmith/issues/999',
      issue_number: 999,
    },
    { status: 201 }
  );
}

export const feedbackHandlers = [
  http.post('*/api/feedback', async ({ request }) => createFeedbackResponse(request)),
  http.post('*/api/feedback/', async ({ request }) => createFeedbackResponse(request)),
];
