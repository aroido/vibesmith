import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { Omnibox } from './Omnibox';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('cmdk', () => {
  const CommandRoot = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Input = ({ onValueChange, value, ...props }: any) => (
    <input
      {...props}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  );
  const List = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Empty = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Group = ({ children, heading, ...props }: any) => (
    <section {...props}>
      <h3>{heading}</h3>
      {children}
    </section>
  );
  const Item = ({ children, onSelect, value, ...props }: any) => (
    <button
      type="button"
      onClick={() => onSelect?.(value)}
      value={value}
      {...props}
    >
      {children}
    </button>
  );

  return {
    Command: Object.assign(CommandRoot, {
      Input,
      List,
      Empty,
      Group,
      Item,
    }),
  };
});

vi.mock('../hooks/useOmnibox', () => ({
  useOmnibox: () => ({
    query: '',
    setQuery: vi.fn(),
    componentResults: [],
    projectResults: [],
    loading: false,
  }),
}));

vi.mock('../../global-search/hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    recentSearches: [],
    addSearch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

describe('Omnibox quick actions', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko');
    navigateMock.mockReset();
  });

  it('navigates to projects workspace from quick action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<Omnibox isOpen onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: i18n.t('omnibox:actions.viewProjects') })
    );

    expect(navigateMock).toHaveBeenCalledWith('/projects');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to components dependency workspace from quick action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<Omnibox isOpen onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: i18n.t('omnibox:actions.viewDependencies') })
    );

    expect(navigateMock).toHaveBeenCalledWith('/components/dependencies');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to settings trash workspace from quick action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<Omnibox isOpen onClose={onClose} />);

    await user.click(
      screen.getByRole('button', { name: i18n.t('omnibox:actions.viewTrash') })
    );

    expect(navigateMock).toHaveBeenCalledWith('/settings/data/trash');
    expect(onClose).toHaveBeenCalled();
  });
});
