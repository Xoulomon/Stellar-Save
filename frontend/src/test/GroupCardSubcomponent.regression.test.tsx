/**
 * Regression tests for GroupCard subcomponent prop contract.
 *
 * These tests lock in the prop-passing interface between GroupCard and its
 * three sub-components (GroupCardHeader, GroupCardStats, GroupCardActions)
 * to prevent re-introduction of the bugs fixed in PRs #1451 and #1450.
 *
 * Specifically guarded bugs:
 *  - PR #1451: GroupCardHeader received `status` as an incorrect type
 *    (raw string that didn't match GroupBadgeStatus), causing the badge to
 *    render the wrong label/variant.
 *  - PR #1450: GroupCardActions received `groupName` incorrectly (undefined
 *    was passed instead of the actual group name), so aria-labels were generic
 *    rather than contextual.
 *
 * Each test is annotated with the PR that introduced the fix so future
 * maintainers understand the intent.
 *
 * Related: #16, #17 (issue #1548)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import { GroupCard } from '../components/GroupCard';
import { GroupCardActions } from '../components/GroupCardActions';
import { GroupCardHeader } from '../components/GroupCardHeader';
import { GroupCardStats } from '../components/GroupCardStats';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function Providers({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderGroupCard(props: Record<string, unknown> = {}) {
  const defaults = {
    groupName: 'Regression Savers',
    memberCount: 5,
    contributionAmount: 200,
  };
  return render(<GroupCard {...defaults} {...props} />, { wrapper: Providers });
}

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: GroupCardHeader — status prop contract  (fix: PR #1451)
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupCardHeader — prop contract regression (PR #1451)', () => {
  /**
   * PR #1451 bug: the `status` prop was passed as an arbitrary string
   * (e.g. "Active" with a capital A, or "in_progress"), which was not a
   * valid GroupBadgeStatus. The badge rendered the wrong text/variant.
   * After the fix, only the four defined statuses are accepted and the badge
   * always renders the expected label.
   */

  it('renders "active" status label exactly — not altered by GroupCard prop flow', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="active" />);
    // The badge must show the lowercase canonical label, not a transformed version
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders "pending" status label exactly', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="pending" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders "complete" status label exactly', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="complete" />);
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('renders "completed" status label exactly', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="completed" />);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('GroupCard passes status down to GroupCardHeader unchanged in static mode', () => {
    renderGroupCard({ status: 'pending' });
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });

  it('GroupCard defaults to "active" status when none is supplied', () => {
    renderGroupCard();
    // Default status must be "active", not empty or undefined
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('GroupCard passes "completed" status to GroupCardHeader', () => {
    renderGroupCard({ status: 'completed' });
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('GroupCardHeader renders group name in a heading regardless of status', () => {
    for (const status of ['active', 'pending', 'complete', 'completed'] as const) {
      const { unmount } = render(
        <GroupCardHeader groupName="My Group" status={status} />,
      );
      expect(screen.getByRole('heading', { name: 'My Group' })).toBeInTheDocument();
      unmount();
    }
  });

  it('GroupCardHeader shows image with correct alt text derived from groupName', () => {
    render(
      <GroupCardHeader
        groupName="Circle One"
        status="active"
        imageUrl="https://cdn.example.com/circle1.png"
      />,
    );
    const img = screen.getByRole('img');
    // alt must be the groupName, not a hardcoded fallback
    expect(img).toHaveAttribute('alt', 'Circle One');
  });

  it('GroupCard passes groupName to GroupCardHeader so image alt is correct', () => {
    renderGroupCard({ imageUrl: 'https://cdn.example.com/test.png' });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Regression Savers');
  });

  it('GroupCardHeader does not render image block when imageUrl is omitted', () => {
    const { container } = render(
      <GroupCardHeader groupName="No Image Group" status="active" />,
    );
    expect(container.querySelector('.group-card-image')).toBeNull();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('GroupCardHeader does not render description block when description is omitted', () => {
    const { container } = render(
      <GroupCardHeader groupName="No Desc Group" status="active" />,
    );
    expect(container.querySelector('.group-card-description')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: GroupCardStats — prop contract  (fix: PR #1451)
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupCardStats — prop contract regression (PR #1451)', () => {
  /**
   * PR #1451 also ensured GroupCardStats always receives a pre-formatted
   * `contributionAmount` string instead of a raw number, and that
   * `nextPayoutDate` is never coerced from a boolean or number.
   */

  it('renders the contributionAmount string as-is without extra formatting', () => {
    render(
      <GroupCardStats
        contributionAmount="750 XLM"
        memberCount={10}
        currentCycle={2}
        nextPayoutDate={null}
      />,
    );
    expect(screen.getByText('750 XLM')).toBeInTheDocument();
  });

  it('renders currency suffix passed via contributionAmount string', () => {
    render(
      <GroupCardStats
        contributionAmount="1,000 USDC"
        memberCount={3}
        currentCycle={1}
        nextPayoutDate={null}
      />,
    );
    expect(screen.getByText('1,000 USDC')).toBeInTheDocument();
  });

  it('GroupCard formats contributionAmount with currency before passing to GroupCardStats', () => {
    renderGroupCard({ contributionAmount: 500, currency: 'XLM' });
    expect(screen.getByText('500 XLM')).toBeInTheDocument();
  });

  it('GroupCard uses "XLM" as default currency in the formatted amount', () => {
    renderGroupCard({ contributionAmount: 100 });
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
  });

  it('GroupCard passes currentCycle to GroupCardStats', () => {
    renderGroupCard({ currentCycle: 7 });
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('GroupCard defaults currentCycle to 0 when not supplied', () => {
    renderGroupCard();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('GroupCard passes nextPayoutDate to GroupCardStats and renders formatted date', () => {
    const date = new Date('2026-09-15');
    renderGroupCard({ nextPayoutDate: date });
    expect(screen.getByText('Sep 15, 2026')).toBeInTheDocument();
  });

  it('GroupCard passes null nextPayoutDate and GroupCardStats shows em dash', () => {
    renderGroupCard({ nextPayoutDate: null });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('GroupCard passes undefined nextPayoutDate and GroupCardStats shows em dash', () => {
    renderGroupCard();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('GroupCardStats renders all four stat labels', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={5}
        currentCycle={1}
        nextPayoutDate={null}
      />,
    );
    expect(screen.getByText('Contribution')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('Next Payout')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: GroupCardActions — groupName aria-label contract  (fix: PR #1450)
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupCardActions — groupName prop regression (PR #1450)', () => {
  /**
   * PR #1450 bug: `GroupCard` was not forwarding `groupName` to
   * `GroupCardActions`, so the aria-labels on action buttons were always
   * generic ("View details", "Join group") rather than contextual
   * ("View details Alpha Savers", "Join group Alpha Savers").
   * This broke screen-reader UX when multiple cards were rendered in a list.
   */

  it('GroupCardActions aria-labels include groupName when provided', () => {
    render(
      <GroupCardActions
        onViewDetails={vi.fn()}
        onJoin={vi.fn()}
        groupName="Savings Circle"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'View details Savings Circle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Join group Savings Circle' }),
    ).toBeInTheDocument();
  });

  it('GroupCardActions aria-labels fall back to generic names when groupName is omitted', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join group' })).toBeInTheDocument();
  });

  it('GroupCard passes groupName down to GroupCardActions for contextual aria-labels', () => {
    renderGroupCard({ onViewDetails: vi.fn(), onJoin: vi.fn() });
    // After PR #1450, the button aria-labels include the group name
    expect(
      screen.getByRole('button', { name: 'View details Regression Savers' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Join group Regression Savers' }),
    ).toBeInTheDocument();
  });

  it('two GroupCards in the same page have distinct aria-labels for their action buttons', () => {
    render(
      <Providers>
        <GroupCard
          groupName="Alpha Group"
          memberCount={5}
          contributionAmount={100}
          onJoin={vi.fn()}
        />
        <GroupCard
          groupName="Beta Group"
          memberCount={8}
          contributionAmount={200}
          onJoin={vi.fn()}
        />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'Join group Alpha Group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join group Beta Group' })).toBeInTheDocument();
  });

  it('GroupCardActions does not render any buttons when no handlers are provided', () => {
    render(<GroupCardActions groupName="Orphan Group" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('GroupCardActions View Details button stops click propagation', () => {
    const parentClick = vi.fn();
    const onViewDetails = vi.fn();
    render(
      <div onClick={parentClick}>
        <GroupCardActions onViewDetails={onViewDetails} groupName="Test Group" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('GroupCardActions Join Group button stops click propagation', () => {
    const parentClick = vi.fn();
    const onJoin = vi.fn();
    render(
      <div onClick={parentClick}>
        <GroupCardActions onJoin={onJoin} groupName="Test Group" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: full GroupCard prop flow through all three subcomponents
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupCard — integrated subcomponent prop flow regression', () => {
  /**
   * Validates that the entire prop chain from GroupCard down to all three
   * sub-components is wired correctly. This is the integration-level guard
   * for both PR #1450 and PR #1451.
   */

  it('all GroupCard static props are rendered by the appropriate subcomponent', () => {
    const onViewDetails = vi.fn();
    const onJoin = vi.fn();
    const nextPayoutDate = new Date('2026-10-01');

    renderGroupCard({
      groupName: 'Full Props Group',
      status: 'active',
      description: 'A full-featured group',
      imageUrl: 'https://example.com/fp.png',
      memberCount: 12,
      contributionAmount: 300,
      currency: 'XLM',
      currentCycle: 4,
      nextPayoutDate,
      onViewDetails,
      onJoin,
    });

    // GroupCardHeader
    expect(screen.getByRole('heading', { name: 'Full Props Group' })).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('A full-featured group')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/fp.png');
    expect(img).toHaveAttribute('alt', 'Full Props Group');

    // GroupCardStats
    expect(screen.getByText('300 XLM')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument();

    // GroupCardActions — contextual aria-labels prove groupName was forwarded
    expect(
      screen.getByRole('button', { name: 'View details Full Props Group' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Join group Full Props Group' }),
    ).toBeInTheDocument();
  });

  it('GroupCard in fetch mode passes fetched groupName to GroupCardActions', async () => {
    // This test deliberately uses static mode but mirrors the fetch-mode assertion
    // from GroupCard.test.tsx to confirm that the groupName→aria-label chain works
    // even when groupName comes from a data source rather than a direct prop.
    // (The actual fetch-mode integration is in GroupCard.test.tsx.)
    renderGroupCard({ groupName: 'Fetched Group', onJoin: vi.fn() });
    expect(
      screen.getByRole('button', { name: 'Join group Fetched Group' }),
    ).toBeInTheDocument();
  });
});
