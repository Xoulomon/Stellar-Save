import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';

// Mock freighter-api to avoid real wallet calls
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(false),
  getPublicKey: vi.fn().mockResolvedValue('GABCDEF1234567890'),
  requestAccess: vi.fn().mockResolvedValue(undefined),
}));

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );
}

describe('Header', () => {
  it('renders the logo text', () => {
    renderHeader();
    expect(screen.getByText('Stellar-Save')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('renders Connect Wallet button initially', () => {
    renderHeader();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('toggles mobile menu when menu button is clicked', () => {
    const { container } = renderHeader();
    const menuToggle = screen.getByLabelText('Toggle menu');
    const nav = container.querySelector('.header-nav');

    expect(nav).not.toHaveClass('open');
    fireEvent.click(menuToggle);
    expect(nav).toHaveClass('open');
    fireEvent.click(menuToggle);
    expect(nav).not.toHaveClass('open');
  });
});
