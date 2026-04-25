import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../ui', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    isLoading: false,
    error: null,
    stats: {
      totalContributed: 8750,
      totalReceived: 5000,
      roi: -42.9,
      onTimePercent: 91.7,
      activeGroups: 3,
      completedGroups: 1,
    },
    history: [
      { month: 'Jan 2026', contributed: 1250, received: 0 },
      { month: 'Feb 2026', contributed: 1250, received: 2400 },
    ],
    memberComparison: [
      { address: 'GSELF...', label: 'You', onTimePercent: 91.7, totalContributed: 8750 },
      { address: 'GABC1...', label: 'GABC1...', onTimePercent: 100, totalContributed: 9500 },
    ],
  }),
}));

import AnalyticsDashboardPage from '../pages/AnalyticsDashboardPage';

describe('AnalyticsDashboardPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <AnalyticsDashboardPage />
      </MemoryRouter>
    );
  }

  it('renders stat labels', () => {
    renderPage();
    expect(screen.getByText('Total Contributed')).toBeInTheDocument();
    expect(screen.getByText('Total Received')).toBeInTheDocument();
    expect(screen.getByText('ROI')).toBeInTheDocument();
    expect(screen.getByText('On-Time Rate')).toBeInTheDocument();
  });

  it('renders stat values', () => {
    renderPage();
    expect(screen.getByText('8,750 XLM')).toBeInTheDocument();
    expect(screen.getByText('5,000 XLM')).toBeInTheDocument();
    expect(screen.getByText('-42.9%')).toBeInTheDocument();
    expect(screen.getByText('91.7%')).toBeInTheDocument();
  });

  it('renders chart section heading', () => {
    renderPage();
    expect(screen.getByText('Contribution History')).toBeInTheDocument();
  });

  it('renders member comparison heading', () => {
    renderPage();
    expect(screen.getByText('On-Time Rate vs. Group Members')).toBeInTheDocument();
  });

  it('renders bar chart SVG', () => {
    const { container } = renderPage();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders "You" in member comparison', () => {
    renderPage();
    expect(screen.getByText('You')).toBeInTheDocument();
  });
});
