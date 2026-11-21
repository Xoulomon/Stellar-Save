import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Button } from '../components/Button';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('Button – accessibility', () => {
  it('has no axe violations (primary)', async () => {
    const { container } = renderWithA11y(<Button>Save Group</Button>);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = renderWithA11y(<Button disabled>Save Group</Button>);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (loading state)', async () => {
    const { container } = renderWithA11y(<Button loading>Save Group</Button>);
    await expectNoA11yViolations(container);
  });

  it('is keyboard focusable', () => {
    renderWithA11y(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('disabled button is not activatable via keyboard', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithA11y(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    );
    const btn = screen.getByRole('button', { name: /disabled/i });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading spinner is aria-hidden', () => {
    renderWithA11y(<Button loading>Saving</Button>);
    const spinner = document.querySelector('.btn-spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});
