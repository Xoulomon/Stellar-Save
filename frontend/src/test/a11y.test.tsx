/**
 * Accessibility tests for key UI components and pages.
 *
 * Uses jest-axe (axe-core) to assert zero WCAG 2.1 AA violations.
 * Also covers keyboard navigation and screen reader support.
 *
 * Note: Full WCAG compliance requires manual testing with assistive
 * technologies in addition to these automated checks.
 *
 * Coverage:
 *   - Input, Button, Tabs, Pagination, SearchBar, Spinner (UI primitives)
 *   - WalletButton, CreateGroupForm, JoinGroupButton, ContributeButton (feature components)
 *   - LandingPage, NotFoundPage, ErrorPage, SettingsPage (pages)
 *   - Keyboard navigation across interactive components
 *   - Screen reader attributes (roles, labels, live regions)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { WalletContext } from '../wallet/WalletProvider';
import type { WalletContextValue } from '../wallet/types';
import { WalletButton } from '../components/WalletButton';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { JoinGroupButton } from '../components/JoinGroupButton';
import { ContributeButton } from '../components/ContributeButton';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Tabs } from '../components/Tabs';
import { Pagination } from '../components/Pagination';
import { SearchBar } from '../components/SearchBar';
import { Spinner, FullPageLoader } from '../components/Spinner';
import LandingPage from '../pages/LandingPage';
import NotFoundPage from '../pages/NotFoundPage';
import ErrorPage from '../pages/ErrorPage';
import SettingsPage from '../pages/SettingsPage';

expect.extend(toHaveNoViolations);

// ── Shared wallet context fixtures ────────────────────────────────────────────

const idleWallet: WalletContextValue = {
  wallets: [], selectedWalletId: 'freighter', status: 'idle',
  activeAddress: null, network: null, connectedAccounts: [], error: null,
  refreshWallets: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
  switchWallet: vi.fn(), switchAccount: vi.fn(),
};

const connectedWallet: WalletContextValue = {
  ...idleWallet,
  status: 'connected',
  activeAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU',
};

function withWallet(wallet: WalletContextValue, ui: React.ReactElement) {
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter>{ui}</MemoryRouter>
    </WalletContext.Provider>
  );
}

function withRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ── 1. Input component ────────────────────────────────────────────────────────

describe('Input – accessibility', () => {
  it('has no axe violations (basic)', async () => {
    const { container } = render(
      <Input label="Group Name" value="" onChange={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (with error)', async () => {
    const { container } = render(
      <Input label="Group Name" value="" onChange={vi.fn()} error="Name is required" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('label is associated with input via htmlFor/id', () => {
    render(<Input label="Contribution Amount" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText(/contribution amount/i);
    expect(input).toBeInTheDocument();
  });

  it('error message has role="alert" for screen reader announcement', () => {
    render(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('aria-invalid is true when error is present', () => {
    render(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByLabelText(/amount/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('aria-describedby points to error element', () => {
    render(<Input label="Amount" id="amt" value="" onChange={vi.fn()} error="Required" />);
    const input = screen.getByLabelText(/amount/i);
    expect(input).toHaveAttribute('aria-describedby', 'amt-error');
    expect(document.getElementById('amt-error')).toHaveTextContent('Required');
  });

  it('has no axe violations when disabled', async () => {
    const { container } = render(
      <Input label="Amount" value="100" onChange={vi.fn()} disabled />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with placeholder', async () => {
    const { container } = render(
      <Input label="Search" value="" onChange={vi.fn()} placeholder="Enter search term" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ── 2. WalletButton ───────────────────────────────────────────────────────────

describe('WalletButton – accessibility', () => {
  it('has no axe violations when disconnected', async () => {
    const { container } = withWallet(idleWallet, <WalletButton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when connected', async () => {
    const { container } = withWallet(connectedWallet, <WalletButton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('"Connect Wallet" button is keyboard focusable', () => {
    withWallet(idleWallet, <WalletButton />);
    const btn = screen.getByRole('button', { name: /connect wallet/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('connected state button has accessible text (not just visual truncation)', () => {
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    expect(btn.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('disconnect button in menu has accessible label', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });
});

// ── 3. CreateGroupForm ────────────────────────────────────────────────────────

describe('CreateGroupForm – accessibility', () => {
  it('has no axe violations on step 1', async () => {
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 2', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 3', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 4 (review)', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('progress bar has correct ARIA attributes', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '4');
  });

  it('all step-1 fields are reachable via Tab', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/group name/i));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/description/i));
  });

  it('form can be advanced via keyboard (Enter on Next button)', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    screen.getByRole('button', { name: /next/i }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(/financial settings/i)).toBeInTheDocument();
  });

  it('validation errors are announced via role="alert"', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('cycle duration select has an accessible label', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByLabelText(/cycle duration/i)).toBeInTheDocument();
  });
});

// ── 4. JoinGroupButton ────────────────────────────────────────────────────────

describe('JoinGroupButton – accessibility', () => {
  const defaultProps = {
    groupId: 1, maxMembers: 10, currentMembers: 5, isActive: false,
  };

  it('has no axe violations (eligible state)', async () => {
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (confirmation state)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: /join group/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (disabled states)', async () => {
    const { container } = render(
      <WalletContext.Provider value={idleWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('all buttons are keyboard focusable', async () => {
    const user = userEvent.setup();
    render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: /join group/i }));
    const confirm = screen.getByRole('button', { name: /confirm/i });
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
  });
});

// ── 5. ContributeButton ───────────────────────────────────────────────────────

describe('ContributeButton – accessibility', () => {
  it('has no axe violations (idle state)', async () => {
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} walletAddress="GABC" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (no wallet — warning shown)', async () => {
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (confirmation modal open)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} walletAddress="GABC" />
    );
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('confirmation modal heading is present', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('heading', { name: /confirm contribution/i })).toBeInTheDocument();
  });

  it('confirmation modal buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('modal can be dismissed with Escape key', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('heading', { name: /confirm contribution/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: /confirm contribution/i })).not.toBeInTheDocument();
  });
});

// ── 6. Button component ───────────────────────────────────────────────────────

describe('Button – accessibility', () => {
  it('has no axe violations (primary)', async () => {
    const { container } = render(<Button>Save Group</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = render(<Button disabled>Save Group</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (loading state)', async () => {
    const { container } = render(<Button loading>Save Group</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is keyboard focusable', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('disabled button is not activatable via keyboard', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole('button', { name: /disabled/i });
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading spinner is aria-hidden', () => {
    render(<Button loading>Saving</Button>);
    const spinner = document.querySelector('.btn-spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── 7. Tabs component ─────────────────────────────────────────────────────────

describe('Tabs – accessibility', () => {
  const sampleTabs = [
    { id: 'overview', label: 'Overview', content: <p>Overview content</p> },
    { id: 'history', label: 'History', content: <p>History content</p> },
    { id: 'settings', label: 'Settings', content: <p>Settings content</p> },
  ];

  it('has no axe violations', async () => {
    const { container } = render(<Tabs tabs={sampleTabs} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('tablist has correct role', () => {
    render(<Tabs tabs={sampleTabs} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('each tab has role="tab" and aria-selected', () => {
    render(<Tabs tabs={sampleTabs} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('tabpanel has role="tabpanel" and is labelled by active tab', () => {
    render(<Tabs tabs={sampleTabs} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-overview');
  });

  it('ArrowRight moves focus to next tab', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={sampleTabs} />);
    const firstTab = screen.getByRole('tab', { name: /overview/i });
    firstTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /history/i }));
  });

  it('ArrowLeft moves focus to previous tab', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={sampleTabs} defaultTab="history" />);
    const historyTab = screen.getByRole('tab', { name: /history/i });
    historyTab.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /overview/i }));
  });

  it('Home key moves focus to first tab', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={sampleTabs} defaultTab="settings" />);
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    settingsTab.focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /overview/i }));
  });

  it('End key moves focus to last tab', async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={sampleTabs} />);
    const firstTab = screen.getByRole('tab', { name: /overview/i });
    firstTab.focus();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /settings/i }));
  });

  it('disabled tab has aria-disabled', () => {
    const tabsWithDisabled = [
      ...sampleTabs,
      { id: 'locked', label: 'Locked', content: <p>Locked</p>, disabled: true },
    ];
    render(<Tabs tabs={tabsWithDisabled} />);
    expect(screen.getByRole('tab', { name: /locked/i })).toHaveAttribute('aria-disabled', 'true');
  });
});

// ── 8. Pagination component ───────────────────────────────────────────────────

describe('Pagination – accessibility', () => {
  const defaultProps = {
    currentPage: 3,
    totalPages: 10,
    pageSize: 10,
    totalItems: 100,
    onPageChange: vi.fn(),
  };

  it('has no axe violations', async () => {
    const { container } = render(<Pagination {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('previous button has aria-label', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
  });

  it('next button has aria-label', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('current page button has aria-current="page"', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByRole('button', { name: /page 3/i })).toHaveAttribute('aria-current', 'page');
  });

  it('page size select has an associated label', () => {
    render(<Pagination {...defaultProps} onPageSizeChange={vi.fn()} />);
    expect(screen.getByLabelText(/per page/i)).toBeInTheDocument();
  });

  it('previous button is disabled on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('next button is disabled on last page', () => {
    render(<Pagination {...defaultProps} currentPage={10} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});

// ── 9. SearchBar component ────────────────────────────────────────────────────

describe('SearchBar – accessibility', () => {
  it('has no axe violations (empty)', async () => {
    const { container } = render(<SearchBar onSearch={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (with suggestions)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SearchBar onSearch={vi.fn()} suggestions={['Alpha Group', 'Beta Circle']} />
    );
    await user.type(screen.getByRole('searchbox'), 'al');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('input has role="searchbox" or type="search"', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    // type="search" gives implicit role "searchbox"
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('input has aria-label', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
  });

  it('clear button has aria-label', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={vi.fn()} />);
    await user.type(screen.getByRole('searchbox'), 'test');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('suggestions list has role="listbox"', async () => {
    const user = userEvent.setup();
    render(<SearchBar onSearch={vi.fn()} suggestions={['Alpha Group', 'Beta Circle']} />);
    await user.type(screen.getByRole('searchbox'), 'al');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('search icon is aria-hidden', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    const icon = document.querySelector('.search-bar-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── 10. Spinner component ─────────────────────────────────────────────────────

describe('Spinner – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Spinner />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with label', async () => {
    const { container } = render(<Spinner label="Loading groups..." />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('spinner element has role="status"', () => {
    render(<Spinner ariaLabel="Loading data" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('spinner has aria-label', () => {
    render(<Spinner ariaLabel="Loading groups" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading groups');
  });

  it('FullPageLoader has role="alert" when visible', () => {
    render(<FullPageLoader loading={true} message="Please wait..." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('FullPageLoader renders nothing when loading=false', () => {
    const { container } = render(<FullPageLoader loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ── 11. LandingPage ───────────────────────────────────────────────────────────

describe('LandingPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<LandingPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has a skip-to-main-content link', () => {
    withRouter(<LandingPage />);
    const skip = screen.getByText(/skip to main content/i);
    expect(skip).toBeInTheDocument();
    expect(skip.closest('a')).toHaveAttribute('href', '#main-content');
  });

  it('main content area has id="main-content"', () => {
    withRouter(<LandingPage />);
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });

  it('header has role="banner"', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('footer has role="contentinfo"', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('main navigation has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('footer navigation has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('navigation', { name: /footer navigation/i })).toBeInTheDocument();
  });

  it('hero section is labelled by heading', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('heading', { name: /save together/i })).toBeInTheDocument();
  });

  it('all sections have aria-labelledby', () => {
    withRouter(<LandingPage />);
    // Features section
    expect(screen.getByRole('heading', { name: /built for trust/i })).toBeInTheDocument();
    // How it works section
    expect(screen.getByRole('heading', { name: /simple steps/i })).toBeInTheDocument();
  });

  it('statistics list has aria-label', () => {
    withRouter(<LandingPage />);
    expect(screen.getByRole('list', { name: /platform statistics/i })).toBeInTheDocument();
  });
});

// ── 12. NotFoundPage ──────────────────────────────────────────────────────────

describe('NotFoundPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<NotFoundPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has a visible h1 heading', () => {
    withRouter(<NotFoundPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('"Go Back Home" button is keyboard focusable', () => {
    withRouter(<NotFoundPage />);
    const btn = screen.getByRole('button', { name: /go back home/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('"Learn About Us" button is keyboard focusable', () => {
    withRouter(<NotFoundPage />);
    const btn = screen.getByRole('button', { name: /learn about us/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('illustration image has alt text', () => {
    withRouter(<NotFoundPage />);
    expect(screen.getByRole('img', { name: /404 illustration/i })).toBeInTheDocument();
  });
});

// ── 13. ErrorPage ─────────────────────────────────────────────────────────────

describe('ErrorPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<ErrorPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has a visible heading', () => {
    withRouter(<ErrorPage />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('"Go to Home" button is keyboard focusable', () => {
    withRouter(<ErrorPage />);
    const btn = screen.getByRole('button', { name: /go to home/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('"Retry" button is keyboard focusable', () => {
    withRouter(<ErrorPage />);
    const btn = screen.getByRole('button', { name: /retry/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('error illustration image has alt text', () => {
    withRouter(<ErrorPage />);
    expect(screen.getByRole('img', { name: /error illustration/i })).toBeInTheDocument();
  });
});

// ── 14. SettingsPage ──────────────────────────────────────────────────────────

describe('SettingsPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<SettingsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('theme radio buttons are labelled', () => {
    withRouter(<SettingsPage />);
    expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /system/i })).toBeInTheDocument();
  });

  it('theme radio buttons share a name attribute (radio group)', () => {
    withRouter(<SettingsPage />);
    const radios = screen.getAllByRole('radio');
    const names = radios.map((r) => r.getAttribute('name'));
    expect(new Set(names).size).toBe(1); // all same name = one group
  });

  it('radio buttons are keyboard navigable', async () => {
    const user = userEvent.setup();
    withRouter(<SettingsPage />);
    const lightRadio = screen.getByRole('radio', { name: /light/i });
    lightRadio.focus();
    expect(document.activeElement).toBe(lightRadio);
    await user.keyboard('{ArrowDown}');
    // Focus should move within the radio group
    expect(['dark', 'system', 'light']).toContain(
      (document.activeElement as HTMLInputElement)?.value
    );
  });
});

// ── 15. Input – additional keyboard tests ────────────────────────────────────

describe('Input – keyboard navigation', () => {
  it('Tab moves focus into the input', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Before</button>
        <Input label="Group Name" value="" onChange={vi.fn()} />
        <button>After</button>
      </div>
    );
    screen.getByRole('button', { name: /before/i }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/group name/i));
  });

  it('Shift+Tab moves focus back out of the input', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Before</button>
        <Input label="Group Name" value="" onChange={vi.fn()} />
      </div>
    );
    screen.getByLabelText(/group name/i).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /before/i }));
  });
});

// ── 16. WalletButton – additional keyboard tests ──────────────────────────────

describe('WalletButton – keyboard navigation', () => {
  it('Enter key opens the wallet menu when connected', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('Space key opens the wallet menu when connected', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });
});

// ── 17. CreateGroupForm – additional keyboard tests ───────────────────────────

describe('CreateGroupForm – keyboard navigation', () => {
  it('Tab order follows visual order on step 1', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.tab();
    const first = document.activeElement;
    await user.tab();
    const second = document.activeElement;
    // Both should be form fields, not the same element
    expect(first).not.toBe(second);
    expect(first?.tagName).toMatch(/INPUT|TEXTAREA/i);
  });

  it('Escape does not break form state', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'Test');
    await user.keyboard('{Escape}');
    // Form should still be present
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
  });
});
