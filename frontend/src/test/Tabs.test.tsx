import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, Tab } from '../components/Tabs';

describe('Tabs', () => {
  const mockTabs: Tab[] = [
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
    { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div>, disabled: true },
  ];

  it('renders all tabs', () => {
    render(<Tabs tabs={mockTabs} />);
    
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();
  });

  it('displays first tab content by default', () => {
    render(<Tabs tabs={mockTabs} />);
    
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
  });

  it('switches content when clicking a tab', () => {
    render(<Tabs tabs={mockTabs} />);
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
    fireEvent.click(tab2);
    
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  });

  it('calls onChange when tab is clicked', () => {
    const handleChange = vi.fn();
    render(<Tabs tabs={mockTabs} onChange={handleChange} />);
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
    fireEvent.click(tab2);
    
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });

  it('respects defaultTab prop', () => {
    render(<Tabs tabs={mockTabs} defaultTab="tab2" />);
    
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('works as controlled component', () => {
    const { rerender } = render(<Tabs tabs={mockTabs} activeTab="tab1" />);
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    
    rerender(<Tabs tabs={mockTabs} activeTab="tab2" />);
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('does not switch to disabled tab', () => {
    render(<Tabs tabs={mockTabs} />);
    
    const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
    fireEvent.click(tab3);
    
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
  });

  it('sets correct ARIA attributes', () => {
    render(<Tabs tabs={mockTabs} />);
    
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
    
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveAttribute('aria-selected', 'false');
    expect(tab1).toHaveAttribute('tabIndex', '0');
    expect(tab2).toHaveAttribute('tabIndex', '-1');
  });

  it('handles keyboard navigation with arrow keys', () => {
    render(<Tabs tabs={mockTabs} />);
    
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    tab1.focus();
    
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('handles Home and End keys', () => {
    render(<Tabs tabs={mockTabs} defaultTab="tab2" />);
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
    tab2.focus();
    
    fireEvent.keyDown(tab2, { key: 'Home' });
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    fireEvent.keyDown(tab1, { key: 'End' });
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('skips disabled tabs in keyboard navigation', () => {
    const tabsWithDisabled: Tab[] = [
      { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
      { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div>, disabled: true },
      { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> },
    ];
    
    render(<Tabs tabs={tabsWithDisabled} />);
    
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    tab1.focus();
    
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(screen.getByText('Content 3')).toBeInTheDocument();
  });

  it('renders with icons', () => {
    const tabsWithIcons: Tab[] = [
      { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div>, icon: <span>🏠</span> },
    ];
    
    render(<Tabs tabs={tabsWithIcons} />);
    expect(screen.getByText('🏠')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Tabs tabs={mockTabs} variant="pills" />);
    expect(container.querySelector('.tabs-pills')).toBeInTheDocument();
  });

  it('applies orientation classes', () => {
    const { container } = render(<Tabs tabs={mockTabs} orientation="vertical" />);
    expect(container.querySelector('.tabs-vertical')).toBeInTheDocument();
  });
});
