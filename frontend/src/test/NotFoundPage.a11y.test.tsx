import { screen } from '@testing-library/react';
import React from 'react';

import NotFoundPage from '../pages/NotFoundPage';

import { withRouter, expectNoA11yViolations } from './a11yHelpers';

describe('NotFoundPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<NotFoundPage />);
    await expectNoA11yViolations(container);
  });

  it('has a visible h1 heading', () => {
    withRouter(<NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('"Go Back Home" button is keyboard focusable', () => {
    withRouter(<NotFoundPage />);
    const btn = screen.getByRole('button', { name: /go back home/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('"Learn About Us" button is keyboard focusable', () => {
    withRouter(<NotFoundPage />);
    const btn = screen.getByRole('button', { name: /learn about us/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('illustration image has alt text', () => {
    withRouter(<NotFoundPage />);
    expect(screen.getByRole('img', { name: /404 illustration/i })).toBeInTheDocument();
  });
});
