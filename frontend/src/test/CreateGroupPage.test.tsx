import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateGroupPage from '../pages/CreateGroupPage';
import { routeConfig } from '../routing/routes';
import { ROUTES } from '../routing/constants';
import { createGroup } from '../utils/groupApi';

vi.mock('../ui', () => ({
  AppLayout: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => (
    <div>
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../utils/groupApi', () => ({
  createGroup: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockCreateGroup = vi.mocked(createGroup);

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateGroupPage />
    </MemoryRouter>
  );
}

async function fillAndSubmitForm(user: ReturnType<typeof userEvent.setup>) {
  // Step 1
  await user.type(screen.getByLabelText(/group name/i), 'Test Group');
  await user.type(screen.getByLabelText(/description/i), 'A test description');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 2
  await user.type(screen.getByLabelText(/contribution amount/i), '10');
  await user.selectOptions(screen.getByRole('combobox'), '604800');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 3
  await user.type(screen.getByLabelText(/maximum members/i), '5');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 4
  await user.click(screen.getByRole('button', { name: /create group/i }));
}

describe('CreateGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with title 'Create Group' and subtitle 'Set up your savings circle'", () => {
    renderPage();
    expect(screen.getByText('Create Group')).toBeInTheDocument();
    expect(screen.getByText('Set up your savings circle')).toBeInTheDocument();
  });

  it('route config contains GROUP_CREATE entry pointing to CreateGroupPage', () => {
    const entry = routeConfig.find(r => r.path === ROUTES.GROUP_CREATE);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/groups/create');
  });

  it('shows loading state (spinner) while submitting', async () => {
    const user = userEvent.setup();
    // Never resolves — keeps loading state
    mockCreateGroup.mockReturnValue(new Promise(() => {}));
    renderPage();
    await fillAndSubmitForm(user);

    const createBtn = screen.getByRole('button', { name: /create group/i });
    expect(createBtn).toBeDisabled();
  });

  it('shows success message after successful creation', async () => {
    const user = userEvent.setup();
    mockCreateGroup.mockResolvedValue('group-123');
    renderPage();
    await fillAndSubmitForm(user);

    await waitFor(() => {
      expect(screen.getByText(/group created successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message when creation fails', async () => {
    const user = userEvent.setup();
    mockCreateGroup.mockRejectedValue(new Error('Network error'));
    renderPage();
    await fillAndSubmitForm(user);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when error has no message', async () => {
    const user = userEvent.setup();
    mockCreateGroup.mockRejectedValue(new Error(''));
    renderPage();
    await fillAndSubmitForm(user);

    await waitFor(() => {
      expect(screen.getByText(/failed to create group/i)).toBeInTheDocument();
    });
  });

  it('aria-live region is present in the DOM', () => {
    renderPage();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});
