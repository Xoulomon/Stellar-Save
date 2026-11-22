import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Tabs } from '../components/Tabs';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('Tabs – accessibility', () => {
  const sampleTabs = [
    { id: 'overview', label: 'Overview', content: <p>Overview content</p> },
    { id: 'history', label: 'History', content: <p>History content</p> },
    { id: 'settings', label: 'Settings', content: <p>Settings content</p> },
  ];

  it('has no axe violations', async () => {
    const { container } = renderWithA11y(<Tabs tabs={sampleTabs} />);
    await expectNoA11yViolations(container);
  });

  it('tablist has correct role', () => {
    renderWithA11y(<Tabs tabs={sampleTabs} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('each tab has role="tab" and aria-selected', () => {
    renderWithA11y(<Tabs tabs={sampleTabs} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('tabpanel has role="tabpanel" and is labelled by active tab', () => {
    renderWithA11y(<Tabs tabs={sampleTabs} />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-overview');
  });

  it('ArrowRight moves focus to next tab', async () => {
    const user = userEvent.setup();
    renderWithA11y(<Tabs tabs={sampleTabs} />);
    const firstTab = screen.getByRole('tab', { name: /overview/i });
    firstTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /history/i }));
  });

  it('ArrowLeft moves focus to previous tab', async () => {
    const user = userEvent.setup();
    renderWithA11y(<Tabs tabs={sampleTabs} defaultTab="history" />);
    const historyTab = screen.getByRole('tab', { name: /history/i });
    historyTab.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /overview/i }));
  });

  it('Home key moves focus to first tab', async () => {
    const user = userEvent.setup();
    renderWithA11y(<Tabs tabs={sampleTabs} defaultTab="settings" />);
    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    settingsTab.focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /overview/i }));
  });

  it('End key moves focus to last tab', async () => {
    const user = userEvent.setup();
    renderWithA11y(<Tabs tabs={sampleTabs} />);
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
    renderWithA11y(<Tabs tabs={tabsWithDisabled} />);
    expect(screen.getByRole('tab', { name: /locked/i })).toHaveAttribute('aria-disabled', 'true');
  });
});
