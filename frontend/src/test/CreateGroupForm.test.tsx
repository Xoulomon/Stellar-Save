import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CreateGroupForm } from '../components/CreateGroupForm';

// Helper to navigate through all 4 steps with valid data
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

  // Step 4 - submit
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
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
  });

  it('shows error when description is empty on Next click', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/financial settings/i)).toBeInTheDocument();
  });

  it('step 2 renders cycle duration select with 3 options (Weekly, Bi-Weekly, Monthly)', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bi-Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
  });

  it("step 2 shows helper text 'Amount each member contributes per cycle'", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/amount each member contributes per cycle/i)).toBeInTheDocument();
  });

  it("step 3 pre-populates minMembers with '2'", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByLabelText(/minimum members/i)).toHaveValue(2);
  });

  it("step 4 shows 'Create Group' button and no 'Next' button", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });

  it('step 4 renders no editable input elements', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/description/i), 'A valid description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('calls onSubmit with correct GroupData including stroops conversion', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateGroupForm onSubmit={onSubmit} />);
    await fillAndSubmitForm(user);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Group',
      description: 'A test description',
      contribution_amount: 100_000_000, // 10 XLM * 10_000_000
      cycle_duration: 604800,
      max_members: 5,
      min_members: 2,
    });
  });

  it('Cancel button calls onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CreateGroupForm onSubmit={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
