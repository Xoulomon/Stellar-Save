import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoscaSection } from './RoscaSection';

describe('RoscaSection', () => {
  it('explains the rotating savings model', () => {
    render(<RoscaSection />);
    expect(screen.getByRole('heading', { name: 'Rotating Savings & Credit Association' })).toBeInTheDocument();
    expect(screen.getByText('Trusted by Communities')).toBeInTheDocument();
  });
});
