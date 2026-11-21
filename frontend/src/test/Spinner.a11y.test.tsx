import { screen } from '@testing-library/react';
import React from 'react';

import { Spinner, FullPageLoader } from '../components/Spinner';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('Spinner – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = renderWithA11y(<Spinner />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations with label', async () => {
    const { container } = renderWithA11y(<Spinner label="Loading groups..." />);
    await expectNoA11yViolations(container);
  });

  it('spinner element has role="status"', () => {
    renderWithA11y(<Spinner ariaLabel="Loading data" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('spinner has aria-label', () => {
    renderWithA11y(<Spinner ariaLabel="Loading groups" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading groups');
  });

  it('FullPageLoader has role="alert" when visible', () => {
    renderWithA11y(<FullPageLoader loading={true} message="Please wait..." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('FullPageLoader renders nothing when loading=false', () => {
    const { container } = renderWithA11y(<FullPageLoader loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
