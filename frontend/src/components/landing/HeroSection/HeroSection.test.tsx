import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroSection } from './HeroSection';

describe('HeroSection', () => {
  it('renders the primary landing heading and actions', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { name: /Save Together, Win Together/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get started with Stellar Save' })).toBeInTheDocument();
  });
});
