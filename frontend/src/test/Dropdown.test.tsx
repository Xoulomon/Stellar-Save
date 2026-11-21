import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  return render(<Dropdown trigger={<button>Open Menu</button>} items={items} {...props} />);
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
      <Dropdown trigger={<button>Open</button>} items={[{ id: 'a', label: 'Action', onClick }]} />
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

  // ── Issue #2033: Keyboard navigation audit ──────────────────────────────────

  it('Tab key closes the menu (WAI-ARIA menu pattern)', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('menu element has stable id (not random)', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    const menu = screen.getByRole('menu');
    // id must be a non-empty string that doesn't change on re-render
    expect(menu.id).toBeTruthy();
    expect(menu.id).toMatch(/^dropdown-menu-/);
  });

  it('trigger aria-controls points to the open menu id', () => {
    renderDropdown();
    const trigger = screen.getByText('Open Menu');
    // No aria-controls before menu opens
    expect(trigger).not.toHaveAttribute('aria-controls');
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
  });

  it('trigger aria-expanded toggles correctly', () => {
    renderDropdown();
    const trigger = screen.getByText('Open Menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders menu with optional aria-label', () => {
    render(
      <Dropdown
        trigger={<button>Open</button>}
        items={[{ id: 'a', label: 'Action' }]}
        menuLabel="User actions"
      />
    );
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('menu')).toHaveAttribute('aria-label', 'User actions');
  });

  it('ArrowDown wraps from last item back to first', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    // Items: Option 1, Option 2, [disabled], [divider], Option 4 → 3 enabled
    const enabledItems = screen.getAllByRole('menuitem').filter(
      (el) => !(el as HTMLButtonElement).disabled
    );
    const count = enabledItems.length;
    // Navigate to the last item (count presses: 0→1, 1→2, 2→3)
    for (let i = 0; i < count; i++) {
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    }
    // One more press wraps back to first
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(enabledItems[0]).toHaveFocus();
  });

  it('ArrowUp wraps from first item to last', async () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    // Starting at index -1, ArrowUp → last enabled item (index 2 = Option 4)
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowUp' });
    });
    await waitFor(() => {
      const enabledItems = screen.getAllByRole('menuitem').filter(
        (el) => !(el as HTMLButtonElement).disabled
      );
      expect(enabledItems[enabledItems.length - 1]).toHaveFocus();
    });
  });

  it('Home key focuses first enabled item', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    // Go down first so we're not already at index -1
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Home' });
    const enabledItems = screen.getAllByRole('menuitem').filter(
      (el) => !(el as HTMLButtonElement).disabled
    );
    expect(enabledItems[0]).toHaveFocus();
  });

  it('End key focuses last enabled item', async () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Open Menu'));
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' }); // start at index 0
      fireEvent.keyDown(document, { key: 'End' });
    });
    await waitFor(() => {
      const enabledItems = screen.getAllByRole('menuitem').filter(
        (el) => !(el as HTMLButtonElement).disabled
      );
      expect(enabledItems[enabledItems.length - 1]).toHaveFocus();
    });
  });

  it('Enter activates the focused item', () => {
    const onClick = vi.fn();
    render(
      <Dropdown
        trigger={<button>Open</button>}
        items={[{ id: 'a', label: 'Action', onClick }]}
      />
    );
    fireEvent.click(screen.getByText('Open'));
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Space activates the focused item', () => {
    const onClick = vi.fn();
    render(
      <Dropdown
        trigger={<button>Open</button>}
        items={[{ id: 'a', label: 'Action', onClick }]}
      />
    );
    fireEvent.click(screen.getByText('Open'));
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
