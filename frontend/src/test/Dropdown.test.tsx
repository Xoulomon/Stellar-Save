import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Dropdown } from '../components/Dropdown';

const items = [
  { id: 'item1', label: 'Option 1', onClick: vi.fn() },
  { id: 'item2', label: 'Option 2', onClick: vi.fn() },
  { id: 'item3', label: 'Option 3', disabled: true, onClick: vi.fn() },
  { id: 'divider', label: '', divider: true },
  { id: 'item4', label: 'Option 4', onClick: vi.fn() },
];

function renderDropdown(props = {}) {
  return render(
    <Dropdown
      trigger={<button>Open Menu</button>}
      items={items}
      {...props}
    />,
  );
}

describe('Dropdown', () => {
  it('does not show menu initially', () => {
    renderDropdown();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu when trigger is clicked', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes menu when trigger is clicked again', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders menu items', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('calls item onClick when item is clicked', () => {
    const onClick = vi.fn();
    render(
      <Dropdown
        trigger={<button>Open</button>}
        items={[{ id: 'a', label: 'Action', onClick }]}
      />,
    );
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Action'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('closes menu after item click', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    fireEvent.click(screen.getByText('Option 1'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    renderDropdown({ disabled: true });
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders divider', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('navigates items with ArrowDown', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // First enabled item should be focused
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  });

  it('closes when clicking outside', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
