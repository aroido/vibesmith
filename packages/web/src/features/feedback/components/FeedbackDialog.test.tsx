import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/common/api/errors';
import { FeedbackDialog } from './FeedbackDialog';

describe('FeedbackDialog', () => {
  it('changes description template when category changes and description is untouched', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        isSubmitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    const description = screen.getByLabelText(/설명|Description/i) as HTMLTextAreaElement;
    const initialValue = description.value;

    await user.selectOptions(screen.getByLabelText(/카테고리|Category/i), 'feature');

    expect(description.value).not.toBe(initialValue);
    expect(description.value.length).toBeGreaterThan(0);
  });

  it('shows required error when title is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FeedbackDialog
        isOpen={true}
        isSubmitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /피드백 제출|Submit feedback/i }));

    expect(
      await screen.findByText(/제목을 입력해주세요|Please enter a title/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits payload and renders success state with issue link', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      issue_url: 'https://github.com/aroido/vibesmith/issues/123',
      issue_number: 123,
    });

    render(
      <FeedbackDialog
        isOpen={true}
        isSubmitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    await user.type(
      screen.getByLabelText(/제목|Title/i),
      'Feedback dialog integration test'
    );

    await user.click(screen.getByRole('button', { name: /피드백 제출|Submit feedback/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const firstPayload = onSubmit.mock.calls[0][0] as {
      title: string;
      category: string;
      system_info: Record<string, string>;
    };

    expect(firstPayload.title).toBe('Feedback dialog integration test');
    expect(firstPayload.category).toBe('bug');
    expect(firstPayload.system_info).toBeTypeOf('object');

    const issueLink = await screen.findByRole('link', {
      name: /생성된 이슈 열기|Open created issue/i,
    });
    expect(issueLink).toHaveAttribute('href', 'https://github.com/aroido/vibesmith/issues/123');
  });

  it('shows browser fallback link when feedback token is not configured', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(
        'Feedback token not configured',
        500,
        'Feedback token not configured',
        'errors.feedback_token_not_configured'
      )
    );

    render(
      <FeedbackDialog
        isOpen={true}
        isSubmitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/제목|Title/i), 'Fallback test');
    await user.click(screen.getByRole('button', { name: /피드백 제출|Submit feedback/i }));

    const fallbackLink = await screen.findByRole('link', {
      name: /브라우저에서 이슈 작성 열기|Open prefilled issue in browser/i,
    });
    expect(fallbackLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://github.com/aroido/vibesmith/issues/new?')
    );
  });
});
