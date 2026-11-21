import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingNav } from './LandingNav';

describe('LandingNav', () => {
  it('renders the navigation links and wallet action', () => {
    render(<LandingNav />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByRole('button', { name: 'Connect your Stellar wallet' })).toBeInTheDocument();
  });
});
