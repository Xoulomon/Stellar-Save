import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContributionScheduler } from '../components/ContributionScheduler';
import * as useScheduledContributionsModule from '../hooks/useScheduledContributions';
import * as useBalanceModule from '../hooks/useBalance';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

const FUTURE_DATE = '2099-12-31T10:00';
const FUTURE_ISO = new Date(FUTURE_DATE).toISOString();

function mockScheduler(items: useScheduledContributionsModule.ScheduledContribution[] = []) {
  vi.spyOn(useScheduledContributionsModule, 'useScheduledContributions').mockReturnValue({
    items,
    add: mockAdd,
    update: mockUpdate,
    remove: mockRemove,
    getByGroup: (gid: string) => items.filter((i) => i.groupId === gid),
  });
}

function mockBalance(xlmBalance: string | null) {
  vi.spyOn(useBalanceModule, 'useBalance').mockReturnValue({
    xlmBalance,
    allBalances: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
  });
}

const DEFAULT_PROPS = { groupId: 'g1', groupName: 'Test Group', contributionAmount: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  mockScheduler();
  mockBalance('200');
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ContributionScheduler', () => {
  it('renders the scheduling form', () => {
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText(/amount in xlm/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scheduled date and time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
  });

  it('pre-fills amount from contributionAmount prop', () => {
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText(/amount in xlm/i)).toHaveValue(50);
  });

  it('shows validation error when amount is empty', async () => {
    const user = userEvent.setup();
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.clear(screen.getByLabelText(/amount in xlm/i));
    await user.click(screen.getByRole('button', { name: /schedule/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/positive number/i);
  });

  it('shows validation error when date is missing', async () => {
    const user = userEvent.setup();
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole('button', { name: /schedule/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/select a date/i);
  });

  it('shows validation error when date is in the past', async () => {
    const user = userEvent.setup();
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.type(screen.getByLabelText(/scheduled date and time/i), '2000-01-01T00:00');
    await user.click(screen.getByRole('button', { name: /schedule/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/future/i);
  });

  it('calls add() with correct data on valid submit', async () => {
    const user = userEvent.setup();
    mockAdd.mockReturnValue({ id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 50, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() });
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.type(screen.getByLabelText(/scheduled date and time/i), FUTURE_DATE);
    await user.type(screen.getByLabelText(/note/i), 'My note');
    await user.click(screen.getByRole('button', { name: /schedule/i }));
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'g1', amount: 50, note: 'My note' }),
    );
  });

  it('renders scheduled contributions list', () => {
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.getByRole('list', { name: /scheduled contributions/i })).toBeInTheDocument();
    expect(screen.getByText('75 XLM')).toBeInTheDocument();
  });

  it('calls remove() when cancel button is clicked', async () => {
    const user = userEvent.setup();
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole('button', { name: /cancel scheduled contribution/i }));
    expect(mockRemove).toHaveBeenCalledWith('sc_1');
  });

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole('button', { name: /edit scheduled contribution/i }));
    expect(screen.getByLabelText(/edit amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls update() on save in edit mode', async () => {
    const user = userEvent.setup();
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole('button', { name: /edit scheduled contribution/i }));
    const amtInput = screen.getByLabelText(/edit amount/i);
    await user.clear(amtInput);
    await user.type(amtInput, '100');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(mockUpdate).toHaveBeenCalledWith('sc_1', expect.objectContaining({ amount: 100 }));
  });

  it('cancels edit mode without saving', async () => {
    const user = userEvent.setup();
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    await user.click(screen.getByRole('button', { name: /edit scheduled contribution/i }));
    await user.click(screen.getByRole('button', { name: /cancel edit/i }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('75 XLM')).toBeInTheDocument();
  });

  it('shows balance warning when balance is insufficient', () => {
    mockBalance('10'); // balance < totalScheduled (75)
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/insufficient/i);
  });

  it('does not show balance warning when balance is sufficient', () => {
    mockBalance('500');
    mockScheduler([
      { id: 'sc_1', groupId: 'g1', groupName: 'Test Group', amount: 75, scheduledDate: FUTURE_ISO, createdAt: new Date().toISOString() },
    ]);
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show list when no contributions are scheduled', () => {
    render(<ContributionScheduler {...DEFAULT_PROPS} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
