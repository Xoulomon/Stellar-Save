import { screen } from '@testing-library/react';
import React from 'react';

import LandingPage from '../pages/LandingPage';

import { withRouter, expectNoA11yViolations } from './a11yHelpers';

describe('LandingPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<LandingPage />);
    await expectNoA11yViolations(container);
  });

  it('has a skip-to-main-content link', () => {
    withRouter(<LandingPage />);
    const skip = screen.getByText(/skip to main content/i);
    expect(skip).toBeInTheDocument();
    expect(skip.closest('a')).toHaveAttribute('href', '#main-content');
  });

  it('main content area has id="main-content"', () => {
    withRouter(<LandingPage />);
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });

  it('header has role="banner"', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('footer has role="contentinfo"', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('main navigation has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('footer navigation has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('navigation', { name: /footer navigation/i })).toBeInTheDocument();
  });

  it('hero section is labelled by heading', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('heading', { name: /save together/i })).toBeInTheDocument();
  });

  it('all sections have aria-labelledby', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('heading', { name: /built for trust/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /simple steps/i })).toBeInTheDocument();
  });

  it('statistics list has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('list', { name: /platform statistics/i })).toBeInTheDocument();
  });
});
