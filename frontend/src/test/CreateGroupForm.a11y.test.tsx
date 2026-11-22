import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CreateGroupForm } from '../components/CreateGroupForm';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('CreateGroupForm – accessibility', () => {
  it('has no axe violations on step 1', async () => {
    const { container } = renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations on step 2', async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await expectNoA11yViolations(container);
  });

  it('has no axe violations on step 3', async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await expectNoA11yViolations(container);
  });

  it('has no axe violations on step 4 (review)', async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await expectNoA11yViolations(container);
  });

  it('progress bar has correct ARIA attributes', () => {
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '4');
  });

  it('all step-1 fields are reachable via Tab', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/group name/i));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/description/i));
  });

  it('form can be advanced via keyboard (Enter on Next button)', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    screen.getByRole('button', { name: /next/i }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(/financial settings/i)).toBeInTheDocument();
  });

  it('validation errors are announced via role="alert"', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('cycle duration select has an accessible label', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByLabelText(/cycle duration/i)).toBeInTheDocument();
  });
});

describe('CreateGroupForm – keyboard navigation', () => {
  it('Tab order follows visual order on step 1', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.tab();
    const first = document.activeElement;
    await user.tab();
    const second = document.activeElement;
    expect(first).not.toBe(second);
    expect(first?.tagName).toMatch(/INPUT|TEXTAREA/i);
  });

  it('Escape does not break form state', async () => {
    const user = userEvent.setup();
    renderWithA11y(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Test');
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
  });
});
