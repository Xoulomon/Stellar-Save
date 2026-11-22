import { screen } from '@testing-library/react';
import React from 'react';

import { Pagination } from '../components/Pagination';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('Pagination – accessibility', () => {
  const defaultProps = {
    currentPage: 3,
    totalPages: 10,
    pageSize: 10,
    totalItems: 100,
    onPageChange: vi.fn(),
  };

  it('has no axe violations', async () => {
    const { container } = renderWithA11y(<Pagination {...defaultProps} />);
    await expectNoA11yViolations(container);
  });

  it('previous button has aria-label', () => {
    renderWithA11y(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
  });

  it('next button has aria-label', () => {
    renderWithA11y(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('current page button has aria-current="page"', () => {
    renderWithA11y(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /page 3/i })).toHaveAttribute('aria-current', 'page');
  });

  it('page size select has an associated label', () => {
    renderWithA11y(<Pagination {...defaultProps} onPageSizeChange={vi.fn()} />);
    expect(screen.getByLabelText(/per page/i)).toBeInTheDocument();
  });

  it('previous button is disabled on first page', () => {
    renderWithA11y(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('next button is disabled on last page', () => {
    renderWithA11y(<Pagination {...defaultProps} currentPage={10} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});
