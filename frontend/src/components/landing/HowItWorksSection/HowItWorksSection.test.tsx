import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HowItWorksSection } from './HowItWorksSection';

describe('HowItWorksSection', () => {
  it('renders the walkthrough and first step', () => {
    render(<HowItWorksSection />);
    expect(screen.getByRole('heading', { name: 'Simple Steps to Start Saving' })).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });
});
