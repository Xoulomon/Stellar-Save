import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CreateGroupForm } from '../components/CreateGroupForm';

// Navigates through all 5 steps with valid data (insurance disabled)
async function fillAndSubmitForm(user: ReturnType<typeof userEvent.setup>) {
  // Step 1 – Basics
  await user.type(screen.getByLabelText(/group name/i), 'Test Group');
  await user.type(screen.getByLabelText(/description/i), 'A test description');
  await user.click(screen.getByRole('button', { name: /^next$/i }));

  // Step 2 – Finances
  await user.type(screen.getByLabelText(/contribution amount/i), '10');
  await user.selectOptions(screen.getByRole('combobox'), '604800');
  await user.click(screen.getByRole('button', { name: /^next$/i }));

  // Step 3 – Members
  await user.type(screen.getByLabelText(/maximum members/i), '5');
  await user.click(screen.getByRole('button', { name: /^next$/i }));

  // Step 4 – Insurance (leave disabled, just click Next)
  await user.click(screen.getByRole('button', { name: /^next$/i }));

  // Step 5 – Review → submit
  await user.click(screen.getByRole('button', { name: /create group/i }));
}

describe('CreateGroupForm', () => {
  it('renders step 1 with Group Name and Description fields', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('shows error when name is too short on Next click', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'ab');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
  });

  it('shows error when description is empty on Next click', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/financial settings/i)).toBeInTheDocument();
  });

  it('step 2 renders cycle duration select with 3 options', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bi-Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('step 3 pre-populates minMembers with 2', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByLabelText(/minimum members/i)).toHaveValue(2);
  });

  it('step 4 is the Insurance step', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByText(/insurance pool/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/enable insurance/i)).toBeInTheDocument();
  });

  it('insurance premium field appears when toggle is enabled', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Enable insurance
    await user.click(screen.getByLabelText(/enable insurance/i));
    expect(screen.getByLabelText(/premium rate/i)).toBeInTheDocument();
  });

  it('step 5 (review) shows Create Group button and no Next button', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i })); // Insurance → Review

    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('calls onSubmit with correct GroupData including insurance fields', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateGroupForm onSubmit={onSubmit} />);
    await fillAndSubmitForm(user);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Group',
        description: 'A test description',
        image_url: '',
        contribution_amount: 100_000_000, // 10 XLM in stroops
        cycle_duration: 604800,
        max_members: 5,
        min_members: 2,
        insuranceEnabled: false,
      }),
    );
  });

  it('Cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CreateGroupForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
