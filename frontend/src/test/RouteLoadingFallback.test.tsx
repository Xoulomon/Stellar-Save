/**
 * RouteLoadingFallback.test.tsx
 *
 * Guards the shared Suspense fallback used by both the app-shell boundary
 * (`App.tsx`) and the per-route boundary (`routing/AppRouter.tsx`).
 *
 * It previously existed as two divergent local components, one of which
 * announced nothing to assistive technology.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { RouteLoadingFallback } from '../routing/RouteLoadingFallback';

describe('RouteLoadingFallback', () => {
  it('announces the pending state via role="status"', () => {
    render(<RouteLoadingFallback />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('carries an accessible label', () => {
    render(<RouteLoadingFallback />);

    expect(screen.getByRole('status', { name: /loading page/i })).toBeInTheDocument();
  });

  it('renders skeleton placeholders', () => {
    const { container } = render(<RouteLoadingFallback />);

    expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
  });
});
