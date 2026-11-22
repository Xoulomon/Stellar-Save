import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CtaSection } from './CtaSection';

describe('CtaSection', () => {
  it('renders the closing call to action', () => {
    render(<CtaSection />);
    expect(screen.getByRole('heading', { name: 'Ready to Start Saving?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect wallet to get started' })).toBeInTheDocument();
  });
});
