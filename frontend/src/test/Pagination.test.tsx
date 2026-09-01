import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Pagination } from '../components/Pagination';

const defaultProps = {
  currentPage: 1,
  totalPages: 5,
  pageSize: 10,
  totalItems: 50,
  onPageChange: vi.fn(),
};

describe('Pagination', () => {
  it('renders page info correctly', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('Showing 1-10 of 50')).toBeInTheDocument();
  });

  it('returns null when totalPages is 0', () => {
    const { container } = render(<Pagination {...defaultProps} totalPages={0} totalItems={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when next button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when prev button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev button on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination {...defaultProps} currentPage={5} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('marks current page as active', () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageSizeChange when page size selector changes', () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        {...defaultProps}
        onPageSizeChange={onPageSizeChange}
        showPageSizeSelector={true}
      />
    );
    fireEvent.change(screen.getByLabelText('Per page:'), { target: { value: '25' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('hides page size selector when showPageSizeSelector is false', () => {
    render(<Pagination {...defaultProps} showPageSizeSelector={false} />);
    expect(screen.queryByLabelText('Per page:')).not.toBeInTheDocument();
  });

  it('renders ellipsis for large page counts', () => {
    render(<Pagination {...defaultProps} currentPage={10} totalPages={20} totalItems={200} />);
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('does not call onPageChange when disabled', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} disabled={true} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('shows 0-0 of 0 when totalItems is 0', () => {
    render(<Pagination {...defaultProps} totalItems={0} totalPages={1} currentPage={1} />);
    expect(screen.getByText('Showing 0-0 of 0')).toBeInTheDocument();
  });
});
