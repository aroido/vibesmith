/**
 * ChangeGlobalPathForm unit tests (spec Appendix B.1)
 * Confirm dialog, validation, submit
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import i18n from '@/i18n';
import { ChangeGlobalPathForm } from './ChangeGlobalPathForm';

const server = setupServer(
  http.post('*/api/scan', async ({ request }) => {
    const body = (await request.json()) as {
      home_path?: string;
      cursor_global_path?: string;
    };
    if (body.home_path || body.cursor_global_path) {
      return HttpResponse.json({
        scanned_projects: 1,
        total_components: 8,
      });
    }
    return HttpResponse.json(
      { detail: 'Invalid request' },
      { status: 400 }
    );
  })
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ChangeGlobalPathForm', () => {
  it('should display currentPath as initial value', () => {
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" />
    );
    const label = i18n.t('scan:globalPathLabel');
    expect(screen.getByLabelText(new RegExp(label, 'i'))).toHaveValue('~/.claude');
  });

  it('should show confirm dialog on submit with valid path', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" />
    );

    const label = i18n.t('scan:globalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    await user.type(input, '/Users/user/.claude');
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));

    const dialogTitle = i18n.t('scan:confirmTitle');
    expect(
      screen.getByRole('dialog', { name: new RegExp(dialogTitle, 'i') })
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('scan:confirmMessage'))).toBeInTheDocument();
  });

  it('should call mutate when confirm clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" />
    );

    const label = i18n.t('scan:globalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    await user.type(input, '/Users/new/.claude');
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));

    const confirmBtn = screen.getByRole('button', { name: i18n.t('common:confirm') });
    await user.click(confirmBtn);

    await expect(
      screen.findByRole('button', { name: new RegExp(submitLabel, 'i') })
    ).resolves.toBeInTheDocument();
    // Dialog closed after success
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close dialog when cancel clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" />
    );

    const label = i18n.t('scan:globalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    await user.type(input, '/Users/user/.claude');
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('common:cancel') }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show error when submitting empty path', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" />
    );

    const label = i18n.t('scan:globalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('scan:pathRequired'));
  });

  it('should call onSuccess when change completes', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ChangeGlobalPathForm currentPath="~/.claude" onSuccess={onSuccess} />
    );

    const label = i18n.t('scan:globalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    await user.type(input, '/Users/user/.claude');
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));
    await user.click(screen.getByRole('button', { name: i18n.t('common:confirm') }));

    await screen.findByRole('button', { name: new RegExp(i18n.t('scan:changeGlobalPath'), 'i') });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        scanned_projects: 1,
        total_components: 8,
      })
    );
  });

  it('should submit cursor_global_path when cursor mode is used', async () => {
    const user = userEvent.setup();
    let capturedRequest: { home_path?: string; cursor_global_path?: string } | null = null;

    server.use(
      http.post('*/api/scan', async ({ request }) => {
        capturedRequest = (await request.json()) as {
          home_path?: string;
          cursor_global_path?: string;
        };
        return HttpResponse.json({
          scanned_projects: 1,
          total_components: 8,
        });
      })
    );

    renderWithProviders(<ChangeGlobalPathForm mode="cursor" currentPath="~/.cursor" />);

    const label = i18n.t('scan:cursorGlobalPathLabel');
    const input = screen.getByLabelText(new RegExp(label, 'i'));
    await user.clear(input);
    await user.type(input, '/Users/user/.cursor');
    const submitLabel = i18n.t('scan:changeGlobalPath');
    await user.click(screen.getByRole('button', { name: new RegExp(submitLabel, 'i') }));
    await user.click(screen.getByRole('button', { name: i18n.t('common:confirm') }));

    await screen.findByRole('button', { name: new RegExp(submitLabel, 'i') });
    expect(capturedRequest).toEqual({
      cursor_global_path: '/Users/user/.cursor',
    });
  });
});
