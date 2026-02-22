import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}

describe('Button Component', () => {
  it('renders with correct label', () => {
    render(<Button label="Click me" />);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});
