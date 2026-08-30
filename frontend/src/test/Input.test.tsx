import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Input } from '../components/Input';

describe('Input', () => {
  it('renders without label', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows required asterisk when required', () => {
    render(<Input label="Name" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Input label="Name" error="Name is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('renders helper text when no error', () => {
    render(<Input label="Name" helperText="Enter your full name" />);
    expect(screen.getByText('Enter your full name')).toBeInTheDocument();
  });

  it('does not render helper text when error is present', () => {
    render(<Input label="Name" error="Required" helperText="Enter name" />);
    expect(screen.queryByText('Enter name')).not.toBeInTheDocument();
  });

  it('calls onChange handler', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls validate function on change', () => {
    const validate = vi.fn().mockReturnValue(undefined);
    render(<Input validate={validate} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(validate).toHaveBeenCalledWith('test');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Field" error="Bad input" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders number input type', () => {
    render(<Input type="number" />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Input className="my-input" />);
    expect(screen.getByRole('textbox')).toHaveClass('my-input');
  });
});
