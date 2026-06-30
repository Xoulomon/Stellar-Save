import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateGroupForm } from '../components/CreateGroupForm';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/group name/i), 'Test Group');
  await user.type(screen.getByLabelText(/description/i), 'A test description');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await goToStep2(user);
  await user.type(screen.getByLabelText(/contribution amount/i), '100');
  await user.selectOptions(screen.getByRole('combobox'), '604800');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

async function goToStep4(user: ReturnType<typeof userEvent.setup>) {
  await goToStep3(user);
  await user.type(screen.getByLabelText(/maximum members/i), '8');
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

async function goToStep5(user: ReturnType<typeof userEvent.setup>) {
  await goToStep4(user);
  // Step 4 is Insurance — just click Next (insurance disabled by default)
  await user.click(screen.getByRole('button', { name: /^next$/i }));
}

// ─── Progress indicator ───────────────────────────────────────────────────────

describe('Wizard progress indicator', () => {
  it('renders 5 named step labels', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Insurance')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('marks step 1 as current on initial render', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: /form progress/i });
    const steps = nav.querySelectorAll('.wizard-step');
    expect(steps[0]).toHaveClass('wizard-step--current');
    expect(steps[1]).toHaveClass('wizard-step--upcoming');
  });

  it('marks step 1 as completed and step 2 as current after advancing', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await goToStep2(user);
    const nav = screen.getByRole('navigation', { name: /form progress/i });
    const steps = nav.querySelectorAll('.wizard-step');
    expect(steps[0]).toHaveClass('wizard-step--completed');
    expect(steps[1]).toHaveClass('wizard-step--current');
  });

  it('live region announces current step', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
  });
});

// ─── Step validation ──────────────────────────────────────────────────────────

describe('Step validation', () => {
  it('blocks step 1 → 2 when name is too short', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'ab');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/financial settings/i)).not.toBeInTheDocument();
  });

  it('blocks step 2 → 3 when contribution amount is missing', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await goToStep2(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/contribution amount must be greater than 0/i)).toBeInTheDocument();
  });

  it('blocks step 3 → 4 when max members < 2', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await goToStep3(user);
    await user.type(screen.getByLabelText(/maximum members/i), '1');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/maximum members must be at least 2/i);
  });
});

// ─── Draft save / discard ─────────────────────────────────────────────────────

describe('Draft save and discard', () => {
  it('Save Draft button appears once user starts typing', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });

  it('Save Draft button shows confirmation text after click', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
  });

  it('saves form data to localStorage on Save Draft', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Saved Group');
    await user.click(screen.getByRole('button', { name: /save draft/i }));
    const stored = JSON.parse(localStorage.getItem('create-group-draft') ?? '{}');
    expect(stored.name).toBe('Saved Group');
  });

  it('Discard Draft button resets the form', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    expect(screen.getByLabelText(/group name/i)).toHaveValue('');
  });

  it('pre-populates form from existing localStorage draft', () => {
    localStorage.setItem(
      'create-group-draft',
      JSON.stringify({
        name: 'Resumed Group',
        description: 'Resumed desc',
        imageUrl: '',
        contributionAmount: '',
        cycleDuration: '',
        maxMembers: '',
        minMembers: '2',
        insuranceEnabled: false,
        insurancePremiumRate: '5',
      }),
    );
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/group name/i)).toHaveValue('Resumed Group');
  });

  it('clears draft from localStorage after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateGroupForm onSubmit={onSubmit} />);
    await goToStep5(user);
    await user.click(screen.getByRole('button', { name: /create group/i }));
    const stored = JSON.parse(localStorage.getItem('create-group-draft') ?? '{}');
    expect(stored.name ?? '').toBe('');
  });
});
