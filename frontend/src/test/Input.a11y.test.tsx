import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Input } from '../components/Input';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('Input – accessibility', () => {
  it('has no axe violations (basic)', async () => {
    const { container } = renderWithA11y(<Input label="Group Name" value="" onChange={vi.fn()} />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (with error)', async () => {
    const { container } = renderWithA11y(
      <Input label="Group Name" value="" onChange={vi.fn()} error="Name is required" />
    );
    await expectNoA11yViolations(container);
  });

  it('label is associated with input via htmlFor/id', () => {
    renderWithA11y(<Input label="Contribution Amount" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText(/contribution amount/i);
    expect(input).toBeInTheDocument();
  });

  it('error message has role="alert" for screen reader announcement', () => {
    renderWithA11y(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('aria-invalid is true when error is present', () => {
    renderWithA11y(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByLabelText(/amount/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('aria-describedby points to error element', () => {
    renderWithA11y(<Input label="Amount" id="amt" value="" onChange={vi.fn()} error="Required" />);
    const input = screen.getByLabelText(/amount/i);
    expect(input).toHaveAttribute('aria-describedby', 'amt-error');
    expect(document.getElementById('amt-error')).toHaveTextContent('Required');
  });

  it('has no axe violations when disabled', async () => {
    const { container } = renderWithA11y(<Input label="Amount" value="100" onChange={vi.fn()} disabled />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations with placeholder', async () => {
    const { container } = renderWithA11y(
      <Input label="Search" value="" onChange={vi.fn()} placeholder="Enter search term" />
    );
    await expectNoA11yViolations(container);
  });
});

describe('Input – keyboard navigation', () => {
  it('Tab moves focus into the input', async () => {
    const user = userEvent.setup();
    renderWithA11y(
      <div>
        <button>Before</button>
        <Input label="Group Name" value="" onChange={vi.fn()} />
        <button>After</button>
      </div>
    );
    screen.getByRole('button', { name: /before/i }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/group name/i));
  });

  it('Shift+Tab moves focus back out of the input', async () => {
    const user = userEvent.setup();
    renderWithA11y(
      <div>
        <button>Before</button>
        <Input label="Group Name" value="" onChange={vi.fn()} />
      </div>
    );
    screen.getByLabelText(/group name/i).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /before/i }));
  });
});
