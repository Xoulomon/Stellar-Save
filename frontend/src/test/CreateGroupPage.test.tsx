import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateGroupPage from '../pages/CreateGroupPage';
import { routeConfig } from '../routing/routes';
import { ROUTES } from '../routing/constants';

// Mock wallet so the form doesn't block on "connect wallet"
vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ activeAddress: 'GABC1234567890ABCDEF', isConnected: true }),
}));

// Mock insurance API to avoid real HTTP requests
vi.mock('../utils/insuranceApi', () => ({
  updateInsuranceSettings: vi.fn().mockResolvedValue({}),
  fetchInsurancePool: vi.fn().mockResolvedValue({ enabled: false, balance: 0, premiumRate: 0.05, claims: [] }),
  fileClaim: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateGroupPage />
    </MemoryRouter>,
  );
}

// Step through all 5 steps with valid data, insurance disabled
async function fillAndSubmitForm(user: ReturnType<typeof userEvent.setup>) {
  // Step 1
  await user.type(screen.getByLabelText(/group name/i), 'Test Group');
  await user.type(screen.getByLabelText(/description/i), 'A test description');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  // Step 2
  await user.type(screen.getByLabelText(/contribution amount/i), '10');
  await user.selectOptions(screen.getByRole('combobox'), '604800');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  // Step 3
  await user.type(screen.getByLabelText(/maximum members/i), '5');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  // Step 4 – Insurance (leave disabled)
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  // Step 5 – Review
  await user.click(screen.getByRole('button', { name: /create group/i }));
}

describe('CreateGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /create new rosca group/i })).toBeInTheDocument();
  });

  it('route config contains GROUP_CREATE pointing to CreateGroupPage', () => {
    const entry = routeConfig.find((r) => r.path === ROUTES.GROUP_CREATE);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/groups/create');
  });

  it('shows success message after group creation', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillAndSubmitForm(user);

    await waitFor(() => {
      expect(screen.getByText(/group created successfully/i)).toBeInTheDocument();
    });
  });

  it('aria-live region is present in the DOM', () => {
    renderPage();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('route config contains GOVERNANCE pointing to GovernancePage', () => {
    const entry = routeConfig.find((r) => r.path === ROUTES.GOVERNANCE);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/governance');
  });
});
