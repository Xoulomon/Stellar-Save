import { screen } from '@testing-library/react';
import React from 'react';

import ErrorPage from '../pages/ErrorPage';

import { withRouter, expectNoA11yViolations } from './a11yHelpers';

describe('ErrorPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<ErrorPage />);
    await expectNoA11yViolations(container);
  });

  it('has a visible heading', () => {
    withRouter(<ErrorPage />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('"Go to Home" button is keyboard focusable', () => {
    withRouter(<ErrorPage />);
    const btn = screen.getByRole('button', { name: /go to home/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('"Retry" button is keyboard focusable', () => {
    withRouter(<ErrorPage />);
    const btn = screen.getByRole('button', { name: /retry/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('error illustration image has alt text', () => {
    withRouter(<ErrorPage />);
    expect(screen.getByRole('img', { name: /error illustration/i })).toBeInTheDocument();
  });
});
