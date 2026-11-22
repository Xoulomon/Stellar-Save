import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingFooter } from './LandingFooter';

describe('LandingFooter', () => {
  it('renders footer navigation', () => {
    render(<LandingFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument();
  });
});
