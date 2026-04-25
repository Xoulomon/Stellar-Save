import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../components/SearchBar';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} placeholder="Find items..." />);

    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('calls onSearch with debounced value', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} debounceMs={300} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(onSearch).toHaveBeenCalledWith('test');

    vi.useRealTimers();
  });

  it('shows clear button when input has value', () => {
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} />);

    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears input when clear button is clicked', () => {
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });

    expect(input.value).toBe('test');

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
  });

  it('shows loading spinner when loading prop is true', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} loading={true} />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('hides clear button when loading', () => {
    const onSearch = vi.fn();

    const { rerender } = render(<SearchBar onSearch={onSearch} loading={false} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

    rerender(<SearchBar onSearch={onSearch} loading={true} />);

    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('renders with default value', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} defaultValue="initial" />);

    const input = screen.getByRole('searchbox') as HTMLInputElement;
    expect(input.value).toBe('initial');
  });

  it('applies custom className', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} className="custom-class" />);

    const searchBar = screen.getByRole('searchbox').parentElement;
    expect(searchBar).toHaveClass('search-bar', 'custom-class');
  });

  it('debounces multiple rapid inputs', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} debounceMs={300} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'a' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: 'ab' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: 'abc' } });

    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('abc');

    vi.useRealTimers();
  });

  it('shows autocomplete suggestions matching input', () => {
    const onSearch = vi.fn();
    const suggestions = ['Alpha Savers', 'Beta Circle', 'Gamma Fund'];

    render(<SearchBar onSearch={onSearch} suggestions={suggestions} />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alp' } });

    expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
    expect(screen.queryByText('Beta Circle')).not.toBeInTheDocument();
  });

  it('does not show suggestions when input is empty', () => {
    const onSearch = vi.fn();
    const suggestions = ['Alpha Savers', 'Beta Circle'];

    render(<SearchBar onSearch={onSearch} suggestions={suggestions} />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects suggestion on click and calls onSearch', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const suggestions = ['Alpha Savers', 'Beta Circle'];

    render(<SearchBar onSearch={onSearch} suggestions={suggestions} />);

    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alp' } });

    fireEvent.mouseDown(screen.getByText('Alpha Savers'));

    expect(input.value).toBe('Alpha Savers');
    expect(onSearch).toHaveBeenCalledWith('Alpha Savers');

    vi.useRealTimers();
  });

  it('hides suggestions after selecting one', () => {
    const onSearch = vi.fn();
    const suggestions = ['Alpha Savers', 'Beta Circle'];

    render(<SearchBar onSearch={onSearch} suggestions={suggestions} />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alp' } });

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Alpha Savers'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
