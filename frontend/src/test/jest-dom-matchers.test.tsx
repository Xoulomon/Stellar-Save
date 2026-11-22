import type {} from '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Vitest DOM matchers', () => {
  it('recognizes an accessible name and a disabled control', () => {
    render(<button disabled>Submit contribution</button>);

    const button = screen.getByRole('button', { name: 'Submit contribution' });
    expect(button).toHaveAccessibleName('Submit contribution');
    expect(button).toBeDisabled();
  });

  it('throws an assertion error when the accessible name differs', () => {
    render(<button>Cancel</button>);

    expect(() => {
      expect(screen.getByRole('button')).toHaveAccessibleName('Submit contribution');
    }).toThrow(/to have accessible name/i);
  });
});
