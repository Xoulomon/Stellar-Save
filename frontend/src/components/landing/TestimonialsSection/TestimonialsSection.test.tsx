import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestimonialsSection } from './TestimonialsSection';

describe('TestimonialsSection', () => {
  it('renders member quotes', () => {
    render(<TestimonialsSection />);
    expect(screen.getByRole('heading', { name: 'What Our Members Say' })).toBeInTheDocument();
    expect(screen.getByText('Amara K.')).toBeInTheDocument();
  });
});
