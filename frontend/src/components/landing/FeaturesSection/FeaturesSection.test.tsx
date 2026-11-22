import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeaturesSection } from './FeaturesSection';

describe('FeaturesSection', () => {
  it('renders the feature heading and feature cards', () => {
    render(<FeaturesSection />);
    expect(screen.getByRole('heading', { name: 'Built for Trust and Transparency' })).toBeInTheDocument();
    expect(screen.getByText('Secure & Transparent')).toBeInTheDocument();
  });
});
