import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';

vi.mock('@/features/scan/components/ScanProgressIndicator', () => ({
  ScanProgressIndicator: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>
  );
}

describe('TeamPage', () => {
  it('renders team page sections', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /팀|Team/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: /팀 생성|Create Team/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /팀원 초대|Invite Member/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /팀 설정|Team Settings/i })).toBeInTheDocument();
  });

  it('validates team name when creating a team', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /팀 생성|Create Team/i })[0]!);

    expect(
      await screen.findByText(/최소 2자|at least 2 characters/i)
    ).toBeInTheDocument();
  });

  it('creates a team and switches active team', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/팀 이름|Team Name/i), 'Platform Guild');
    await user.type(screen.getByLabelText(/팀 설명|Team Description/i), 'Cross-platform team');
    await user.click(screen.getAllByRole('button', { name: /팀 생성|Create Team/i })[0]!);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/Platform Guild/);
    expect(screen.getByRole('option', { name: 'Platform Guild' })).toBeInTheDocument();

    const teamSwitcher = screen.getByLabelText(/활성 팀|Active Team/i) as HTMLSelectElement;
    expect(teamSwitcher.value).toMatch(/^team_/);
  });

  it('validates invite email format', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/초대 이메일|Invite Email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /초대 발송|Send Invite/i }));

    expect(
      await screen.findByText(/유효한 이메일|valid email/i)
    ).toBeInTheDocument();
  });

  it('adds invited member to member list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/초대 이메일|Invite Email/i), 'new.member@example.com');
    await user.click(screen.getByRole('button', { name: /초대 발송|Send Invite/i }));

    const memberList = await screen.findByRole('list', { name: /팀원 목록|Members/i });
    expect(within(memberList).getByText('new.member@example.com')).toBeInTheDocument();
  });
});
